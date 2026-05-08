'use client';

import { useState, useMemo } from 'react';
import { Tabs, Select, Typography, Table, Collapse, Tag } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { COLORS, SPACING } from '@/lib/designTokens';
import { formatCrore, formatQty } from '@/lib/formatting';
import type { VarianceReportData, VarianceRow, VarianceLevel, VarianceMetric, VarianceThresholds } from '@/types/otb';

const { Title, Text } = Typography;

// ─── Metric config ────────────────────────────────────────────────────────────

const METRIC_KEYS = ['gmv', 'nsv', 'nsq', 'inwards', 'closing_stock', 'doh'] as const;
type MetricKey = typeof METRIC_KEYS[number];

const METRIC_LABELS: Record<MetricKey, string> = {
  gmv: 'GMV (₹ Cr)',
  nsv: 'NSV (₹ Cr)',
  nsq: 'NSQ (Units)',
  inwards: 'Inwards (₹ Cr)',
  closing_stock: 'Closing Stock (₹ Cr)',
  doh: 'DOH (Days)',
};

const POSITION_METRICS = new Set<MetricKey>(['closing_stock', 'doh']);

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtValue(key: MetricKey, value: number | null): string {
  if (value == null) return '—';
  if (key === 'nsq') return formatQty(value);
  if (key === 'doh') return value.toFixed(1) + ' d';
  return formatCrore(value);
}

const LEVEL_TAG_COLOR: Record<VarianceLevel, string> = {
  green: 'success',
  yellow: 'warning',
  red: 'error',
};

function VarPctCell({ metric }: { metric: Pick<VarianceMetric, 'variance_pct' | 'level'> | null }) {
  if (!metric || metric.variance_pct == null) return <Text type="secondary">—</Text>;
  const sign = metric.variance_pct > 0 ? '+' : '';
  return (
    <Tag color={LEVEL_TAG_COLOR[metric.level]} style={{ fontWeight: 600, fontSize: 12 }}>
      {sign}{metric.variance_pct.toFixed(1)}%
    </Tag>
  );
}

