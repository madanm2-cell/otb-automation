'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Upload, Button, Tag, Typography, message, Space, Spin } from 'antd';
import {
  InboxOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownOutlined,
  UpOutlined,
} from '@ant-design/icons';
import type { FileUpload, FileType, ValidationError, CycleStatus } from '@/types/otb';
import { ALL_FILE_TYPES, REQUIRED_FILE_TYPES, FILE_TYPE_LABELS } from '@/types/otb';
import ValidationReport from '@/components/ValidationReport';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/lib/auth/roles';
import { COLORS } from '@/lib/designTokens';

const { Text } = Typography;
const { Dragger } = Upload;

interface Props {
  cycleId: string;
  cycleStatus: CycleStatus;
}

export function FileUploadsCard({ cycleId, cycleStatus }: Props) {
  const { profile } = useAuth();
  const canUpload = profile ? hasPermission(profile.role, 'upload_data') : false;

  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<FileType | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lastResult, setLastResult] = useState<{
    valid: boolean;
    errors: ValidationError[];
    rowCount: number;
    warnings?: string[];
    refreshedCount?: number;
  } | null>(null);
  const [open, setOpen] = useState<boolean>(cycleStatus === 'Draft');

  const loadUploads = useCallback(() => {
    fetch(`/api/cycles/${cycleId}/upload-status`)
      .then(r => r.json())
      .then(uploadsData => {
        setUploads(Array.isArray(uploadsData) ? uploadsData : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [cycleId]);

  useEffect(() => {
    loadUploads();
  }, [loadUploads]);

  const uploadsByType = new Map(uploads.map(u => [u.file_type, u]));

  const validatedCount = uploads.filter(u => u.status === 'validated' && REQUIRED_FILE_TYPES.includes(u.file_type)).length;
  const requiredCount = REQUIRED_FILE_TYPES.length;

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

  // Reference Data card always shows reference file types — actuals has its
  // own dedicated card (ActualsUploadCard) in the Setup tab.
  const visibleTypes = ALL_FILE_TYPES.filter(ft => ft !== 'actuals') as FileType[];

  // Which of those types are uploadable right now depends on cycle status:
  // - Draft: all reference files (pre-template-generation)
  // - Filling: the refreshable subset
  // - InReview / Approved: none — reference data is locked once the cycle has progressed
  const uploadableTypes = (() => {
    if (cycleStatus === 'Draft') return visibleTypes;
    if (cycleStatus === 'Filling') return ['ly_sales', 'recent_sales', 'soft_forecast'] as FileType[];
    return [] as FileType[];
  })();

  const titleNode = (
    <Space size={8}>
      <span>Reference Data</span>
    </Space>
  );

  const extraNode = (
    <Space size={12}>
      <Tag color={validatedCount === requiredCount ? 'success' : 'default'}>
        {validatedCount}/{requiredCount} validated
      </Tag>
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
      {loading ? (
        <Spin size="large" style={{ display: 'block', margin: '60px auto' }} />
      ) : (
        <>
          {cycleStatus === 'Filling' && (
            <div
              style={{
                marginBottom: 16,
                padding: '8px 12px',
                background: COLORS.warningLight,
                border: `1px solid ${COLORS.warning}`,
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              In Filling status, you can re-upload LY Sales, Recent Sales, and Soft Forecast to refresh grid reference data. Opening stock cannot be changed after template generation.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: canUpload ? '300px 1fr' : '1fr', gap: 24 }}>
            {/* Left: file type cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibleTypes.map(ft => {
                const upload = uploadsByType.get(ft);
                const isRequired = REQUIRED_FILE_TYPES.includes(ft);
                const isSelected = selectedType === ft;
                const interactive = canUpload && uploadableTypes.includes(ft);
                return (
                  <Card
                    key={ft}
                    size="small"
                    hoverable={interactive}
                    onClick={interactive ? () => { setSelectedType(ft); setLastResult(null); } : undefined}
                    style={{
                      borderColor: isSelected
                        ? '#1677ff'
                        : upload?.status === 'validated'
                          ? COLORS.success
                          : upload?.status === 'failed'
                            ? COLORS.danger
                            : COLORS.border,
                      borderWidth: isSelected ? 2 : 1,
                      cursor: interactive ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong>{FILE_TYPE_LABELS[ft]}</Text>
                      <Space size={4}>
                        {isRequired && <Tag color="red" style={{ fontSize: 10 }}>Req</Tag>}
                        {upload?.status === 'validated' && <CheckCircleOutlined style={{ color: COLORS.success }} />}
                        {upload?.status === 'failed' && <CloseCircleOutlined style={{ color: COLORS.danger }} />}
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

            {/* Right: upload zone (only when user has upload_data permission) */}
            {canUpload && (
              <div>
                {selectedType ? (
                  <Card title={`Upload: ${FILE_TYPE_LABELS[selectedType]}`} size="small">
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
                          <div
                            key={i}
                            style={{
                              marginTop: 8,
                              padding: '8px 12px',
                              background: COLORS.warningLight,
                              border: `1px solid ${COLORS.warning}`,
                              borderRadius: 6,
                              fontSize: 13,
                            }}
                          >
                            ⚠️ {w}
                          </div>
                        ))}
                        {lastResult.refreshedCount != null && (
                          <div
                            style={{
                              marginTop: 8,
                              padding: '8px 12px',
                              background: COLORS.successLight,
                              border: `1px solid ${COLORS.success}`,
                              borderRadius: 6,
                              fontSize: 13,
                            }}
                          >
                            ✓ Grid reference data refreshed: {lastResult.refreshedCount} rows updated.
                          </div>
                        )}
                      </>
                    )}
                  </Card>
                ) : (
                  <Card size="small">
                    <div style={{ textAlign: 'center', padding: 48, color: COLORS.textMuted }}>
                      {uploadableTypes.length === 0
                        ? 'No files are uploadable in the current cycle status.'
                        : 'Select a file type from the left to upload'}
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
