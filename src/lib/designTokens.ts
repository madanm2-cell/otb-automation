// Centralized design tokens for the OTB Platform
// All colors, spacing, shadows, and reusable style objects

export const COLORS = {
  // Primary palette
  primary: '#1B2A4A',
  primaryLight: '#2D4A7A',
  primaryDark: '#0F1B30',
  accent: '#0066FF',
  accentLight: '#E6F0FF',

  // Semantic
  success: '#22C55E',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Neutral scale
  neutral50: '#F8FAFC',
  neutral100: '#F1F5F9',
  neutral200: '#E2E8F0',
  neutral300: '#CBD5E1',
  neutral400: '#94A3B8',
  neutral500: '#64748B',
  neutral600: '#475569',
  neutral700: '#334155',
  neutral800: '#1E293B',
  neutral900: '#0F172A',

  // Semantic aliases
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
} as const;

export const STATUS_COLORS: Record<string, string> = {
  Draft: COLORS.neutral400,
  Active: COLORS.info,
  Filling: COLORS.warning,
  InReview: COLORS.accent,
  Approved: COLORS.success,
};

export const STATUS_TAG_COLORS: Record<string, string> = {
  Draft: 'default',
  Active: 'processing',
  Filling: 'warning',
  InReview: 'blue',
  Approved: 'success',
};

export const VARIANCE_COLORS: Record<string, string> = {
  green: COLORS.success,
  yellow: COLORS.warning,
  red: COLORS.danger,
};

export const VARIANCE_BG_COLORS: Record<string, string> = {
  green: COLORS.successLight,
  yellow: COLORS.warningLight,
  red: COLORS.dangerLight,
};

export const ROLE_COLORS: Record<string, string> = {
  Admin: 'red',
  Planning: 'blue',
  GD: 'green',
  Finance: 'orange',
  CXO: 'purple',
  ReadOnly: 'default',
};

export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
  card: '0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const CARD_STYLES: React.CSSProperties = {
  borderRadius: 12,
  border: `1px solid ${COLORS.borderLight}`,
  boxShadow: SHADOWS.card,
};

export const KPI_CARD_STYLES: React.CSSProperties = {
  ...CARD_STYLES,
  padding: 0,
};

export const PAGE_HEADER_STYLES: React.CSSProperties = {
  marginBottom: SPACING.xl,
};

export const SECTION_TITLE_STYLES: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: COLORS.textMuted,
};
