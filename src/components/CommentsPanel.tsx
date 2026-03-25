'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Drawer,
  Input,
  List,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { SendOutlined, MessageOutlined } from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import type { CommentType, OtbComment } from '@/types/otb';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface CommentsPanelProps {
  cycleId: string;
  open: boolean;
  onClose: () => void;
}

const COMMENT_TYPE_OPTIONS: { value: CommentType; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'brand', label: 'Brand' },
  { value: 'metric', label: 'Metric' },
];

const ROLE_COLORS: Record<string, string> = {
  Admin: 'red',
  Planning: 'blue',
  GD: 'green',
  Finance: 'orange',
  CXO: 'purple',
  ReadOnly: 'default',
};

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function buildThreadTree(comments: OtbComment[]): OtbComment[] {
  const map = new Map<string, OtbComment>();
  const roots: OtbComment[] = [];

  // Index all comments
  for (const c of comments) {
    map.set(c.id, { ...c, replies: [] });
  }

  // Build tree
  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function CommentItem({
  comment,
  depth,
  onReply,
}: {
  comment: OtbComment;
  depth: number;
  onReply: (parentId: string) => void;
}) {
  return (
    <div style={{ marginLeft: depth * 24, marginBottom: 12 }}>
      <div
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          background: depth === 0 ? '#fafafa' : '#f5f5f5',
          border: '1px solid #f0f0f0',
        }}
      >
        <Space size={8} style={{ marginBottom: 4 }}>
          <Text strong style={{ fontSize: 13 }}>
            {comment.author_name}
          </Text>
          <Tag color={ROLE_COLORS[comment.author_role] ?? 'default'} style={{ marginRight: 0 }}>
            {comment.author_role}
          </Tag>
          {comment.comment_type !== 'general' && (
            <Tag>{comment.comment_type}</Tag>
          )}
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatRelativeTime(comment.created_at)}
          </Text>
        </Space>
        <Paragraph style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}>
          {comment.text}
        </Paragraph>
        {comment.comment_type === 'metric' && comment.field && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            on {comment.field} ({comment.month})
          </Text>
        )}
        <div>
          <Button
            type="link"
            size="small"
            icon={<MessageOutlined />}
            onClick={() => onReply(comment.id)}
            style={{ paddingLeft: 0 }}
          >
            Reply
          </Button>
        </div>
      </div>
      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          depth={depth + 1}
          onReply={onReply}
        />
      ))}
    </div>
  );
}

export function CommentsPanel({ cycleId, open, onClose }: CommentsPanelProps) {
  const { profile } = useAuth();
  const [comments, setComments] = useState<OtbComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New comment form state
  const [text, setText] = useState('');
  const [commentType, setCommentType] = useState<CommentType>('general');
  const [replyToId, setReplyToId] = useState<string | null>(null);

  // Inline reply state
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/comments`);
      if (!res.ok) {
        const err = await res.json();
        message.error(err.error ?? 'Failed to load comments');
        return;
      }
      const data = await res.json();
      setComments(data);
    } catch {
      message.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    if (open) {
      fetchComments();
      // Reset reply state on open
      setReplyToId(null);
      setReplyText('');
    }
  }, [open, fetchComments]);

  const threadTree = useMemo(() => buildThreadTree(comments), [comments]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          comment_type: commentType,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        message.error(err.error ?? 'Failed to post comment');
        return;
      }
      setText('');
      setCommentType('general');
      await fetchComments();
    } catch {
      message.error('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!replyText.trim()) return;
    setReplySubmitting(true);
    try {
      // Find parent to inherit its comment_type
      const parent = comments.find((c) => c.id === parentId);
      const res = await fetch(`/api/cycles/${cycleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: replyText.trim(),
          comment_type: parent?.comment_type ?? 'general',
          parent_id: parentId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        message.error(err.error ?? 'Failed to post reply');
        return;
      }
      setReplyText('');
      setReplyToId(null);
      await fetchComments();
    } catch {
      message.error('Failed to post reply');
    } finally {
      setReplySubmitting(false);
    }
  };

  const handleReplyClick = (parentId: string) => {
    setReplyToId(parentId);
    setReplyText('');
  };

  return (
    <Drawer
      title="Comments"
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
      styles={{ body: { display: 'flex', flexDirection: 'column', padding: '16px' } }}
    >
      {/* New Comment Form */}
      <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f0f0f0' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment..."
            autoSize={{ minRows: 2, maxRows: 6 }}
          />
          <Space>
            <Select
              value={commentType}
              onChange={setCommentType}
              options={COMMENT_TYPE_OPTIONS}
              style={{ width: 120 }}
              size="small"
            />
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
          </Space>
        </Space>
      </div>

      {/* Comments List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <List loading />
        ) : threadTree.length === 0 ? (
          <Text type="secondary">No comments yet. Be the first to comment.</Text>
        ) : (
          threadTree.map((comment) => (
            <div key={comment.id}>
              <CommentItem
                comment={comment}
                depth={0}
                onReply={handleReplyClick}
              />
              {/* Inline reply form */}
              {replyToId === comment.id && (
                <div style={{ marginLeft: 24, marginBottom: 12 }}>
                  <Space direction="vertical" style={{ width: '100%' }} size={4}>
                    <TextArea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      autoSize={{ minRows: 1, maxRows: 4 }}
                      autoFocus
                    />
                    <Space size={4}>
                      <Button
                        type="primary"
                        size="small"
                        loading={replySubmitting}
                        disabled={!replyText.trim()}
                        onClick={() => handleReply(comment.id)}
                      >
                        Reply
                      </Button>
                      <Button
                        size="small"
                        onClick={() => setReplyToId(null)}
                      >
                        Cancel
                      </Button>
                    </Space>
                  </Space>
                </div>
              )}
              {/* Also handle reply to nested comments */}
              {comment.replies?.map((reply) =>
                replyToId === reply.id ? (
                  <div key={`reply-form-${reply.id}`} style={{ marginLeft: 48, marginBottom: 12 }}>
                    <Space direction="vertical" style={{ width: '100%' }} size={4}>
                      <TextArea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply..."
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        autoFocus
                      />
                      <Space size={4}>
                        <Button
                          type="primary"
                          size="small"
                          loading={replySubmitting}
                          disabled={!replyText.trim()}
                          onClick={() => handleReply(reply.id)}
                        >
                          Reply
                        </Button>
                        <Button
                          size="small"
                          onClick={() => setReplyToId(null)}
                        >
                          Cancel
                        </Button>
                      </Space>
                    </Space>
                  </div>
                ) : null
              )}
            </div>
          ))
        )}
      </div>
    </Drawer>
  );
}
