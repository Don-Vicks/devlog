/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Loosely matches Padi's bottle green / gold / cream identity as a default —
        // adjust to taste for the dashboard's own look.
        bottle: '#1f3d2e',
        gold: '#c9a24b',
        cream: '#f8f5ee',
      },
    },
  },
  plugins: [],
};
