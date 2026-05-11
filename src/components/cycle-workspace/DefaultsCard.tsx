'use client';

import { useState } from 'react';
import { Card, Button, Space, Tag } from 'antd';
import {
  CheckCircleOutlined,
  DownOutlined,
  UpOutlined,
} from '@ant-design/icons';
import type { OtbCycle } from '@/types/otb';
import { CycleDefaultsReview } from '@/components/CycleDefaultsReview';

interface Props {
  cycle: OtbCycle;
  onConfirmed?: () => void;
}

export function DefaultsCard({ cycle, onConfirmed }: Props) {
  const defaultOpen = !cycle.defaults_confirmed && cycle.status === 'Draft';
  const [open, setOpen] = useState<boolean>(defaultOpen);

  const titleNode = <span>Defaults</span>;

  const extraNode = (
    <Space size={12}>
      {cycle.defaults_confirmed ? (
        <Tag icon={<CheckCircleOutlined />} color="success">
          Confirmed
        </Tag>
      ) : (
        <Tag color="default">Not confirmed</Tag>
      )}
      <Button
        type="text"
        size="small"
        icon={open ? <UpOutlined /> : <DownOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label={open ? 'Collapse' : 'Expand'}
      />
    </Space>
  );

  return (
    <Card
      title={titleNode}
      extra={extraNode}
      size="small"
      styles={{ body: { display: open ? 'block' : 'none', padding: 16 } }}
    >
      <CycleDefaultsReview
        cycleId={cycle.id}
        cycleStatus={cycle.status}
        onConfirmed={() => onConfirmed?.()}
      />
    </Card>
  );
}
