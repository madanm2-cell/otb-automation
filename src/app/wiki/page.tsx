// src/app/wiki/page.tsx
'use client';

import { Anchor, Collapse, Table, Tag, Typography } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { COLORS, SPACING } from '@/lib/designTokens';
import { ProcessSteps } from '@/components/wiki/ProcessSteps';
import { PermissionMatrix } from '@/components/wiki/PermissionMatrix';
import {
  MASTER_DATA_FIELDS,
  DEFAULTS_FIELDS,
  UPLOAD_INPUT_FIELDS,
  GD_INPUT_FIELDS,
  SYSTEM_POPULATED_FIELDS,
  CALCULATED_FIELDS,
  SUGGESTED_FIELDS,
  GLOSSARY_TERMS,
} from '@/lib/wiki-content';

const { Title, Text } = Typography;

const HEADER_OFFSET = 80;

// ── Field Reference ───────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Title level={5} style={{ color: COLORS.textPrimary, marginBottom: SPACING.md, marginTop: 0 }}>
      {children}
    </Title>
  );
}

function SectionIntro({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        color: COLORS.textSecondary,
        fontSize: 13,
        display: 'block',
        marginBottom: SPACING.lg,
        lineHeight: 1.6,
      }}
    >
      {children}
    </Text>
  );
}

function SubHeading({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <Title
      level={5}
      style={{
        fontSize: 13,
        color: color ?? COLORS.textSecondary,
        marginBottom: SPACING.sm,
        marginTop: 0,
      }}
    >
      {children}
    </Title>
  );
}

