/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lottery: {
          red: '#e73f3f',
          red_dark: '#b91c1c',
          green: '#38bdf8', // 修正：波色里的“绿”通常指 emerald/green
          green_real: '#10b981',
          green_dark: '#047857',
          blue: '#3b82f6',
          blue_dark: '#1d4ed8',
          gold: '#f59e0b',
        }
      },
      boxShadow: {
        'ball': 'inset -2px -2px 6px rgba(0,0,0,0.3), inset 2px 2px 6px rgba(255,255,255,0.4), 2px 4px 6px rgba(0,0,0,0.2)',
      }
    },
  },
  plugins: [],
}