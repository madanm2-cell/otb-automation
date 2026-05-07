import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { EnhancedBrandSummary } from '@/types/otb';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock antd to avoid full component tree rendering issues
vi.mock('antd', async () => {
  const React = await import('react');
  return {
    Card: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
      React.createElement('div', { 'data-testid': 'card', ...props }, children),
    Tag: ({ children, color }: { children: React.ReactNode; color?: string }) =>
      React.createElement('span', { 'data-testid': 'tag', 'data-color': color }, children),
    Table: () => React.createElement('table', { 'data-testid': 'table' }),
    Button: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
      React.createElement('button', props, children),
    Space: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    Typography: {
      Text: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) =>
        React.createElement('span', props, children),
    },
    Tooltip: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', null, children),
    Modal: ({ children, open }: { children: React.ReactNode; open?: boolean; [key: string]: unknown }) =>
      open ? React.createElement('div', { 'data-testid': 'modal' }, children) : null,
    Input: {
      TextArea: (props: { [key: string]: unknown }) =>
        React.createElement('textarea', props),
    },
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
    Skeleton: Object.assign(
      ({ active }: { active?: boolean }) => React.createElement('div', { 'data-testid': 'skeleton', 'data-active': active }),
      { Input: ({ active }: { active?: boolean }) => React.createElement('div', { 'data-testid': 'skeleton-input', 'data-active': active }) },
    ),
  };
});

// Mock @ant-design/icons
vi.mock('@ant-design/icons', () => {
  const React = require('react');
  const icon = (name: string) =>
    function MockIcon() {
      return React.createElement('span', { 'data-testid': `icon-${name}` });
    };
  return {
    RightOutlined: icon('right'),
    DownOutlined: icon('down'),
    CheckCircleOutlined: icon('check-circle'),
    ExclamationCircleOutlined: icon('exclamation-circle'),
    UndoOutlined: icon('undo'),
    LinkOutlined: icon('link'),
  };
});

import { BrandPanel } from '@/components/ui/BrandPanel';

const makeBrand = (overrides?: Partial<EnhancedBrandSummary>): EnhancedBrandSummary => ({
  brand_id: 'b1',
  brand_name: 'Bewakoof',
  cycle_id: 'c1',
  cycle_name: 'Q1 FY27',
  status: 'InReview',
  planning_quarter: 'Q1 FY27',
  gmv: 150000000, // 15 Cr
  nsv: 120000000,
  nsq: 50000,
  inwards_qty: 30000,
  avg_doh: 45,
  closing_stock_qty: 20000,
  monthly: [
    {
      month: '2026-04-01',
      gmv: 50000000,
      nsv: 40000000,
      nsq: 17000,
      inwards_qty: 10000,
      closing_stock_qty: 7000,
      avg_doh: 44,
    },
  ],
  top_categories: [
    { sub_category: 'T-Shirts', gmv: 75000000, nsq: 25000, inwards_qty: 15000, pct_of_total: 50 },
    { sub_category: 'Joggers', gmv: 37500000, nsq: 12500, inwards_qty: 7500, pct_of_total: 25 },
  ],
  has_actuals: false,
  ...overrides,
});

describe('BrandPanel', () => {
  it('renders brand name and cycle name in collapsed state', () => {
    render(<BrandPanel brand={makeBrand()} zone="review" />);

    expect(screen.getByText('Bewakoof')).toBeInTheDocument();
    // cycle_name and planning_quarter are both "Q1 FY27" in the test fixture
    const q1Elements = screen.getAllByText('Q1 FY27');
    expect(q1Elements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows InReview tag for review zone', () => {
    render(<BrandPanel brand={makeBrand({ status: 'InReview' })} zone="review" />);

    const tags = screen.getAllByTestId('tag');
    const statusTag = tags.find((t) => t.textContent === 'InReview');
    expect(statusTag).toBeTruthy();
    expect(statusTag?.getAttribute('data-color')).toBe('blue');
  });

  it('shows Approved tag for approved zone', () => {
    render(
      <BrandPanel brand={makeBrand({ status: 'Approved' })} zone="approved" />
    );

    const tags = screen.getAllByTestId('tag');
    const statusTag = tags.find((t) => t.textContent === 'Approved');
    expect(statusTag).toBeTruthy();
    expect(statusTag?.getAttribute('data-color')).toBe('success');
  });

  it('renders inline metrics with GMV formatted as Crore', () => {
    render(<BrandPanel brand={makeBrand()} zone="review" />);

    // GMV = 150000000 => 15.00 Cr
    expect(screen.getByText('15.00 Cr')).toBeInTheDocument();
  });
});
