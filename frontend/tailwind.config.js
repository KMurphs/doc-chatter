/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Our accent — warm teal
        accent: { DEFAULT: '#0d9488', hover: '#0f766e', light: '#ccfbf1', muted: '#5eead4' },

        // Dark mode
        dark: {
          bg: '#1c1c1e',
          sidebar: '#161618',
          surface: '#232326',
          'surface-alt': '#2c2c30',
          border: '#38383c',
          'text-primary': '#f0f0f0',
          'text-secondary': '#a1a1a6',
          muted: '#6e6e73',
        },

        // Light mode
        light: {
          bg: '#ffffff',
          sidebar: '#f5f5f7',
          surface: '#ffffff',
          'surface-alt': '#f0f0f2',
          border: '#e5e5ea',
          'text-primary': '#1d1d1f',
          'text-secondary': '#6e6e73',
          muted: '#aeaeb2',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
