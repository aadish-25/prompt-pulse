/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        surface: {
          900: '#0b0f17',
          850: '#111724',
          800: '#172033',
          700: '#1f2d47',
          border: '#263554',
        },
      },
      spacing: {
        '4.5': '1.125rem',
      },
    },
  },
  plugins: [],
}
