'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Upload, Button, Typography, Alert, Table, Space, Tag } from 'antd';
import {
  InboxOutlined,
  DownOutlined,
  UpOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Text, Paragraph } = Typography;
const { Dragger } = Upload;

interface ActualsRow {
  sub_brand: string;
  wear_type: string;
  sub_category: string;
  gender: string;
  channel: string;
  month: string;
  actual_nsq: number | null;
  actual_inwards_qty: number | null;
  actual_gmv: number | null;
  actual_nsv: number | null;
  actual_closing_stock_qty: number | null;
  actual_doh: number | null;
}

const previewColumns = [
  { title: 'Month', dataIndex: 'month', key: 'month', width: 100, fixed: 'left' as const },
  { title: 'Sub Brand', dataIndex: 'sub_brand', key: 'sub_brand', width: 110 },
  { title: 'Wear Type', dataIndex: 'wear_type', key: 'wear_type', width: 110 },
  { title: 'Sub Category', dataIndex: 'sub_category', key: 'sub_category', width: 130 },
  { title: 'Gender', dataIndex: 'gender', key: 'gender', width: 80 },
  { title: 'Channel', dataIndex: 'channel', key: 'channel', width: 100 },
  { title: 'NSQ', dataIndex: 'actual_nsq', key: 'actual_nsq', width: 90, align: 'right' as const,
    render: (v: number | null) => v?.toLocaleString() ?? '—' },
  { title: 'Inwards', dataIndex: 'actual_inwards_qty', key: 'actual_inwards_qty', width: 90, align: 'right' as const,
    render: (v: number | null) => v?.toLocaleString() ?? '—' },
  { title: 'GMV', dataIndex: 'actual_gmv', key: 'actual_gmv', width: 110, align: 'right' as const,
    render: (v: number | null) => v != null ? `₹${v.toLocaleString()}` : '—' },
  { title: 'NSV', dataIndex: 'actual_nsv', key: 'actual_nsv', width: 110, align: 'right' as const,
    render: (v: number | null) => v != null ? `₹${v.toLocaleString()}` : '—' },
  { title: 'Closing Stock', dataIndex: 'actual_closing_stock_qty', key: 'actual_closing_stock_qty', width: 110, align: 'right' as const,
    render: (v: number | null) => v?.toLocaleString() ?? '—' },
  { title: 'DoH', dataIndex: 'actual_doh', key: 'actual_doh', width: 80, align: 'right' as const,
    render: (v: number | null) => v != null ? v.toFixed(1) : '—' },
];

interface ValidationError {
  row: number;
  field: string;
  rule: string;
  message: string;
}

interface UploadResult {
  success: boolean;
  rowCount?: number;
  unmatchedCount?: number;
  errors?: ValidationError[];
}

const errorColumns = [
  { title: 'Row', dataIndex: 'row', key: 'row', width: 80 },
  { title: 'Field', dataIndex: 'field', key: 'field', width: 140 },
  { title: 'Rule', dataIndex: 'rule', key: 'rule', width: 140 },
  { title: 'Message', dataIndex: 'message', key: 'message' },
];

