/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#121212', // El fondo principal oscuro
        surface: '#181818',    // Para elementos "sobre" el fondo (cards, sidebar)
        primary: '#1DB954',    // El verde característico
        'primary-hover': '#1ED760', // Un verde más brillante para hover
        text: '#FFFFFF',
        'text-subdued': '#B3B3B3', // Para texto secundario o menos importante
        'interactive-bg': '#282828', // Fondo para elementos con hover
      },
      fontFamily: {
        'sans': ['Montserrat', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
