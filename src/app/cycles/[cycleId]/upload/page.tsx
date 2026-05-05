'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Upload, Button, Tag, Typography, message, Space, Spin } from 'antd';
import { InboxOutlined, DownloadOutlined, ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import type { FileUpload, FileType, ValidationError, CycleStatus } from '@/types/otb';
import { ALL_FILE_TYPES, REQUIRED_FILE_TYPES, FILE_TYPE_LABELS } from '@/types/otb';
import ValidationReport from '@/components/ValidationReport';

const { Title, Text } = Typography;
const { Dragger } = Upload;

export default function UploadPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [cycleStatus, setCycleStatus] = useState<CycleStatus>('Draft');
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<FileType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<{ valid: boolean; errors: ValidationError[]; rowCount: number; warnings?: string[]; refreshedCount?: number } | null>(null);

  const loadUploads = useCallback(() => {
    Promise.all([
      fetch(`/api/cycles/${cycleId}/upload-status`).then(r => r.json()),
      fetch(`/api/cycles/${cycleId}`).then(r => r.json()),
    ])
      .then(([uploadsData, cycleData]) => {
        setUploads(Array.isArray(uploadsData) ? uploadsData : []);
        if (cycleData?.status) setCycleStatus(cycleData.status);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [cycleId]);

  useEffect(() => { loadUploads(); }, [loadUploads]);

  const uploadsByType = new Map(uploads.map(u => [u.file_type, u]));

  const handleUpload = async (file: File) => {
    if (!selectedType) return;
    setUploading(true);
    setLastResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/cycles/${cycleId}/upload/${selectedType}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        message.error(data.error || 'Upload failed');
        return;
      }

      setLastResult({
        valid: data.valid,
        errors: data.errors || [],
        rowCount: data.rowCount,
        warnings: data.warnings,
        refreshedCount: data.refreshedCount,
      });

      if (data.valid) {
        const refreshMsg = data.refreshedCount != null ? ` Grid data refreshed (${data.refreshedCount} rows updated).` : '';
        message.success(`${FILE_TYPE_LABELS[selectedType]} uploaded successfully.${refreshMsg}`);
        if (data.warnings?.length) {
          data.warnings.forEach((w: string) => message.warning(w, 10));
        }
      } else {
        message.error(`Validation failed for ${FILE_TYPE_LABELS[selectedType]}`);
      }

      loadUploads();
    } catch {
      message.error('Network error');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  // Determine which file types are uploadable in current status
  const uploadableTypes = (() => {
    if (cycleStatus === 'Draft') return ALL_FILE_TYPES.filter(ft => ft !== 'actuals');
    if (cycleStatus === 'Filling') return ['ly_sales', 'recent_sales', 'soft_forecast'] as FileType[];
    if (cycleStatus === 'Approved') return ['actuals'] as FileType[];
    return [] as FileType[];
  })();

  return (
    <ProtectedRoute permission="upload_data">
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Link href={`/cycles/${cycleId}`}>
          <Button icon={<ArrowLeftOutlined />}>Back to Cycle</Button>
        </Link>
      </Space>
      <Title level={2}>{cycleStatus === 'Filling' ? 'Re-upload Reference Data' : 'Upload Input Files'}</Title>
      {cycleStatus === 'Filling' && (
        <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, fontSize: 13 }}>
          In Filling status, you can re-upload LY Sales, Recent Sales, and Soft Forecast to refresh grid reference data. Opening stock cannot be changed after template generation.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
        {/* Left: file type cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {uploadableTypes.map(ft => {
            const upload = uploadsByType.get(ft);
            const isRequired = REQUIRED_FILE_TYPES.includes(ft);
            const isSelected = selectedType === ft;
            return (
              <Card
                key={ft}
                size="small"
                hoverable
                onClick={() => { setSelectedType(ft); setLastResult(null); }}
                style={{
                  borderColor: isSelected ? '#1677ff' : upload?.status === 'validated' ? '#52c41a' : upload?.status === 'failed' ? '#ff4d4f' : '#d9d9d9',
                  borderWidth: isSelected ? 2 : 1,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong>{FILE_TYPE_LABELS[ft]}</Text>
                  <Space size={4}>
                    {isRequired && <Tag color="red" style={{ fontSize: 10 }}>Req</Tag>}
                    {upload?.status === 'validated' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                    {upload?.status === 'failed' && <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                  </Space>
                </div>
                {upload && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {upload.file_name} · {upload.row_count} rows
                  </Text>
                )}
              </Card>
            );
          })}
        </div>

        {/* Right: upload zone */}
        <div>
          {selectedType ? (
            <Card title={`Upload: ${FILE_TYPE_LABELS[selectedType]}`}>
              <Space style={{ marginBottom: 16 }}>
                <a href={`/api/templates/${selectedType}`} download>
                  <Button icon={<DownloadOutlined />} size="small">Download Sample CSV</Button>
                </a>
              </Space>
              <Dragger
                accept=".csv,.xlsx,.xls"
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
                  {uploading ? 'Uploading & validating...' : 'Click or drag CSV/XLSX file here'}
                </p>
                <p className="ant-upload-hint">
                  Max 50MB. File will be validated against master data.
                </p>
              </Dragger>

              {lastResult && (
                <>
                  <ValidationReport
                    valid={lastResult.valid}
                    errors={lastResult.errors}
                    rowCount={lastResult.rowCount}
                  />
                  {lastResult.warnings?.map((w, i) => (
                    <div key={i} style={{ marginTop: 8, padding: '8px 12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, fontSize: 13 }}>
                      ⚠️ {w}
                    </div>
                  ))}
                  {lastResult.refreshedCount != null && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, fontSize: 13 }}>
                      ✓ Grid reference data refreshed: {lastResult.refreshedCount} rows updated.
                    </div>
                  )}
                </>
              )}
            </Card>
          ) : (
            <Card>
              <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
                Select a file type from the left to upload
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
