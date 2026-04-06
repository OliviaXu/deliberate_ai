export type DeliberateTheme = 'light' | 'dark';

export function resolveDeliberateTheme(): DeliberateTheme {
  const bodyLuminance = readLuminance(window.getComputedStyle(document.body).backgroundColor);
  const documentLuminance = readLuminance(window.getComputedStyle(document.documentElement).backgroundColor);
  const luminance = bodyLuminance ?? documentLuminance;

  if (typeof luminance === 'number') {
    return luminance < 0.42 ? 'dark' : 'light';
  }

  if (typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readLuminance(color: string): number | null {
  const normalized = color.trim().toLowerCase();
  if (normalized === 'transparent') return null;

  const match = normalized.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?/i);
  if (!match) return null;
  const alpha = typeof match[4] === 'string' ? Number(match[4]) : 1;
  if (Number.isFinite(alpha) && alpha <= 0.05) return null;

  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}