function FieldReference() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.xxl }}>

      {/* Master Data */}
      <div id="master-data" style={{ scrollMarginTop: HEADER_OFFSET }}>
        <SectionTitle>Master Data</SectionTitle>
        <SectionIntro>
          Structural dimensions that define the planning hierarchy. Managed by Admin and Planning
          in the Master Data admin screen.
        </SectionIntro>
        <Table
          dataSource={MASTER_DATA_FIELDS.map((r, i) => ({ ...r, key: i }))}
          columns={[
            {
              title: 'Field',
              dataIndex: 'field',
              key: 'field',
              width: 160,
              render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
            },
            {
              title: 'Description',
              dataIndex: 'description',
              key: 'description',
              render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
            },
            {
              title: 'Managed By',
              dataIndex: 'managedBy',
              key: 'managedBy',
              width: 160,
              render: (v: string) => (
                <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{v}</Text>
              ),
            },
          ]}
          pagination={false}
          size="small"
          bordered
        />
      </div>

      {/* Defaults */}
      <div id="defaults" style={{ scrollMarginTop: HEADER_OFFSET }}>
        <SectionTitle>Defaults</SectionTitle>
        <SectionIntro>
          Per-row reference values that seed the planning grid. Sourced from master defaults;
          Planning can override them during the Confirm Defaults step.
        </SectionIntro>
        <Table
          dataSource={DEFAULTS_FIELDS.map((r, i) => ({ ...r, key: i }))}
          columns={[
            {
              title: 'Field',
              dataIndex: 'field',
              key: 'field',
              width: 200,
              render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
            },
            {
              title: 'Description',
              dataIndex: 'description',
              key: 'description',
              render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
            },
            {
              title: 'Scoped By',
              dataIndex: 'scopedBy',
              key: 'scopedBy',
              width: 260,
              render: (v: string) => (
                <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{v}</Text>
              ),
            },
            {
              title: 'Editable By',
              dataIndex: 'editableBy',
              key: 'editableBy',
              width: 140,
              render: (v: string) => (
                <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>{v}</Text>
              ),
            },
          ]}
          pagination={false}
          size="small"
          bordered
        />
      </div>

      {/* Upload Inputs */}
      <div id="upload-inputs" style={{ scrollMarginTop: HEADER_OFFSET }}>
        <SectionTitle>Upload Inputs</SectionTitle>
        <SectionIntro>
          Data that enters the system through file uploads before the planning grid is generated.
        </SectionIntro>
        <Table
          dataSource={UPLOAD_INPUT_FIELDS.map((r, i) => ({ ...r, key: i }))}
          columns={[
            {
              title: 'Field',
              dataIndex: 'field',
              key: 'field',
              width: 240,
              render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
            },
            {
              title: 'Source File',
              dataIndex: 'sourceFile',
              key: 'sourceFile',
              width: 180,
              render: (v: string) => <Tag>{v}</Tag>,
            },
            {
              title: 'Description',
              dataIndex: 'description',
              key: 'description',
              render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
            },
            {
              title: 'Required',
              dataIndex: 'required',
              key: 'required',
              width: 100,
              render: (v: string) => (
                <Text
                  style={{
                    fontSize: 12,
                    color:
                      v === 'Yes'
                        ? COLORS.success
                        : v === 'No'
                        ? COLORS.textMuted
                        : COLORS.warning,
                  }}
                >
                  {v}
                </Text>
              ),
            },
          ]}
          pagination={false}
          size="small"
          bordered
        />
      </div>

      {/* Grid Fields */}
      <div id="grid-fields" style={{ scrollMarginTop: HEADER_OFFSET }}>
        <SectionTitle>Grid Fields</SectionTitle>
        <SectionIntro>
          All columns visible in the planning grid, organised by type.
        </SectionIntro>

        <SubHeading color={COLORS.accent}>Growth Director Inputs (editable)</SubHeading>
        <Table
          dataSource={GD_INPUT_FIELDS.map((r, i) => ({ ...r, key: i }))}
          columns={[
            {
              title: 'Field',
              dataIndex: 'field',
              key: 'field',
              width: 200,
              render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
            },
            {
              title: 'Description',
              dataIndex: 'description',
              key: 'description',
              render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
            },
          ]}
          pagination={false}
          size="small"
          bordered
          style={{ marginBottom: SPACING.xl }}
        />

        <SubHeading>System-Populated (read-only, pre-filled from uploads)</SubHeading>
        <Table
          dataSource={SYSTEM_POPULATED_FIELDS.map((r, i) => ({ ...r, key: i }))}
          columns={[
            {
              title: 'Field',
              dataIndex: 'field',
              key: 'field',
              width: 260,
              render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
            },
            {
              title: 'Source',
              dataIndex: 'source',
              key: 'source',
              render: (v: string) => (
                <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>{v}</Text>
              ),
            },
          ]}
          pagination={false}
          size="small"
          bordered
          style={{ marginBottom: SPACING.xl }}
        />

        <SubHeading>Calculated Fields (read-only, auto-computed)</SubHeading>
        <Table
          dataSource={CALCULATED_FIELDS.map((r, i) => ({ ...r, key: i }))}
          columns={[
            {
              title: 'Field',
              dataIndex: 'field',
              key: 'field',
              width: 280,
              render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
            },
            {
              title: 'Formula',
              dataIndex: 'formula',
              key: 'formula',
              width: 360,
              render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
            },
            {
              title: 'Description',
              dataIndex: 'description',
              key: 'description',
              render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
            },
          ]}
          pagination={false}
          size="small"
          bordered
          style={{ marginBottom: SPACING.xl }}
        />

        <SubHeading color={COLORS.info}>Suggested (system recommendation)</SubHeading>
        <Table
          dataSource={SUGGESTED_FIELDS.map((r, i) => ({ ...r, key: i }))}
          columns={[
            {
              title: 'Field',
              dataIndex: 'field',
              key: 'field',
              width: 280,
              render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
            },
            {
              title: 'Formula',
              dataIndex: 'formula',
              key: 'formula',
              width: 360,
              render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
            },
            {
              title: 'Description',
              dataIndex: 'description',
              key: 'description',
              render: (v: string) => <Text style={{ fontSize: 13 }}>{v}</Text>,
            },
          ]}
          pagination={false}
          size="small"
          bordered
        />
      </div>
    </div>
  );
}

// ── Glossary ──────────────────────────────────────

