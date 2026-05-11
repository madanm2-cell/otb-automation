'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, Spin, Typography, Card } from 'antd';
import { COLORS, SPACING } from '@/lib/designTokens';
import type { OtbCycle, FileUpload } from '@/types/otb';
import { REQUIRED_FILE_TYPES } from '@/types/otb';
import { CycleHeader } from './CycleHeader';
import { SetupTab } from './SetupTab';
import { PlanTabContent } from './PlanTabContent';
import { ReviewTabContent } from './ReviewTabContent';
import { AnalyzeTabContent } from './AnalyzeTabContent';
import { resolveDefaultTab, type WorkspaceTab } from '@/lib/cycleWorkspace/defaultTab';
import { isPlanVisible, isReviewVisible, isAnalyzeVisible } from '@/lib/cycleWorkspace/tabVisibility';
import { useAuth } from '@/hooks/useAuth';

const { Text } = Typography;

const VALID_TABS: WorkspaceTab[] = ['setup', 'plan', 'review', 'analyze'];

interface ApprovalRecord {
  role: string;
  status: string;
  user_id: string | null;
  user_name: string | null;
  comment: string | null;
  decided_at: string | null;
}

interface ApprovalStatusResponse {
  cycle_id: string;
  cycle_status: string;
  records: ApprovalRecord[];
}

function isValidTab(value: string | null): value is WorkspaceTab {
  return value !== null && (VALID_TABS as string[]).includes(value);
}

