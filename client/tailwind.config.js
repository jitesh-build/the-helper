/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        coc: {
          wood: '#6b4423',
          woodDark: '#3b2410',
          parchment: '#f5e6b8',
          gold: '#ffd23f',
          elixir: '#e255f0',
          dark: '#8b7bff',
          grass: '#4f9a2b',
          danger: '#ff5a4d',
          good: '#8be04e',
        },
      },
      fontFamily: {
        clash: ['"Lilita One"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};