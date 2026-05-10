'use client';

import { useState, useMemo, useCallback } from 'react';
import { Tabs, Select, Typography, Table, Collapse } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { COLORS, SPACING } from '@/lib/designTokens';
import { formatCrore, formatQty } from '@/lib/formatting';
import type { VarianceReportData, VarianceRow, VarianceLevel, VarianceMetric } from '@/types/otb';

const { Title, Text } = Typography;

// ─── Metric config ────────────────────────────────────────────────────────────

const METRIC_KEYS = ['gmv', 'nsv', 'nsq', 'inwards', 'closing_stock', 'doh'] as const;
type MetricKey = typeof METRIC_KEYS[number];

const METRIC_LABELS: Record<MetricKey, string> = {
  gmv: 'GMV (₹ Cr)',
  nsv: 'NSV (₹ Cr)',
  nsq: 'NSQ (Units)',
  inwards: 'Inwards (Units)',
  closing_stock: 'Closing Stock (₹ Cr)',
  doh: 'DOH (Days)',
};

const POSITION_METRICS = new Set<MetricKey>(['closing_stock', 'doh']);

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtValue(key: MetricKey, value: number | null): string {
  if (value == null) return '—';
  if (key === 'nsq' || key === 'inwards') return formatQty(value);
  if (key === 'doh') return value.toFixed(1) + ' d';
  return formatCrore(value);
}

const LEVEL_STYLE: Record<VarianceLevel, React.CSSProperties> = {
  green: { color: '#389e0d', fontWeight: 600 },
  yellow: { color: '#d46b08', fontWeight: 600 },
  red: { color: '#cf1322', fontWeight: 600 },
};

