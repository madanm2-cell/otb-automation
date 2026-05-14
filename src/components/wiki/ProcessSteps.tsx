// src/components/wiki/ProcessSteps.tsx
'use client';
import React from 'react';

import { Popover, Tag, Typography } from 'antd';
import {
  PlusCircleOutlined,
  UploadOutlined,
  CheckSquareOutlined,
  EditOutlined,
  SendOutlined,
  SafetyCertificateOutlined,
  BarChartOutlined,
  DiffOutlined,
  ArrowRightOutlined,
  ArrowDownOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { COLORS, SHADOWS, SPACING } from '@/lib/designTokens';
import { PROCESS_STEPS } from '@/lib/wiki-content';

const { Text } = Typography;

// One icon per step (indexed 1–8)
const STEP_ICONS = [
  PlusCircleOutlined,       // 1. Create Cycle
  UploadOutlined,           // 2. Upload Reference Files
  CheckSquareOutlined,      // 3. Confirm Defaults
  EditOutlined,             // 4. Growth Director Fills Grid
  SendOutlined,             // 5. Submit for Approval
  SafetyCertificateOutlined, // 6. Approval Chain
  BarChartOutlined,         // 7. Actuals Upload
  DiffOutlined,             // 8. Variance Review
];

// Role → Ant Design tag colour
const ROLE_COLOR: Record<string, string> = {
  Admin: 'red',
  Planning: 'blue',
  'Admin, Planning': 'blue',
  'Growth Director': 'green',
  'Finance, CXO': 'orange',
  'All eligible roles': 'default',
};

// Short one-liner summaries shown inside each box (keep ≤ 8 words)
const SHORT_DESC: string[] = [
  'Brand, quarter, GD & deadlines',
  'Opening stock, LY sales, soft forecast',
  'Review & confirm per-row defaults',
  'Enter NSQ & Inwards, see live calcs',
  'Submit plan → moves to In Review',
  'Finance & CXO approve sequentially',
  'Upload actual NSQ & Inwards',
  'View planned vs. actual variance',
];

// Split 8 steps into two rows of 4
const ROW_A = PROCESS_STEPS.slice(0, 4); // steps 1–4
const ROW_B = PROCESS_STEPS.slice(4, 8); // steps 5–8

function StepBox({ step, index }: { step: (typeof PROCESS_STEPS)[0]; index: number }) {
  const Icon = STEP_ICONS[step.step - 1];
  const roleColor = ROLE_COLOR[step.responsible] ?? 'default';

  const popoverContent = (
    <div style={{ maxWidth: 280 }}>
      <Text style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.65, display: 'block' }}>
        {step.description}
      </Text>
      <div style={{ marginTop: SPACING.sm }}>
        <Tag color={roleColor} style={{ fontSize: 11 }}>{step.responsible}</Tag>
      </div>
    </div>
  );

  return (
    <Popover
      title={
        <span style={{ fontSize: 13, color: COLORS.textPrimary, fontWeight: 600 }}>
          {step.step}. {step.title}
        </span>
      }
      content={popoverContent}
      trigger="click"
      placement="bottom"
    >
      <div
        style={{
          position: 'relative',
          width: 148,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: SPACING.xs,
          padding: `${SPACING.lg}px ${SPACING.md}px ${SPACING.md}px`,
          background: COLORS.surface,
          border: `1.5px solid ${COLORS.border}`,
          borderRadius: 12,
          cursor: 'pointer',
          boxShadow: SHADOWS.card,
          transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = COLORS.accent;
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 3px ${COLORS.accent}22, ${SHADOWS.md}`;
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = COLORS.border;
          (e.currentTarget as HTMLDivElement).style.boxShadow = SHADOWS.card;
          (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        }}
      >
        {/* Step number badge */}
        <div
          style={{
            position: 'absolute',
            top: -12,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: COLORS.accent,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 12,
            boxShadow: `0 2px 6px ${COLORS.accent}55`,
          }}
        >
          {step.step}
        </div>

        {/* Icon */}
        <Icon style={{ fontSize: 22, color: COLORS.accent, marginTop: 4 }} />

        {/* Title */}
        <Text
          strong
          style={{
            fontSize: 12,
            color: COLORS.textPrimary,
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          {step.title}
        </Text>

        {/* Short description */}
        <Text
          style={{
            fontSize: 11,
            color: COLORS.textSecondary,
            textAlign: 'center',
            lineHeight: 1.4,
            minHeight: 30,
          }}
        >
          {SHORT_DESC[index]}
        </Text>

        {/* Role badge */}
        <Tag color={roleColor} style={{ fontSize: 10, margin: 0, marginTop: 2 }}>
          {step.responsible}
        </Tag>
      </div>
    </Popover>
  );
}

function Arrow({ direction = 'right' }: { direction?: 'right' | 'down' | 'left' }) {
  const style: React.CSSProperties = {
    color: COLORS.textMuted,
    flexShrink: 0,
    fontSize: 16,
  };
  if (direction === 'right') return <ArrowRightOutlined style={style} />;
  if (direction === 'left') return <ArrowLeftOutlined style={style} />;
  return <ArrowDownOutlined style={style} />;
}

export function ProcessSteps() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xl, width: 'fit-content' }}>

      {/* Helper text */}
      <Text style={{ fontSize: 12, color: COLORS.textMuted }}>
        Click any step to read the full description.
      </Text>

      {/* Row A — steps 1–4 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' }}>
        {ROW_A.map((step, i) => (
          <React.Fragment key={step.step}>
            <StepBox step={step} index={i} />
            {i < ROW_A.length - 1 && <Arrow direction="right" />}
          </React.Fragment>
        ))}
      </div>

      {/* Turn connector: arrow going down, aligned to the right end of row A */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 0 }}>
        <div
          style={{
            width: 148,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Arrow direction="down" />
        </div>
      </div>

      {/* Row B — steps 5–8, rendered right-to-left so the flow wraps correctly */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.sm,
          flexWrap: 'wrap',
          flexDirection: 'row-reverse',
        }}
      >
        {ROW_B.map((step, i) => (
          <React.Fragment key={step.step}>
            <StepBox step={step} index={i + 4} />
            {i < ROW_B.length - 1 && <Arrow direction="left" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
