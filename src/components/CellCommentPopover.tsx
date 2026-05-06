'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, Tag, Typography, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import type { OtbComment } from '@/types/otb';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const ROLE_COLORS: Record<string, string> = {
  Admin: 'red', Planning: 'blue', GD: 'green',
  Finance: 'orange', CXO: 'purple', ReadOnly: 'default',
};

const CAN_COMMENT_ROLES = ['Admin', 'Planning', 'GD', 'Finance', 'CXO'];

function formatRelativeTime(dateStr: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

interface CellCommentPopoverProps {
  cycleId: string;
  rowId: string;
  month: string;
  field: string;
  cellRect: DOMRect;
  comments: OtbComment[];
  onClose: () => void;
  onCommentAdded: () => void;
}

const POPOVER_WIDTH = 300;

export function CellCommentPopover({
  cycleId, rowId, month, field, cellRect, comments, onClose, onCommentAdded,
}: CellCommentPopoverProps) {
  const { profile } = useAuth();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const canComment = CAN_COMMENT_ROLES.includes(profile?.role ?? '');

  const left = Math.min(cellRect.right + 4, window.innerWidth - POPOVER_WIDTH - 12);
  const top = cellRect.top;

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), comment_type: 'metric', row_id: rowId, month, field }),
      });
      if (!res.ok) {
        const err = await res.json();
        message.error(err.error ?? 'Failed to post comment');
        return;
      }
      setText('');
      onCommentAdded();
    } catch {
      message.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top,
        left,
        width: POPOVER_WIDTH,
        maxHeight: 360,
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 8,
        boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {field} · {new Date(month + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
        </Text>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: comments.length ? '8px 12px' : 0 }}>
        {comments.length === 0 ? (
          <Text type="secondary" style={{ display: 'block', padding: '12px', fontSize: 12 }}>
            No comments yet.
          </Text>
        ) : (
          comments.map(c => (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text strong style={{ fontSize: 12 }}>{c.author_name}</Text>
                <Tag color={ROLE_COLORS[c.author_role] ?? 'default'} style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>
                  {c.author_role}
                </Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>{formatRelativeTime(c.created_at)}</Text>
              </div>
              <Paragraph style={{ fontSize: 12, margin: 0, whiteSpace: 'pre-wrap' }}>{c.text}</Paragraph>
            </div>
          ))
        )}
      </div>

      {canComment && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0' }}>
          <TextArea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add a comment..."
            autoSize={{ minRows: 2, maxRows: 4 }}
            style={{ fontSize: 12, marginBottom: 6 }}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              loading={submitting}
              disabled={!text.trim()}
              onClick={handleSubmit}
            >
              Post
            </Button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
