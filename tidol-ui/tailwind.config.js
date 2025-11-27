/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#ffffff', // White for primary text/active
          hover: '#aaaaaa',   // Gray for secondary/hover
          dark: '#169c46',
        },
        background: {
          DEFAULT: '#030303', // Deep black
          elevated: '#212121', // Surface/Cards
          surface: '#181818',
        },
        text: {
          base: '#FFFFFF',
          secondary: '#aaaaaa',
          tertiary: '#808080',
        }
      },
      borderRadius: {
        'card': '8px',
        'pill': '20px',
      },
      fontFamily: {
        sans: ['Montserrat', 'Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      backdropBlur: {
        'glass-sm': 'var(--glass-blur-sm)',
        'glass-md': 'var(--glass-blur-md)',
        'glass-lg': 'var(--glass-blur-lg)',
      },
      zIndex: {
        'negative': 'var(--z-negative)',
        'elevated': 'var(--z-elevated)',
        'sticky': 'var(--z-sticky)',
        'overlay': 'var(--z-overlay)',
        'modal': 'var(--z-modal)',
        'toast': 'var(--z-toast)',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '250ms',
        'slow': '350ms',
      },
      transitionTimingFunction: {
        'default': 'cubic-bezier(0.4, 0, 0.2, 1)',
      }
    },
  },
  plugins: [
    function ({ addComponents }) {
      addComponents({
        '.glass-card': {
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(var(--glass-blur-md)) saturate(180%)',
          border: '1px solid var(--glass-border)',
          borderTopColor: 'rgba(255, 255, 255, 0.15)',
          transition: 'all var(--transition-normal)',
        },
        '.glass-card-hover': {
          '&:hover': {
            background: 'var(--glass-bg-hover)',
            borderColor: 'var(--glass-border-hover)',
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          }
        },
        '.glass-panel': {
          background: 'rgba(24, 24, 24, 0.7)',
          backdropFilter: 'blur(var(--glass-blur-lg))',
          border: '1px solid var(--glass-border)',
        }
      })
    }
  ],
}