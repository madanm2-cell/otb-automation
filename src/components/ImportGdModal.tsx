'use client';

import { useState } from 'react';
import { Modal, Upload, Button, Typography, Table, Alert, Space, Tag } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface ImportResult {
  totalParsed: number;
  matched: number;
  unmatched: number;
  unmatchedRows: { sub_brand: string; sub_category: string; channel: string }[];
  updates: { rowId: string; month: string; nsq?: number; inwards_qty?: number }[];
}

interface ImportGdModalProps {
  open: boolean;
  onClose: () => void;
  cycleId: string;
  onApply: (changes: { rowId: string; month: string; field: string; value: number }[]) => void;
}

export default function ImportGdModal({ open, onClose, cycleId, onApply }: ImportGdModalProps) {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setImporting(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/cycles/${cycleId}/import-gd`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Import failed');
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error');
    } finally {
      setImporting(false);
    }

    return false; // prevent default upload
  };

  const handleApply = () => {
    if (!result) return;

    const changes: { rowId: string; month: string; field: string; value: number }[] = [];
    for (const update of result.updates) {
      if (update.nsq != null) {
        changes.push({ rowId: update.rowId, month: update.month, field: 'nsq', value: update.nsq });
      }
      if (update.inwards_qty != null) {
        changes.push({ rowId: update.rowId, month: update.month, field: 'inwards_qty', value: update.inwards_qty });
      }
    }

    onApply(changes);
    setResult(null);
    onClose();
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      title="Import GD Data from Excel"
      open={open}
      onCancel={handleClose}
      footer={result ? [
        <Button key="cancel" onClick={handleClose}>Cancel</Button>,
        <Button key="apply" type="primary" onClick={handleApply} disabled={result.matched === 0}>
          Apply {result.matched} matched rows
        </Button>,
      ] : null}
      width={600}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Text type="secondary">
          Upload an Excel file (.xlsx) with columns: sub_brand, wear_type, sub_category, gender, channel, month, nsq, inwards_qty
        </Text>

        <Upload
          accept=".xlsx,.xls"
          showUploadList={false}
          beforeUpload={handleUpload}
        >
          <Button icon={<UploadOutlined />} loading={importing}>
            {importing ? 'Parsing...' : 'Select Excel File'}
          </Button>
        </Upload>

        {error && <Alert type="error" message={error} />}

        {result && (
          <>
            <Space>
              <Tag color="green">{result.matched} matched</Tag>
              {result.unmatched > 0 && <Tag color="orange">{result.unmatched} unmatched</Tag>}
              <Text type="secondary">{result.totalParsed} total rows parsed</Text>
            </Space>

            {result.unmatched > 0 && result.unmatchedRows.length > 0 && (
              <>
                <Text type="secondary">Unmatched rows (first 10):</Text>
                <Table
                  dataSource={result.unmatchedRows.map((r, i) => ({ ...r, key: i }))}
                  columns={[
                    { title: 'Sub Brand', dataIndex: 'sub_brand' },
                    { title: 'Sub Category', dataIndex: 'sub_category' },
                    { title: 'Channel', dataIndex: 'channel' },
                  ]}
                  size="small"
                  pagination={false}
                />
              </>
            )}
          </>
        )}
      </Space>
    </Modal>
  );
}
