export const colors = {
  coral: '#B95545',
  coralDark: '#8A463A',
  coralSoft: '#D98A72',
  sage: '#61765B',
  sageSoft: '#EEF2EA',
  paper: '#F8F5EF',
  card: '#FFFDF9',
  ink: '#2A211F',
  muted: '#7A5E55',
  border: '#E7D8CB',
  line: '#F2E5DE',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  disabled: '#D6CABF',
  white: '#FFFFFF',
} as const;

export const radii = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
} as const;

export const shadows = {
  card: {
    shadowColor: '#4A3830',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;
