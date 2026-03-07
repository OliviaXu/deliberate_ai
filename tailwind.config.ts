import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,css}', './entrypoints/**/*.{ts,tsx,html}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        deliberate: ['"Google Sans Text"', '"Google Sans"', 'Sohne', 'Inter', '"Segoe UI"', 'system-ui', 'sans-serif'],
        journal: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif']
      }
    }
  },
  corePlugins: {
    preflight: false
  }
} satisfies Config;
