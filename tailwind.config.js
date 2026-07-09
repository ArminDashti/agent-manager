/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#18181b',
          raised: '#27272a',
          border: '#3f3f46'
        }
      }
    }
  },
  plugins: []
}
