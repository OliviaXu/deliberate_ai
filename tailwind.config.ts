import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,css}', './entrypoints/**/*.{ts,tsx,html}'],
  darkMode: 'media',
  corePlugins: {
    preflight: false
  }
} satisfies Config;