export function CycleWorkspace({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();

  const [cycle, setCycle] = useState<OtbCycle | null>(null);
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [needsMyApproval, setNeedsMyApproval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mountedTabs, setMountedTabs] = useState<Set<WorkspaceTab>>(new Set());
  const [actualsVersion, setActualsVersion] = useState(0);

  const refetch = useCallback(async () => {
    try {
      const [cycleRes, uploadsRes, approvalRes] = await Promise.all([
        fetch(`/api/cycles/${cycleId}`),
        fetch(`/api/cycles/${cycleId}/upload-status`),
        fetch(`/api/cycles/${cycleId}/approval-status`),
      ]);

      const cycleData: OtbCycle | null = cycleRes.ok ? await cycleRes.json() : null;
      const uploadsData: FileUpload[] = uploadsRes.ok ? await uploadsRes.json() : [];
      const approvalData: ApprovalStatusResponse | null = approvalRes.ok
        ? await approvalRes.json()
        : null;

      setCycle(cycleData);
      setUploads(Array.isArray(uploadsData) ? uploadsData : []);

      // Compute needsMyApproval: any pending record matching the current user's role.
      if (approvalData && profile?.role) {
        const myRole = profile.role;
        const pendingForMe = approvalData.records.some(
          r => r.role === myRole && r.status === 'Pending'
        );
        setNeedsMyApproval(pendingForMe);
      } else {
        setNeedsMyApproval(false);
      }
    } catch {
      // Non-fatal: leave previous state in place; a Spin will continue if cycle is null.
    }
  }, [cycleId, profile?.role]);

  // Initial load + cycleId change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refetch().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [cycleId, refetch]);

  const planVisible    = cycle ? isPlanVisible(cycle.status)                      : false;
  const reviewVisible  = cycle ? isReviewVisible(cycle.status)                    : false;
  const analyzeVisible = cycle ? isAnalyzeVisible(cycle.status, uploads)          : false;

  // Resolve active tab from URL or compute default.
  const urlTab = searchParams.get('tab');
  const activeTab: WorkspaceTab = useMemo(() => {
    if (!cycle) return 'setup';

    const defaultTab = resolveDefaultTab({
      status: cycle.status,
      needsMyApproval,
      hasActuals: analyzeVisible,
    });

    if (isValidTab(urlTab)) {
      // Redirect to default if the requested tab is hidden for this cycle's status.
      if (urlTab === 'plan'    && !planVisible)    return defaultTab;
      if (urlTab === 'review'  && !reviewVisible)  return defaultTab;
      if (urlTab === 'analyze' && !analyzeVisible) return defaultTab;
      return urlTab;
    }

    return defaultTab;
  }, [cycle, urlTab, planVisible, reviewVisible, analyzeVisible, needsMyApproval]);

  // Sync URL when resolved tab differs from URL param (or URL has no tab).
  useEffect(() => {
    if (loading || !cycle) return;
    if (urlTab !== activeTab) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', activeTab);
      router.replace(`/cycles/${cycleId}?${params.toString()}`);
    }
  }, [activeTab, urlTab, loading, cycle, cycleId, router, searchParams]);

  // Mount tracking: every time the active tab changes, add it (additive — never remove).
  useEffect(() => {
    if (loading || !cycle) return;
    setMountedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab, loading, cycle]);

  // Tab click handler: update URL via router.replace and add to mountedTabs.
  const handleTabChange = useCallback(
    (key: string) => {
      if (!isValidTab(key)) return;
      setMountedTabs(prev => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', key);
      router.replace(`/cycles/${cycleId}?${params.toString()}`);
    },
    [cycleId, router, searchParams]
  );

  const handleCycleUpdated = useCallback((next: OtbCycle) => {
    setCycle(next);
    // Refetch to keep uploads / approval state aligned with the new cycle status.
    refetch();
  }, [refetch]);

  const handleActualsUploaded = useCallback(() => {
    setActualsVersion(v => v + 1);
    refetch();
  }, [refetch]);

  // Compute canActivate for the header.
  const allRequiredValidated = useMemo(
    () =>
      REQUIRED_FILE_TYPES.every(
        ft => uploads.some(u => u.file_type === ft && u.status === 'validated')
      ),
    [uploads]
  );
  const canActivate =
    !!cycle &&
    cycle.status === 'Draft' &&
    allRequiredValidated &&
    !!cycle.assigned_gd_id &&
    !!cycle.defaults_confirmed;

  // Pre-activation hint: list missing prerequisites for Draft cycles.
  const preActivationHints = useMemo(() => {
    if (!cycle || cycle.status !== 'Draft' || canActivate) return [];
    const hints: string[] = [];
    if (!allRequiredValidated) hints.push('Upload required files');
    if (!cycle.assigned_gd_id) hints.push('Assign a GD');
    if (!cycle.defaults_confirmed) hints.push('Confirm defaults');
    return hints;
  }, [cycle, canActivate, allRequiredValidated]);

  if (loading || !cycle) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  const tabItems: { key: WorkspaceTab; label: string }[] = [{ key: 'setup', label: 'Setup' }];
  if (planVisible)    tabItems.push({ key: 'plan',    label: 'Plan' });
  if (reviewVisible)  tabItems.push({ key: 'review',  label: 'Review' });
  if (analyzeVisible) tabItems.push({ key: 'analyze', label: 'Analyze' });

  return (
    <div style={{ padding: SPACING.lg, background: COLORS.background, minHeight: '100vh' }}>
      {/* Header card — cycle metadata + status pipeline */}
      <Card
        style={{ marginBottom: SPACING.lg, borderRadius: 8 }}
        styles={{ body: { padding: SPACING.lg } }}
      >
        <CycleHeader
          cycle={cycle}
          onCycleUpdated={handleCycleUpdated}
          canActivate={canActivate}
        />
        {preActivationHints.length > 0 && (
          <div style={{ marginTop: SPACING.sm }}>
            <Text type="secondary">
              To activate: {preActivationHints.join(' · ')}
            </Text>
          </div>
        )}
      </Card>

      {/* Tabs visually attached to their content card */}
      <Card
        style={{ borderRadius: 8 }}
        styles={{ body: { padding: 0 } }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          type="card"
          size="large"
          items={tabItems.map(t => ({ key: t.key, label: t.label }))}
          style={{ padding: `${SPACING.sm}px ${SPACING.lg}px 0` }}
          tabBarStyle={{ marginBottom: 0 }}
        />
        <div
          style={{
            padding: SPACING.lg,
            borderTop: `1px solid ${COLORS.borderLight}`,
          }}
        >
          {mountedTabs.has('setup') && (
            <div style={{ display: activeTab === 'setup' ? 'block' : 'none' }}>
              <SetupTab
                cycle={cycle}
                onCycleUpdated={handleCycleUpdated}
                onActualsUploaded={handleActualsUploaded}
              />
            </div>
          )}

          {planVisible && mountedTabs.has('plan') && (
            <div style={{ display: activeTab === 'plan' ? 'block' : 'none' }}>
              <PlanTabContent cycleId={cycleId} />
            </div>
          )}

          {reviewVisible && mountedTabs.has('review') && (
            <div style={{ display: activeTab === 'review' ? 'block' : 'none' }}>
              <ReviewTabContent
                cycleId={cycleId}
                cycleStatus={cycle.status}
                onCycleUpdated={handleCycleUpdated}
              />
            </div>
          )}

          {analyzeVisible && mountedTabs.has('analyze') && (
            <div style={{ display: activeTab === 'analyze' ? 'block' : 'none' }}>
              <AnalyzeTabContent cycleId={cycleId} refreshKey={actualsVersion} />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