export function ActualsUploadCard({
  cycleId,
  onActualsUploaded,
}: {
  cycleId: string;
  onActualsUploaded?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [open, setOpen] = useState<boolean>(true);
  const [preview, setPreview] = useState<ActualsRow[] | null>(null);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewTruncated, setPreviewTruncated] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/cycles/${cycleId}/actuals/preview?limit=500`);
      if (!res.ok) return;
      const data = await res.json();
      setPreview(data.rows ?? []);
      setPreviewTotal(data.total ?? 0);
      setPreviewTruncated(!!data.truncated);
    } finally {
      setPreviewLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/cycles/${cycleId}/actuals/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok && !data.errors) {
        setResult({ success: false, errors: [{ row: 0, field: '-', rule: '-', message: data.error || 'Upload failed' }] });
        return;
      }

      if (data.errors && data.errors.length > 0) {
        setResult({ success: false, errors: data.errors });
      } else {
        setResult({
          success: true,
          rowCount: data.rowCount ?? data.row_count ?? 0,
          unmatchedCount: data.unmatchedCount ?? data.unmatched_count ?? 0,
        });
        onActualsUploaded?.();
        loadPreview();
      }
    } catch {
      setResult({ success: false, errors: [{ row: 0, field: '-', rule: '-', message: 'Network error. Please try again.' }] });
    } finally {
      setUploading(false);
    }
  };

  const titleNode = (
    <Space size={8}>
      <span>Actuals</span>
    </Space>
  );

  const extraNode = (
    <Space size={12}>
      <Button
        type="text"
        size="small"
        icon={open ? <UpOutlined /> : <DownOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(o => !o);
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
      <Card style={{ marginBottom: 16 }} size="small">
        <Paragraph>
          Upload a CSV file containing actuals data for this cycle. The file must include the following columns:
        </Paragraph>
        <Paragraph>
          <Text code>sub_brand</Text>, <Text code>sub_category</Text>, <Text code>gender</Text>,{' '}
          <Text code>channel</Text>, <Text code>month</Text>, <Text code>actual_nsq</Text>,{' '}
          <Text code>actual_inwards_qty</Text>
        </Paragraph>
        <Paragraph type="secondary">
          Month format: <Text code>YYYY-MM-DD</Text> (first day of month, e.g. 2026-04-01)
        </Paragraph>
        <Paragraph type="warning">
          Only approved cycles accept actuals uploads.
        </Paragraph>
      </Card>

      <Card title="Upload Actuals CSV" size="small">
        <Dragger
          accept=".csv"
          showUploadList={false}
          disabled={uploading}
          customRequest={({ file }) => {
            handleUpload(file as File);
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            {uploading ? 'Uploading & validating...' : 'Click or drag CSV file here'}
          </p>
          <p className="ant-upload-hint">
            Only .csv files are accepted.
          </p>
        </Dragger>

        {uploading && (
          <Alert
            type="info"
            message="Uploading..."
            description="Your file is being uploaded and validated. Please wait."
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {result?.success && (
          <Alert
            type="success"
            message="Actuals uploaded successfully"
            description={
              <div>
                <p>{result.rowCount} row(s) imported.</p>
                {(result.unmatchedCount ?? 0) > 0 && (
                  <p style={{ color: '#faad14' }}>
                    Warning: {result.unmatchedCount} row(s) did not match existing plan rows and were skipped.
                  </p>
                )}
              </div>
            }
            showIcon
            style={{ marginTop: 16 }}
          />
        )}

        {result && !result.success && result.errors && result.errors.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Alert
              type="error"
              message="Validation failed"
              description={`${result.errors.length} error(s) found. Please fix and re-upload.`}
              showIcon
              style={{ marginBottom: 12 }}
            />
            <Table
              dataSource={result.errors.map((e, i) => ({ ...e, key: i }))}
              columns={errorColumns}
              size="small"
              pagination={{ pageSize: 10 }}
            />
          </div>
        )}
      </Card>

      {/* Uploaded actuals preview — multiple uploads upsert into one logical dataset,
          so this is the source of truth for what's currently in the system. */}
      {(previewLoading || preview !== null) && (
        <Card
          size="small"
          style={{ marginTop: 16 }}
          title={
            <Space>
              <span>Uploaded Actuals</span>
              {previewTotal > 0 && <Tag>{previewTotal.toLocaleString()} rows</Tag>}
              {previewTruncated && <Tag color="warning">Showing first {preview?.length ?? 0}</Tag>}
            </Space>
          }
          extra={
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={loadPreview}
              loading={previewLoading}
            >
              Refresh
            </Button>
          }
        >
          {preview && preview.length === 0 ? (
            <Text type="secondary">No actuals uploaded yet.</Text>
          ) : (
            <Table
              dataSource={preview?.map((r, i) => ({ ...r, key: i }))}
              columns={previewColumns}
              size="small"
              pagination={{ pageSize: 20, showSizeChanger: false }}
              scroll={{ x: 'max-content' }}
              loading={previewLoading}
            />
          )}
        </Card>
      )}
    </Card>
  );
}
