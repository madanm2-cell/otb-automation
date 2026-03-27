import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { VarianceReportData } from '@/types/otb';

export interface PdfPlanData {
  cycleName: string;
  brandName: string;
  planningQuarter: string;
  months: string[];
  rows: PdfPlanRow[];
}

export interface PdfPlanRow {
  sub_brand: string;
  wear_type: string;
  sub_category: string;
  gender: string;
  channel: string;
  months?: Record<string, {
    nsq?: number;
    sales_plan_gmv?: number;
    gm_pct?: number;
  }>;
}

export function buildPlanPdf(data: PdfPlanData): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  doc.setFontSize(16);
  doc.text(`OTB Plan: ${data.cycleName}`, 14, 15);
  doc.setFontSize(10);
  doc.text(
    `Brand: ${data.brandName} | Quarter: ${data.planningQuarter} | Generated: ${new Date().toLocaleDateString('en-IN')}`,
    14,
    22,
  );

  const headers = ['Sub Brand', 'Wear Type', 'Sub Cat', 'Gender', 'Channel'];
  for (const month of data.months) {
    const label = new Date(month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    headers.push(`${label} NSQ`, `${label} GMV`, `${label} GM%`);
  }

  const body = data.rows.map((row) => {
    const cells: (string | number)[] = [
      row.sub_brand,
      row.wear_type,
      row.sub_category,
      row.gender,
      row.channel,
    ];
    for (const month of data.months) {
      const md = row.months?.[month];
      cells.push(
        md?.nsq?.toLocaleString() ?? '',
        md?.sales_plan_gmv ? (md.sales_plan_gmv / 1e7).toFixed(2) : '',
        md?.gm_pct?.toFixed(1) ?? '',
      );
    }
    return cells;
  });

  autoTable(doc, {
    startY: 28,
    head: [headers],
    body,
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [46, 125, 50] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  return doc;
}

export function buildVariancePdf(data: VarianceReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });

  doc.setFontSize(16);
  doc.text(`Variance Report: ${data.cycle_name}`, 14, 15);
  doc.setFontSize(10);
  doc.text(`Brand: ${data.brand_name} | Quarter: ${data.planning_quarter}`, 14, 22);
  doc.text(
    `Summary: ${data.summary.green_count} OK | ${data.summary.yellow_count} Near Threshold | ${data.summary.red_count} Exceeds Threshold`,
    14,
    28,
  );

  const headers = [
    'Sub Brand',
    'Sub Cat',
    'Gender',
    'Channel',
    'Month',
    'NSQ Plan',
    'NSQ Actual',
    'NSQ Var%',
    'GMV Plan',
    'GMV Actual',
    'GMV Var%',
    'Inwards Plan',
    'Inwards Actual',
    'Inwards Var%',
  ];

  const body = data.rows.map((row) => [
    row.sub_brand,
    row.sub_category,
    row.gender,
    row.channel,
    new Date(row.month).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
    row.nsq.planned?.toLocaleString() ?? '',
    row.nsq.actual?.toLocaleString() ?? '',
    row.nsq.variance_pct != null ? `${row.nsq.variance_pct.toFixed(1)}%` : '',
    row.gmv.planned != null ? (row.gmv.planned / 1e7).toFixed(2) : '',
    row.gmv.actual != null ? (row.gmv.actual / 1e7).toFixed(2) : '',
    row.gmv.variance_pct != null ? `${row.gmv.variance_pct.toFixed(1)}%` : '',
    row.inwards.planned?.toLocaleString() ?? '',
    row.inwards.actual?.toLocaleString() ?? '',
    row.inwards.variance_pct != null ? `${row.inwards.variance_pct.toFixed(1)}%` : '',
  ]);

  autoTable(doc, {
    startY: 34,
    head: [headers],
    body,
    styles: { fontSize: 7, cellPadding: 1 },
    headStyles: { fillColor: [25, 118, 210] },
    didParseCell: function (hookData) {
      if (hookData.section === 'body' && [7, 10, 13].includes(hookData.column.index)) {
        const text = String(hookData.cell.raw);
        const val = parseFloat(text);
        if (!isNaN(val)) {
          const abs = Math.abs(val);
          if (abs > 20) hookData.cell.styles.textColor = [255, 77, 79];
          else if (abs > 10) hookData.cell.styles.textColor = [250, 173, 20];
          else hookData.cell.styles.textColor = [82, 196, 26];
        }
      }
    },
  });

  return doc;
}
