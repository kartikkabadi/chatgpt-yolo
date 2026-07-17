// Design tokens copied verbatim from the extension's styles.css (:root light theme)
// so the reconstructed UI matches the real product exactly.
export const theme = {
  canvas: '#f6f6f4',
  surface: '#ffffff',
  surfaceRaised: '#fbfbfa',
  surfaceHover: '#f0f0ed',
  text: '#181817',
  textSoft: '#55554f',
  textFaint: '#85847c',
  border: '#deded8',
  borderStrong: '#c5c5bd',
  primary: '#181817',
  primaryText: '#ffffff',
  success: '#24784b',
  successSoft: '#e9f6ee',
  warning: '#9b640d',
  warningSoft: '#fff4dd',
  danger: '#b33232',
  dangerSoft: '#fff0f0',
  shadow: '0 12px 32px rgba(20, 20, 18, 0.08)',
  radiusLg: 16,
  radiusMd: 12,
  radiusSm: 9,
} as const;

export const fontStack =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const monoStack =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';
