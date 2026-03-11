'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Upload, Button, Tag, Typography, message, Space, Spin } from 'antd';
import { InboxOutlined, DownloadOutlined, ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { FileUpload, FileType, ValidationError } from '@/types/otb';
import { ALL_FILE_TYPES, REQUIRED_FILE_TYPES, FILE_TYPE_LABELS } from '@/types/otb';
import ValidationReport from '@/components/ValidationReport';

const { Title, Text } = Typography;
const { Dragger } = Upload;

export default function UploadPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<FileType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<{ valid: boolean; errors: ValidationError[]; rowCount: number } | null>(null);

  const loadUploads = useCallback(() => {
    fetch(`/api/cycles/${cycleId}/upload-status`)
      .then(r => r.json())
      .then(data => {
        setUploads(Array.isArray(data) ? data : []);
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
      });

      if (data.valid) {
        message.success(`${FILE_TYPE_LABELS[selectedType]} uploaded successfully`);
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

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Link href={`/cycles/${cycleId}`}>
          <Button icon={<ArrowLeftOutlined />}>Back to Cycle</Button>
        </Link>
      </Space>
      <Title level={2}>Upload Input Files</Title>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
        {/* Left: file type cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ALL_FILE_TYPES.map(ft => {
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
                <ValidationReport
                  valid={lastResult.valid}
                  errors={lastResult.errors}
                  rowCount={lastResult.rowCount}
                />
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
  );
}
