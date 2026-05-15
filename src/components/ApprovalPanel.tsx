'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Button, Modal, Input, message, Typography, Space } from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined, MinusCircleOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import { StatusPipeline } from '@/components/ui/StatusPipeline';
import type { PipelineStage } from '@/components/ui/StatusPipeline';
import { COLORS, CARD_STYLES, SPACING } from '@/lib/designTokens';
import type { ApprovalRecord, ApproverRole } from '@/types/otb';
import { isRoleBlocked, canUserApprove, APPROVER_SEQUENCE } from '@/lib/approvalEngine';

const { Text, Title } = Typography;

interface ApprovalPanelProps {
  cycleId: string;
  cycleStatus: string;
  onStatusChange?: (newStatus: string) => void;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; badgeClass: string; label: string }> = {
  Approved:          { color: COLORS.success, icon: <CheckCircleOutlined />,    badgeClass: 'badge badge-green',  label: 'Approved' },
  Pending:           { color: COLORS.accent,  icon: <ClockCircleOutlined />,    badgeClass: 'badge badge-blue badge-pulse', label: 'Pending' },
  RevisionRequested: { color: COLORS.danger,  icon: <ExclamationCircleOutlined />, badgeClass: 'badge badge-red', label: 'Revision Requested' },
  Waiting:           { color: '#c4bfb8',      icon: <MinusCircleOutlined />,    badgeClass: 'badge badge-gray',  label: 'Waiting' },
};


function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ApprovalPanel({ cycleId, cycleStatus, onStatusChange }: ApprovalPanelProps) {
  const { profile } = useAuth();
  const [records, setRecords] = useState<ApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionComment, setRevisionComment] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/cycles/${cycleId}/approval-status`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (res.ok) {
        message.success('Approval submitted');
        await fetchStatus();
        if (data.status && data.status !== cycleStatus) {
          onStatusChange?.(data.status);
        }
      } else {
        message.error(data.error || 'Failed to approve');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevision = async () => {
    if (!revisionComment.trim()) {
      message.warning('Please provide a comment for revision request');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revision_requested', comment: revisionComment }),
      });
      const data = await res.json();
      if (res.ok) {
        message.success('Revision requested');
        setRevisionModalOpen(false);
        setRevisionComment('');
        await fetchStatus();
        if (data.status && data.status !== cycleStatus) {
          onStatusChange?.(data.status);
        }
      } else {
        message.error(data.error || 'Failed to request revision');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const approvedCount = records.filter(r => r.status === 'Approved').length;
  const canAct =
    cycleStatus === 'InReview' &&
    !!profile?.role &&
    canUserApprove(profile.role, records);

  // Build pipeline stages from records
  const pipelineStages: PipelineStage[] = APPROVER_SEQUENCE.map(role => {
    const record = records.find(r => r.role === role);
    if (record?.status === 'Approved') return { key: role, label: role, status: 'completed' as const };
    if (record?.status === 'RevisionRequested') return { key: role, label: role, status: 'error' as const };
    const blocked = isRoleBlocked(role, records);
    return { key: role, label: role, status: (blocked ? 'pending' : 'active') as 'pending' | 'active' };
  });

  return (
    <div style={{ marginBottom: SPACING.xl }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Title level={5} style={{ margin: 0 }}>Approval Status</Title>
        <span style={{
          fontSize: 12, fontWeight: 600,
          color: approvedCount === 4 ? COLORS.success : COLORS.textMuted,
        }}>
          {approvedCount} / 4 approved
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', marginBottom: SPACING.lg }}>
        <div style={{
          height: '100%',
          width: `${(approvedCount / 4) * 100}%`,
          background: approvedCount === 4
            ? `linear-gradient(90deg, ${COLORS.success}, #38a169)`
            : `linear-gradient(90deg, var(--primary), var(--primary-dark))`,
          borderRadius: 3,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Pipeline visualization */}
      <div style={{ marginBottom: SPACING.xl }}>
        <StatusPipeline stages={pipelineStages} size="small" />
      </div>

      <Row gutter={[12, 12]}>
        {records.map(record => {
          const blocked = record.status === 'Pending' && isRoleBlocked(record.role, records);
          const displayKey = blocked ? 'Waiting' : record.status;
          const cfg = STATUS_CONFIG[displayKey] ?? STATUS_CONFIG.Pending;
          return (
            <Col key={record.role} xs={24} sm={12} md={6}>
              <Card
                size="small"
                style={{ ...CARD_STYLES, borderTop: `3px solid ${cfg.color}`, background: `${cfg.color}08` }}
                loading={loading}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: cfg.color, fontSize: 15, lineHeight: 1, display: 'flex' }}>{cfg.icon}</span>
                      <Text strong style={{ fontSize: 13 }}>{record.role}</Text>
                    </div>
                    <span className={cfg.badgeClass} style={{ fontSize: 11 }}>{cfg.label}</span>
                  </div>
                  {record.user_name && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {record.user_name}
                      {record.decided_at && (
                        <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>
                          · {formatRelativeTime(record.decided_at)}
                        </span>
                      )}
                    </div>
                  )}
                  {record.comment && (
                    <div style={{
                      fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic',
                      borderLeft: `2px solid ${cfg.color}40`, paddingLeft: 8,
                    }}>
                      &ldquo;{record.comment}&rdquo;
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {canAct && (
        <Space style={{ marginTop: SPACING.lg }}>
          <Button
            type="primary"
            style={{ background: COLORS.success, borderColor: COLORS.success }}
            icon={<CheckCircleOutlined />}
            loading={actionLoading}
            onClick={handleApprove}
          >
            Approve
          </Button>
          <Button
            danger
            icon={<ExclamationCircleOutlined />}
            loading={actionLoading}
            onClick={() => setRevisionModalOpen(true)}
          >
            Request Revision
          </Button>
        </Space>
      )}

      <Modal
        title="Request Revision"
        open={revisionModalOpen}
        onOk={handleRevision}
        onCancel={() => { setRevisionModalOpen(false); setRevisionComment(''); }}
        confirmLoading={actionLoading}
        okText="Submit Revision Request"
        okButtonProps={{ danger: true }}
      >
        <Text>Please explain what needs to be revised:</Text>
        <Input.TextArea
          rows={4}
          value={revisionComment}
          onChange={e => setRevisionComment(e.target.value)}
          placeholder="Describe the required changes..."
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  );
}
