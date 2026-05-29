/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'system-blue': '#00f2ff',
        'cursed-purple': '#a855f7',
        'void-black': '#050505',
        'boss-red': '#ff003c',
      },
      boxShadow: {
        'neon-blue': '0 0 15px rgba(0, 242, 255, 0.4)',
        'neon-purple': '0 0 15px rgba(168, 85, 247, 0.4)',
      }
    },
  },
  plugins: [],
}