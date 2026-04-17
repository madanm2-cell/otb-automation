'use client';

import { Steps } from 'antd';
import { COLORS } from '@/lib/designTokens';

export interface PipelineStage {
  key: string;
  label: string;
  status: 'completed' | 'active' | 'pending' | 'error';
}

export interface StatusPipelineProps {
  stages: PipelineStage[];
  size?: 'default' | 'small';
}

const STATUS_MAP: Record<PipelineStage['status'], 'finish' | 'process' | 'wait' | 'error'> = {
  completed: 'finish',
  active: 'process',
  pending: 'wait',
  error: 'error',
};

const DOT_COLORS: Record<PipelineStage['status'], string> = {
  completed: COLORS.success,
  active: COLORS.accent,
  pending: COLORS.neutral300,
  error: COLORS.danger,
};

export function StatusPipeline({ stages, size = 'default' }: StatusPipelineProps) {
  const dotSize = size === 'small' ? 10 : 14;

  return (
    <Steps
      size={size}
      progressDot={(dot, { index }) => {
        const stage = stages[index];
        if (!stage) return dot;
        const color = DOT_COLORS[stage.status];
        return (
          <span
            style={{
              display: 'inline-block',
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              backgroundColor: color,
              border: stage.status === 'active' ? `2px solid ${color}` : 'none',
              boxShadow: stage.status === 'active' ? `0 0 0 3px ${color}30` : 'none',
            }}
          />
        );
      }}
      items={stages.map((stage) => ({
        title: (
          <span style={{
            fontSize: size === 'small' ? 11 : 13,
            fontWeight: stage.status === 'active' ? 600 : 400,
            color: stage.status === 'pending' ? COLORS.textMuted : COLORS.textPrimary,
          }}>
            {stage.label}
          </span>
        ),
        status: STATUS_MAP[stage.status],
      }))}
    />
  );
}
