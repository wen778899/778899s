/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          // 自定义球色（基础色，具体渐变在组件中实现）
          'lhc-red': '#f87171',
          'lhc-blue': '#60a5fa',
          'lhc-green': '#4ade80',
        },
        animation: {
          'fade-in': 'fadeIn 0.5s ease-out forwards',
          'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        },
        keyframes: {
          fadeIn: {
            '0%': { opacity: '0', transform: 'translateY(10px)' },
            '100%': { opacity: '1', transform: 'translateY(0)' },
          },
        },
        boxShadow: {
          'ball': 'inset -2px -2px 6px rgba(0,0,0,0.3), inset 2px 2px 6px rgba(255,255,255,0.4), 2px 2px 4px rgba(0,0,0,0.2)',
          'card': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        }
      },
    },
    plugins: [],
  }