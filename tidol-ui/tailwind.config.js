// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,css}", // <-- La ruta con 'css' está bien
  ],
  theme: {
    // En v3, las personalizaciones van dentro de 'extend'
    extend: {
      colors: {
        background: '#181818',
        surface: '#282828',
        primary: '#1DB954',
        'primary-hover': '#1ED760',
        text: '#FFFFFF',
        'text-subdued': '#B3B3B3',
        'interactive-bg': '#383838',
      },
      fontFamily: {
        // Asegúrate de tener la fuente 'Montserrat' importada en tu index.html
        'sans': ['Montserrat', 'sans-serif'],
      }
    },
  },
  plugins: [],
}