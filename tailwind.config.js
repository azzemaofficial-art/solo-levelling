/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Russo One', 'Orbitron', 'sans-serif'],
        body:    ['Chakra Petch', 'sans-serif'],
      },
      colors: {
        'system-blue':   '#00f2ff',
        'cursed-purple': '#a855f7',
        'void-black':    '#050505',
        'boss-red':      '#ff003c',
        'gaming-violet': '#7C3AED',
        'gaming-rose':   '#F43F5E',
        'gaming-deep':   '#0F0F23',
        'gaming-card':   '#1E1C35',
      },
      boxShadow: {
        'neon-blue':   '0 0 15px rgba(0, 242, 255, 0.4)',
        'neon-purple': '0 0 15px rgba(168, 85, 247, 0.4)',
        'neon-violet': '0 0 20px rgba(124, 58, 237, 0.5)',
        'glow-card':   '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      borderRadius: {
        'card': '16px',
      },
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}