function Glossary() {
  return (
    <div>
      {GLOSSARY_TERMS.map((term, i) => (
        <div
          key={term.term}
          style={{
            display: 'grid',
            gridTemplateColumns: '220px 1fr',
            gap: SPACING.lg,
            padding: `${SPACING.sm}px ${SPACING.md}px`,
            borderBottom:
              i < GLOSSARY_TERMS.length - 1 ? `1px solid ${COLORS.borderLight}` : 'none',
          }}
        >
          <Text strong style={{ fontSize: 13, color: COLORS.textPrimary }}>
            {term.term}
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6 }}>
            {term.definition}
          </Text>
        </div>
      ))}
    </div>
  );
}

// ── Panel label ───────────────────────────────────

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.textPrimary }}>
      {children}
    </span>
  );
}

// ── TOC items ─────────────────────────────────────

const TOC_ITEMS = [
  { key: 'otb-process', href: '#otb-process', title: 'OTB Process' },
  {
    key: 'field-reference',
    href: '#field-reference',
    title: 'Field Reference',
    children: [
      { key: 'master-data', href: '#master-data', title: 'Master Data' },
      { key: 'defaults', href: '#defaults', title: 'Defaults' },
      { key: 'upload-inputs', href: '#upload-inputs', title: 'Upload Inputs' },
      { key: 'grid-fields', href: '#grid-fields', title: 'Grid Fields' },
    ],
  },
  { key: 'roles-permissions', href: '#roles-permissions', title: 'Roles & Permissions' },
  { key: 'glossary', href: '#glossary', title: 'Glossary' },
];

// ── Main page ─────────────────────────────────────

export default function WikiPage() {
  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: SPACING.xxl }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.sm,
            marginBottom: SPACING.sm,
          }}
        >
          <BookOutlined style={{ fontSize: 20, color: COLORS.accent }} />
          <Title level={3} style={{ margin: 0, color: COLORS.textPrimary }}>
            Wiki
          </Title>
        </div>
        <Text style={{ color: COLORS.textSecondary, fontSize: 14 }}>
          Reference documentation for the OTB planning platform — process overview, field
          definitions, and user roles.
        </Text>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start' }}>

        {/* Main content */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACING.lg,
          }}
        >
          {/* Panel 1: OTB Process */}
          <div id="otb-process" style={{ scrollMarginTop: HEADER_OFFSET }}>
            <Collapse
              defaultActiveKey={['1']}
              items={[
                {
                  key: '1',
                  label: <PanelLabel>OTB Process</PanelLabel>,
                  children: <ProcessSteps />,
                  forceRender: true,
                },
              ]}
            />
          </div>

          {/* Panel 2: Field Reference */}
          <div id="field-reference" style={{ scrollMarginTop: HEADER_OFFSET }}>
            <Collapse
              defaultActiveKey={['1']}
              items={[
                {
                  key: '1',
                  label: <PanelLabel>Field Reference</PanelLabel>,
                  children: <FieldReference />,
                  forceRender: true,
                },
              ]}
            />
          </div>

          {/* Panel 3: Roles & Permissions */}
          <div id="roles-permissions" style={{ scrollMarginTop: HEADER_OFFSET }}>
            <Collapse
              defaultActiveKey={['1']}
              items={[
                {
                  key: '1',
                  label: <PanelLabel>Roles & Permissions</PanelLabel>,
                  children: <PermissionMatrix />,
                  forceRender: true,
                },
              ]}
            />
          </div>

          {/* Panel 4: Glossary */}
          <div id="glossary" style={{ scrollMarginTop: HEADER_OFFSET }}>
            <Collapse
              defaultActiveKey={['1']}
              items={[
                {
                  key: '1',
                  label: <PanelLabel>Glossary</PanelLabel>,
                  children: <Glossary />,
                  forceRender: true,
                },
              ]}
            />
          </div>
        </div>

        {/* Sticky TOC */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            position: 'sticky',
            top: HEADER_OFFSET,
            alignSelf: 'flex-start',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: COLORS.textMuted,
              display: 'block',
              marginBottom: SPACING.sm,
            }}
          >
            On this page
          </Text>
          <Anchor offsetTop={HEADER_OFFSET} items={TOC_ITEMS} />
        </div>
      </div>
    </div>
  );
}
