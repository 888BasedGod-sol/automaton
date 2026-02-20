/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Minimal palette
        bg: {
          base: '#0c0c0e',
          subtle: '#141416',
          surface: '#1a1a1d',
          elevated: '#232326',
        },
        fg: {
          DEFAULT: '#f4f4f5',
          muted: '#94949e',
          faint: '#5c5c66',
        },
        accent: {
          DEFAULT: '#8b5cf6',
          hover: '#7c3aed',
          subtle: 'rgba(139, 92, 246, 0.12)',
        },
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.06)',
          hover: 'rgba(255, 255, 255, 0.12)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [],
}
