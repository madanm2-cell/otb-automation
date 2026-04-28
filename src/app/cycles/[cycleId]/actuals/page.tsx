'use client';

import { useState } from 'react';
import { Card, Upload, Button, Typography, Alert, Table, Space } from 'antd';
import { InboxOutlined, ArrowLeftOutlined, BarChartOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

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

export default function ActualsUploadPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

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
      }
    } catch {
      setResult({ success: false, errors: [{ row: 0, field: '-', rule: '-', message: 'Network error. Please try again.' }] });
    } finally {
      setUploading(false);
    }
  };

  return (
    <ProtectedRoute permission="upload_actuals">
        <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
          <Space style={{ marginBottom: 16 }}>
            <Link href={`/cycles/${cycleId}`}>
              <Button icon={<ArrowLeftOutlined />}>Back to Cycle</Button>
            </Link>
          </Space>

          <Title level={2}>Upload Actuals</Title>

          <Card style={{ marginBottom: 24 }}>
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

          <Card title="Upload Actuals CSV">
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
                    <Link href={`/cycles/${cycleId}/variance`}>
                      <Button type="primary" icon={<BarChartOutlined />} style={{ marginTop: 8 }}>
                        View Variance Report
                      </Button>
                    </Link>
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
        </div>
    </ProtectedRoute>
  );
}
