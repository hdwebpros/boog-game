import type { Config } from 'tailwindcss'

export default <Config>{
  content: [
    './app/**/*.{vue,ts,js}',
    './content/**/*.md',
  ],
  theme: {
    extend: {
      colors: {
        'wiki-surface': '#1e293b',
        'wiki-primary': '#facc15',
        'wiki-accent': '#38bdf8',
        'wiki-danger': '#f87171',
        'wiki-success': '#34d399',
        'wiki-magic': '#c084fc',
        'wiki-tier-0': '#9ca3af',
        'wiki-tier-1': '#4ade80',
        'wiki-tier-2': '#60a5fa',
        'wiki-tier-3': '#c084fc',
        'wiki-tier-4': '#fb923c',
        'wiki-tier-5': '#f87171',
        'wiki-tier-6': '#facc15',
      },
      fontFamily: {
        heading: ['"Press Start 2P"', 'monospace'],
        body: ['ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