function VarPctCell({ metric }: { metric: Pick<VarianceMetric, 'variance_pct' | 'level'> | null }) {
  if (!metric || metric.variance_pct == null) return <span style={{ color: COLORS.textMuted }}>—</span>;
  const sign = metric.variance_pct > 0 ? '+' : '';
  return (
    <span style={LEVEL_STYLE[metric.level]}>
      {sign}{metric.variance_pct.toFixed(1)}%
    </span>
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
    const lastMonth = actualsMonths[actualsMonths.length - 1];
    const subset = lastMonth ? rows.filter(r => r.month === lastMonth) : rows;
    for (const r of subset) {
      const m = r[key];
      if (m.planned != null) planned = (planned ?? 0) + m.planned;
      if (m.actual != null) actual = (actual ?? 0) + m.actual;
    }
  } else {
    for (const r of rows) {
      const m = r[key];
      if (m.planned != null) planned = (planned ?? 0) + m.planned;
      if (m.actual != null) actual = (actual ?? 0) + m.actual;
    }
  }

  const variance_pct = actual != null && planned != null && planned !== 0
    ? ((actual - planned) / planned) * 100
    : null;

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

// ─── Shared column builder ────────────────────────────────────────────────────

type PlanCell = (_: unknown, row: { key: MetricKey }) => React.ReactNode;
type AggCell = (_: unknown, row: { key: MetricKey }) => React.ReactNode;
type VarCell = (_: unknown, row: { key: MetricKey }) => React.ReactNode;

const GROUP_BORDER = { borderLeft: '2px solid #bfbfbf' };

function monthColumns(
  months: string[],
  actualsMonths: string[],
  planFn: (m: string) => PlanCell,
  actualFn: (m: string) => AggCell,
  varFn: (m: string) => VarCell,
) {
  return months.map(m => ({
    title: shortMonth(m),
    key: m,
    onHeaderCell: () => ({ style: GROUP_BORDER }),
    children: [
      {
        title: 'Plan', key: `${m}_p`, width: 100,
        onHeaderCell: () => ({ style: GROUP_BORDER }),
        onCell: () => ({ style: GROUP_BORDER }),
        render: planFn(m),
      },
      {
        title: 'Actual', key: `${m}_a`, width: 100,
        render: actualsMonths.includes(m) ? actualFn(m) : () => <span style={{ color: COLORS.textMuted }}>—</span>,
      },
      {
        title: 'Var%', key: `${m}_v`, width: 80, align: 'right' as const,
        render: actualsMonths.includes(m) ? varFn(m) : () => <span style={{ color: COLORS.textMuted }}>—</span>,
      },
    ],
  }));
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

  const byMonth = useMemo(
    () => Object.fromEntries(
      all_months.map(m => [m, aggregateRows(filteredRows.filter(r => r.month === m), [m])])
    ),
    [filteredRows, all_months],
  );

  const qTotal = useMemo(
    () => aggregateRows(filteredRows.filter(r => actuals_months.includes(r.month)), actuals_months),
    [filteredRows, actuals_months],
  );

  const qLabel = `Q Total (${actuals_months.length}/${all_months.length})`;

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
    ...monthColumns(
      all_months, actuals_months,
      m => (_, row) => <span>{fmtValue(row.key, byMonth[m]?.[row.key]?.planned ?? null)}</span>,
      m => (_, row) => <strong>{fmtValue(row.key, byMonth[m]?.[row.key]?.actual ?? null)}</strong>,
      m => (_, row) => <VarPctCell metric={byMonth[m]?.[row.key] ?? null} />,
    ),
    {
      title: qLabel,
      key: 'qtotal',
      children: [
        {
          title: 'Plan', key: 'q_p', width: 110,
          onHeaderCell: () => ({ style: GROUP_BORDER }),
          onCell: () => ({ style: GROUP_BORDER }),
          render: (_: unknown, row: { key: MetricKey }) =>
            <span>{fmtValue(row.key, qTotal[row.key]?.planned ?? null)}</span>,
        },
        {
          title: 'Actual', key: 'q_a', width: 110,
          render: (_: unknown, row: { key: MetricKey }) =>
            <strong>{fmtValue(row.key, qTotal[row.key]?.actual ?? null)}</strong>,
        },
        {
          title: 'Var%', key: 'q_v', width: 90, align: 'right' as const,
          render: (_: unknown, row: { key: MetricKey }) =>
            <VarPctCell metric={qTotal[row.key] ?? null} />,
        },
      ],
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
      ...monthColumns(
        all_months, actuals_months,
        m => (_, row) => <span>{fmtValue(row.key, catByMonth[m]?.[row.key]?.planned ?? null)}</span>,
        m => (_, row) => <strong>{fmtValue(row.key, catByMonth[m]?.[row.key]?.actual ?? null)}</strong>,
        m => (_, row) => <VarPctCell metric={catByMonth[m]?.[row.key] ?? null} />,
      ),
      {
        title: qLabel,
        key: 'qtotal',
        children: [
          {
            title: 'Plan', key: 'q_p', width: 110,
            onHeaderCell: () => ({ style: GROUP_BORDER }),
            onCell: () => ({ style: GROUP_BORDER }),
            render: (_: unknown, row: { key: MetricKey }) =>
              <span>{fmtValue(row.key, catQTotal[row.key]?.planned ?? null)}</span>,
          },
          {
            title: 'Actual', key: 'q_a', width: 110,
            render: (_: unknown, row: { key: MetricKey }) =>
              <strong>{fmtValue(row.key, catQTotal[row.key]?.actual ?? null)}</strong>,
          },
          {
            title: 'Var%', key: 'q_v', width: 90, align: 'right' as const,
            render: (_: unknown, row: { key: MetricKey }) =>
              <VarPctCell metric={catQTotal[row.key] ?? null} />,
          },
        ],
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
        rowClassName={(_, i) => i % 2 === 1 ? 'ant-table-row-striped' : ''}
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
        rowClassName={(_, i) => i % 2 === 1 ? 'ant-table-row-striped' : ''}
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

// ─── Metric Tab ───────────────────────────────────────────────────────────────

interface MetricTabProps {
  metricKey: MetricKey;
  data: VarianceReportData;
  channelFilter: string | null;
}

function MetricTab({ metricKey, data, channelFilter }: MetricTabProps) {
  const { all_months, actuals_months } = data;

  const filteredRows = useMemo(
    () => channelFilter ? data.rows.filter(r => r.channel === channelFilter) : data.rows,
    [data.rows, channelFilter],
  );

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

  const getAgg = useCallback(
    (rows: VarianceRow[], forActualsMonths: string[]) =>
      aggregateMetric(rows, metricKey, forActualsMonths),
    [metricKey],
  );

  const brandByMonth = useMemo(
    () => Object.fromEntries(all_months.map(m => [m, getAgg(filteredRows.filter(r => r.month === m), [m])])),
    [filteredRows, all_months, getAgg],
  );
  const brandQTotal = useMemo(
    () => getAgg(filteredRows.filter(r => actuals_months.includes(r.month)), actuals_months),
    [filteredRows, actuals_months, getAgg],
  );

  const subCatByMonth = useMemo(
    () => Object.fromEntries(
      subCategories.map(cat => {
        const catRows = filteredRows.filter(r => r.sub_category === cat);
        return [cat, Object.fromEntries(all_months.map(m => [m, getAgg(catRows.filter(r => r.month === m), [m])]))];
      })
    ),
    [subCategories, filteredRows, all_months, getAgg],
  );
  const subCatQTotal = useMemo(
    () => Object.fromEntries(
      subCategories.map(cat => {
        const catRows = filteredRows.filter(r => r.sub_category === cat && actuals_months.includes(r.month));
        return [cat, getAgg(catRows, actuals_months)];
      })
    ),
    [subCategories, filteredRows, actuals_months, getAgg],
  );

  const qLabel = `Q Total (${actuals_months.length}/${all_months.length})`;

  interface TabRow { key: string; cat: string; isBrand: boolean }
  const tableRows: TabRow[] = [
    { key: '__brand__', cat: 'Brand Total', isBrand: true },
    ...subCategories.map(cat => ({ key: cat, cat, isBrand: false })),
  ];

  const columns = [
    {
      title: 'Sub-Category', dataIndex: 'cat', key: 'cat', width: 180,
      fixed: 'left' as const,
      render: (v: string, row: TabRow) =>
        row.isBrand ? <Text strong>{v}</Text> : <Text>{v}</Text>,
    },
    ...all_months.map(m => ({
      title: shortMonth(m),
      key: m,
      children: [
        {
          title: 'Plan', key: `${m}_p`, width: 100,
          render: (_: unknown, row: TabRow) => {
            const agg = row.isBrand ? brandByMonth[m] : subCatByMonth[row.cat]?.[m];
            return <span>{fmtValue(metricKey, agg?.planned ?? null)}</span>;
          },
        },
        {
          title: 'Actual', key: `${m}_a`, width: 100,
          render: (_: unknown, row: TabRow) => {
            if (!actuals_months.includes(m)) return <span style={{ color: COLORS.textMuted }}>—</span>;
            const agg = row.isBrand ? brandByMonth[m] : subCatByMonth[row.cat]?.[m];
            return <strong>{fmtValue(metricKey, agg?.actual ?? null)}</strong>;
          },
        },
        {
          title: 'Var%', key: `${m}_v`, width: 80, align: 'right' as const,
          render: (_: unknown, row: TabRow) => {
            if (!actuals_months.includes(m)) return <span style={{ color: COLORS.textMuted }}>—</span>;
            const agg = row.isBrand ? brandByMonth[m] : subCatByMonth[row.cat]?.[m];
            return <VarPctCell metric={agg ?? null} />;
          },
        },
      ],
    })),
    {
      title: qLabel,
      key: 'qtotal',
      children: [
        {
          title: 'Plan', key: 'q_p', width: 110,
          onHeaderCell: () => ({ style: GROUP_BORDER }),
          onCell: () => ({ style: GROUP_BORDER }),
          render: (_: unknown, row: TabRow) => {
            const agg = row.isBrand ? brandQTotal : subCatQTotal[row.cat];
            return <span>{fmtValue(metricKey, agg?.planned ?? null)}</span>;
          },
        },
        {
          title: 'Actual', key: 'q_a', width: 110,
          render: (_: unknown, row: TabRow) => {
            const agg = row.isBrand ? brandQTotal : subCatQTotal[row.cat];
            return <strong>{fmtValue(metricKey, agg?.actual ?? null)}</strong>;
          },
        },
        {
          title: 'Var%', key: 'q_v', width: 90, align: 'right' as const,
          render: (_: unknown, row: TabRow) => {
            const agg = row.isBrand ? brandQTotal : subCatQTotal[row.cat];
            return <VarPctCell metric={agg ?? null} />;
          },
        },
      ],
    },
  ];

  return (
    <Table
      columns={columns as any}
      dataSource={tableRows}
      rowKey="key"
      pagination={false}
      size="small"
      bordered
      scroll={{ x: 'max-content' }}
      rowClassName={(row: TabRow, i) =>
        row.isBrand ? '' : i % 2 === 0 ? '' : 'ant-table-row-striped'
      }
      onRow={(row: TabRow) => ({
        style: row.isBrand ? { fontWeight: 600, background: '#e6f4ff' } : {},
      })}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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

      <div style={{ marginBottom: SPACING.lg, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>Channel:</Text>
        <Select
          style={{ width: 180 }}
          placeholder="All Channels"
          allowClear
          value={channelFilter}
          onChange={v => setChannelFilter(v ?? null)}
          options={data.channels.map(c => ({ label: c, value: c }))}
        />
      </div>

      <div style={{
        border: '1px solid #d9d9d9',
        borderRadius: 8,
        overflow: 'hidden',
        background: '#fff',
      }}>
        <Tabs
          type="card"
          defaultActiveKey="summary"
          tabBarStyle={{
            background: '#f5f5f5',
            margin: 0,
            padding: '10px 16px 0',
            borderBottom: '1px solid #d9d9d9',
          }}
          tabBarGutter={4}
          items={[
            {
              key: 'summary',
              label: 'Summary',
              children: (
                <div style={{ padding: '16px 16px 8px' }}>
                  <SummaryTab data={data} channelFilter={channelFilter} />
                </div>
              ),
            },
            ...([
              { key: 'gmv', label: 'GMV' },
              { key: 'nsv', label: 'NSV' },
              { key: 'nsq', label: 'NSQ' },
              { key: 'inwards', label: 'Inwards' },
              { key: 'closing_stock', label: 'Closing Stock' },
              { key: 'doh', label: 'DOH' },
            ] as { key: MetricKey; label: string }[]).map(({ key, label }) => ({
              key,
              label,
              children: (
                <div style={{ padding: '16px 16px 8px' }}>
                  <MetricTab metricKey={key} data={data} channelFilter={channelFilter} />
                </div>
              ),
            })),
          ]}
        />
      </div>
    </div>
  );
}
