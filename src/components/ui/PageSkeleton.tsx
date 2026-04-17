'use client';

import { Skeleton, Card, Row, Col } from 'antd';
import { CARD_STYLES, SPACING } from '@/lib/designTokens';

export function DashboardSkeleton() {
  return (
    <div>
      <Skeleton title={{ width: 200 }} paragraph={false} active style={{ marginBottom: SPACING.xl }} />
      <Row gutter={[16, 16]} style={{ marginBottom: SPACING.xl }}>
        {[1, 2, 3, 4, 5].map(i => (
          <Col key={i} xs={24} sm={12} lg={4}>
            <Card style={CARD_STYLES}>
              <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={14}>
          <Card style={CARD_STYLES}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card style={CARD_STYLES}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export function TablePageSkeleton() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: SPACING.xl }}>
        <Skeleton title={{ width: 180 }} paragraph={false} active />
        <Skeleton.Button active />
      </div>
      <Row gutter={[16, 16]} style={{ marginBottom: SPACING.xl }}>
        {[1, 2, 3, 4].map(i => (
          <Col key={i} xs={12} lg={6}>
            <Card style={CARD_STYLES}>
              <Skeleton active paragraph={{ rows: 1 }} title={{ width: '50%' }} />
            </Card>
          </Col>
        ))}
      </Row>
      <Card style={CARD_STYLES}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    </div>
  );
}
