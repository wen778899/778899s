/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          'ball-red': '#ef4444',
          'ball-blue': '#3b82f6',
          'ball-green': '#10b981',
        },
        boxShadow: {
          'ball': 'inset -2px -2px 6px rgba(0,0,0,0.3), inset 2px 2px 6px rgba(255,255,255,0.4), 2px 5px 5px rgba(0,0,0,0.2)',
        }
      },
    },
    plugins: [],
  }