function shortMonth(m: string) {
  return new Date(m).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

interface AggMetric {
  planned: number | null;
  actual: number | null;
  variance_pct: number | null;
  level: VarianceLevel;
}

function aggregateMetric(
  rows: VarianceRow[],
  key: MetricKey,
  actualsMonths: string[],
): AggMetric {
  if (rows.length === 0) return { planned: null, actual: null, variance_pct: null, level: 'green' };

  let planned: number | null = null;
  let actual: number | null = null;

  if (POSITION_METRICS.has(key)) {
    // Use only the last actuals month
    const lastMonth = actualsMonths[actualsMonths.length - 1];
    const subset = lastMonth ? rows.filter(r => r.month === lastMonth) : rows;
    for (const r of subset) {
      const m = r[key];
      if (m.planned != null) planned = (planned ?? 0) + m.planned;
      if (m.actual != null) actual = (actual ?? 0) + m.actual;
    }
  } else {
    // Sum across all rows
    for (const r of rows) {
      const m = r[key];
      if (m.planned != null) planned = (planned ?? 0) + m.planned;
      if (m.actual != null) actual = (actual ?? 0) + m.actual;
    }
  }

  const variance_pct = actual != null && planned != null && planned !== 0
    ? ((actual - planned) / planned) * 100
    : null;

  // Worst level among contributing rows
  const levels = rows.map(r => r[key].level);
  const level: VarianceLevel = levels.includes('red') ? 'red'
    : levels.includes('yellow') ? 'yellow' : 'green';

  return { planned, actual, variance_pct, level };
}

type AggRow = Record<MetricKey, AggMetric>;

function aggregateRows(rows: VarianceRow[], actualsMonths: string[]): AggRow {
  return Object.fromEntries(
    METRIC_KEYS.map(k => [k, aggregateMetric(rows, k, actualsMonths)])
  ) as AggRow;
}

// ─── Summary Tab ─────────────────────────────────────────────────────────────

interface SummaryTabProps {
  data: VarianceReportData;
  channelFilter: string | null;
}

function SummaryTab({ data, channelFilter }: SummaryTabProps) {
  const { all_months, actuals_months } = data;
  const [expanded, setExpanded] = useState<string[]>([]);

  const filteredRows = useMemo(
    () => channelFilter ? data.rows.filter(r => r.channel === channelFilter) : data.rows,
    [data.rows, channelFilter],
  );

  // Brand-level aggregate per month
  const byMonth = useMemo(
    () => Object.fromEntries(
      all_months.map(m => [m, aggregateRows(filteredRows.filter(r => r.month === m), [m])])
    ),
    [filteredRows, all_months],
  );

  // Q-total: aggregate over all actuals months
  const qTotal = useMemo(
    () => aggregateRows(filteredRows.filter(r => actuals_months.includes(r.month)), actuals_months),
    [filteredRows, actuals_months],
  );

  const qLabel = `Q Total (${actuals_months.length}/${all_months.length} months)`;

  // Sub-categories sorted by GMV desc
  const subCategories = useMemo(() => {
    const cats = Array.from(new Set(filteredRows.map(r => r.sub_category)));
    return cats.sort((a, b) => {
      const gmvFor = (cat: string) =>
        filteredRows
          .filter(r => r.sub_category === cat && actuals_months.includes(r.month))
          .reduce((s, r) => s + (r.gmv.actual ?? r.gmv.planned ?? 0), 0);
      return gmvFor(b) - gmvFor(a);
    });
  }, [filteredRows, actuals_months]);

  // Table: metrics as rows, months as column groups
  const tableRows = METRIC_KEYS.map(k => ({ key: k, label: METRIC_LABELS[k] }));

  const columns = [
    {
      title: 'Metric',
      dataIndex: 'label',
      key: 'label',
      width: 190,
      fixed: 'left' as const,
      render: (v: string) => <Text strong>{v}</Text>,
    },
    ...all_months.flatMap(m => [
      {
        title: `${shortMonth(m)} Plan`,
        key: `${m}_p`,
        width: 110,
        render: (_: unknown, row: { key: MetricKey }) => (
          <Text type="secondary">{fmtValue(row.key, byMonth[m]?.[row.key]?.planned ?? null)}</Text>
        ),
      },
      {
        title: `${shortMonth(m)} Actual`,
        key: `${m}_a`,
        width: 110,
        render: (_: unknown, row: { key: MetricKey }) =>
          actuals_months.includes(m)
            ? <Text strong>{fmtValue(row.key, byMonth[m]?.[row.key]?.actual ?? null)}</Text>
            : <Text type="secondary">—</Text>,
      },
      {
        title: `${shortMonth(m)} Var%`,
        key: `${m}_v`,
        width: 90,
        align: 'right' as const,
        render: (_: unknown, row: { key: MetricKey }) =>
          actuals_months.includes(m)
            ? <VarPctCell metric={byMonth[m]?.[row.key] ?? null} />
            : <Text type="secondary">—</Text>,
      },
    ]),
    {
      title: `${qLabel} Plan`,
      key: 'q_p',
      width: 130,
      render: (_: unknown, row: { key: MetricKey }) => (
        <Text type="secondary">{fmtValue(row.key, qTotal[row.key]?.planned ?? null)}</Text>
      ),
    },
    {
      title: `${qLabel} Actual`,
      key: 'q_a',
      width: 130,
      render: (_: unknown, row: { key: MetricKey }) => (
        <Text strong>{fmtValue(row.key, qTotal[row.key]?.actual ?? null)}</Text>
      ),
    },
    {
      title: `${qLabel} Var%`,
      key: 'q_v',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, row: { key: MetricKey }) => (
        <VarPctCell metric={qTotal[row.key] ?? null} />
      ),
    },
  ];

  const buildSubCatTable = (cat: string) => {
    const catRows = filteredRows.filter(r => r.sub_category === cat);
    const catByMonth = Object.fromEntries(
      all_months.map(m => [m, aggregateRows(catRows.filter(r => r.month === m), [m])])
    );
    const catQTotal = aggregateRows(
      catRows.filter(r => actuals_months.includes(r.month)), actuals_months
    );
    const catTableRows = METRIC_KEYS.map(k => ({ key: k, label: METRIC_LABELS[k] }));

    const catColumns = [
      {
        title: 'Metric', dataIndex: 'label', key: 'label', width: 190,
        fixed: 'left' as const,
        render: (v: string) => <Text>{v}</Text>,
      },
      ...all_months.flatMap(m => [
        {
          title: `${shortMonth(m)} Plan`, key: `${m}_p`, width: 110,
          render: (_: unknown, row: { key: MetricKey }) => (
            <Text type="secondary">{fmtValue(row.key, catByMonth[m]?.[row.key]?.planned ?? null)}</Text>
          ),
        },
        {
          title: `${shortMonth(m)} Actual`, key: `${m}_a`, width: 110,
          render: (_: unknown, row: { key: MetricKey }) =>
            actuals_months.includes(m)
              ? <Text strong>{fmtValue(row.key, catByMonth[m]?.[row.key]?.actual ?? null)}</Text>
              : <Text type="secondary">—</Text>,
        },
        {
          title: `${shortMonth(m)} Var%`, key: `${m}_v`, width: 90, align: 'right' as const,
          render: (_: unknown, row: { key: MetricKey }) =>
            actuals_months.includes(m)
              ? <VarPctCell metric={catByMonth[m]?.[row.key] ?? null} />
              : <Text type="secondary">—</Text>,
        },
      ]),
      {
        title: `${qLabel} Plan`, key: 'q_p', width: 130,
        render: (_: unknown, row: { key: MetricKey }) => (
          <Text type="secondary">{fmtValue(row.key, catQTotal[row.key]?.planned ?? null)}</Text>
        ),
      },
      {
        title: `${qLabel} Actual`, key: 'q_a', width: 130,
        render: (_: unknown, row: { key: MetricKey }) => (
          <Text strong>{fmtValue(row.key, catQTotal[row.key]?.actual ?? null)}</Text>
        ),
      },
      {
        title: `${qLabel} Var%`, key: 'q_v', width: 100, align: 'right' as const,
        render: (_: unknown, row: { key: MetricKey }) => (
          <VarPctCell metric={catQTotal[row.key] ?? null} />
        ),
      },
    ];

    return (
      <Table
        key={cat}
        columns={catColumns as any}
        dataSource={catTableRows}
        rowKey="key"
        pagination={false}
        size="small"
        bordered
        scroll={{ x: 'max-content' }}
        style={{ marginBottom: SPACING.lg }}
      />
    );
  };

  return (
    <div>
      <Table
        columns={columns as any}
        dataSource={tableRows}
        rowKey="key"
        pagination={false}
        size="small"
        bordered
        scroll={{ x: 'max-content' }}
        style={{ marginBottom: SPACING.lg }}
      />

      <Collapse
        activeKey={expanded}
        onChange={keys => setExpanded(keys as string[])}
        items={[{
          key: 'detail',
          label: `Sub-Category Breakdown (${subCategories.length} categories, sorted by GMV)`,
          children: (
            <div>
              {subCategories.map(cat => (
                <div key={cat}>
                  <Text strong style={{ display: 'block', marginBottom: 6, marginTop: 12 }}>
                    {cat}
                  </Text>
                  {buildSubCatTable(cat)}
                </div>
              ))}
            </div>
          ),
        }]}
      />
    </div>
  );
}

// ─── Main component (metric tabs added in Task 8) ─────────────────────────────

interface Props {
  data: VarianceReportData;
}

export function VarianceReport({ data }: Props) {
  const [channelFilter, setChannelFilter] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ marginBottom: SPACING.xl }}>
        <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          Variance Report
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {data.cycle_name} · {data.brand_name} · {data.planning_quarter}
          {data.actuals_months.length > 0 && (
            <> · Actuals: {data.actuals_months.map(m => shortMonth(m)).join(', ')}</>
          )}
        </Text>
      </div>

      <div style={{ marginBottom: SPACING.lg }}>
        <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>Channel:</Text>
        <Select
          style={{ width: 180 }}
          placeholder="All Channels"
          allowClear
          value={channelFilter}
          onChange={v => setChannelFilter(v ?? null)}
          options={data.channels.map(c => ({ label: c, value: c }))}
        />
      </div>

      <Tabs
        defaultActiveKey="summary"
        items={[
          {
            key: 'summary',
            label: 'Summary',
            children: <SummaryTab data={data} channelFilter={channelFilter} />,
          },
          // Metric tabs added in Task 8
        ]}
      />
    </div>
  );
}
