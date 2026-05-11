'use client';

import { useState } from 'react';
import { Button, Space } from 'antd';
import { CommentOutlined } from '@ant-design/icons';
import { ApprovalPanel } from '@/components/ApprovalPanel';
import { CommentsPanel } from '@/components/CommentsPanel';
import { ReviewSummary } from './ReviewSummary';
import type { CycleStatus, OtbCycle } from '@/types/otb';

interface ReviewTabContentProps {
  cycleId: string;
  cycleStatus: CycleStatus;
  onCycleUpdated?: (cycle: OtbCycle) => void;
}

export function ReviewTabContent({
  cycleId,
  cycleStatus,
  onCycleUpdated,
}: ReviewTabContentProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);

  // ApprovalPanel emits a status string; the workspace shell wants a full OtbCycle.
  // Re-fetch the cycle after status change so downstream consumers get fresh state.
  const handleStatusChange = async (_newStatus: string) => {
    if (!onCycleUpdated) return;
    try {
      const res = await fetch(`/api/cycles/${cycleId}`);
      if (res.ok) {
        const cycle = (await res.json()) as OtbCycle;
        onCycleUpdated(cycle);
      }
    } catch {
      // Non-fatal: ApprovalPanel already surfaced its own toast on the action.
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <ApprovalPanel
        cycleId={cycleId}
        cycleStatus={cycleStatus}
        onStatusChange={handleStatusChange}
      />

      <ReviewSummary cycleId={cycleId} />

      <div>
        <Button icon={<CommentOutlined />} onClick={() => setCommentsOpen(true)}>
          Comments
        </Button>
        <CommentsPanel
          cycleId={cycleId}
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
        />
      </div>
    </Space>
  );
}
