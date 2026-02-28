import type { Config } from 'tailwindcss';

export default {
  content: ['./src/content/**/*.{ts,tsx,css}', './entrypoints/content.ts'],
  darkMode: 'media',
  corePlugins: {
    preflight: false
  }
} satisfies Config;
