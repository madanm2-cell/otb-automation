import type { ThemeConfig } from 'antd';

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary:          '#CC785C',
    colorSuccess:          '#2E7D52',
    colorWarning:          '#92400E',
    colorError:            '#B91C1C',
    colorInfo:             '#1D4ED8',
    colorBgContainer:      '#FFFFFF',
    colorBgLayout:         '#FAF9F6',
    colorBorder:           '#E7E5E0',
    colorBorderSecondary:  '#E7E5E0',
    borderRadius:           8,
    borderRadiusLG:        12,
    borderRadiusSM:         6,
    fontFamily:            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize:              14,
    colorText:             '#1C1917',
    colorTextSecondary:    '#78716C',
    colorTextTertiary:     '#A8A29E',
    boxShadow:             '0 1px 4px rgba(0,0,0,0.06)',
    boxShadowSecondary:    '0 4px 12px rgba(0,0,0,0.08)',
  },
  components: {
    Card: { borderRadiusLG: 12, paddingLG: 24 },
    Table: {
      headerBg:   '#F5F4EF',
      borderColor:'#E7E5E0',
      fontSize:    13,
      padding:     12,
      paddingXS:   8,
    },
    Button: { borderRadius: 8, controlHeight: 36 },
    Tag:    { borderRadiusSM: 6 },
    Statistic: { titleFontSize: 13, contentFontSize: 28 },
    Steps: { colorPrimary: '#CC785C' },
  },
};
