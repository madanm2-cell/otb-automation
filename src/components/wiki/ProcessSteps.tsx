// src/components/wiki/ProcessSteps.tsx
'use client';

import { Tag, Typography } from 'antd';
import { COLORS, SPACING } from '@/lib/designTokens';
import { PROCESS_STEPS } from '@/lib/wiki-content';

const { Text } = Typography;

export function ProcessSteps() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md }}>
      {PROCESS_STEPS.map((step) => (
        <div
          key={step.step}
          style={{
            display: 'flex',
            gap: SPACING.lg,
            padding: SPACING.lg,
            background: COLORS.neutral50,
            borderRadius: 8,
            border: `1px solid ${COLORS.borderLight}`,
          }}
        >
          {/* Step number badge */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: COLORS.accent,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            {step.step}
          </div>

          {/* Content */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                marginBottom: SPACING.xs,
                flexWrap: 'wrap',
              }}
            >
              <Text strong style={{ fontSize: 14, color: COLORS.textPrimary }}>
                {step.title}
              </Text>
              <Tag style={{ fontSize: 11, marginLeft: 'auto' }}>{step.responsible}</Tag>
            </div>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>
              {step.description}
            </Text>
          </div>
        </div>
      ))}
    </div>
  );
}
