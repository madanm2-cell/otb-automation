import type { ThemeConfig } from 'antd';
import { COLORS, SHADOWS } from './designTokens';

export const antdTheme: ThemeConfig = {
  token: {
    // Primary colors
    colorPrimary: COLORS.accent,
    colorSuccess: COLORS.success,
    colorWarning: COLORS.warning,
    colorError: COLORS.danger,
    colorInfo: COLORS.info,

    // Background
    colorBgContainer: COLORS.surface,
    colorBgLayout: COLORS.background,

    // Border
    colorBorder: COLORS.border,
    colorBorderSecondary: COLORS.borderLight,

    // Border radius
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,

    // Typography
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    colorText: COLORS.textPrimary,
    colorTextSecondary: COLORS.textSecondary,
    colorTextTertiary: COLORS.textMuted,

    // Shadows
    boxShadow: SHADOWS.sm,
    boxShadowSecondary: SHADOWS.md,
  },
  components: {
    Card: {
      borderRadiusLG: 12,
      paddingLG: 24,
    },
    Table: {
      headerBg: COLORS.neutral50,
      borderColor: COLORS.borderLight,
      fontSize: 13,
      padding: 12,
      paddingXS: 8,
    },
    Button: {
      borderRadius: 8,
      controlHeight: 36,
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Statistic: {
      titleFontSize: 13,
      contentFontSize: 28,
    },
    Menu: {
      darkItemBg: COLORS.primary,
      darkSubMenuItemBg: COLORS.primaryDark,
      darkItemSelectedBg: COLORS.primaryLight,
      darkItemHoverBg: COLORS.primaryLight,
      itemMarginInline: 8,
      itemPaddingInline: 16,
      itemBorderRadius: 8,
    },
    Layout: {
      siderBg: COLORS.primary,
      headerBg: COLORS.surface,
      bodyBg: COLORS.background,
    },
    Steps: {
      colorPrimary: COLORS.accent,
    },
  },
};
