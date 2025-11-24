/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          lred: '#ff4d4f',
          lgreen: '#52c41a',
          lblue: '#1890ff',
        }
      },
    },
    plugins: [],
  }