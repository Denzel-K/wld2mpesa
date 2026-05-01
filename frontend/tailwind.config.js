/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // M-Pesa brand colors
        mpesa: {
          green: '#00A651',
          'green-dark': '#007A3D',
          'green-light': '#E6F7EE',
          'green-mid': '#10C469',
          'green-soft': '#F0FAF5',
          red: '#E31837',
          gray: '#F5F5F5',
          'gray-dark': '#666666',
          'gray-border': '#E0E0E0',
          'accent': '#FFD700', // Gold accent
        },
        // World App brand
        world: {
          black: '#000000',
          white: '#FFFFFF',
          gray: '#F9F9F9',
          blue: '#0052FF',
          'blue-soft': '#EBF1FF',
        },
        // Premium UI colors
        glass: 'rgba(255, 255, 255, 0.7)',
        surface: '#FFFFFF',
        background: '#F8F9FA',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Sora', 'sans-serif'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.5rem',
      },
      boxShadow: {
        'card': '0 8px 30px rgba(0,0,0,0.04)',
        'card-hover': '0 12px 40px rgba(0,0,0,0.08)',
        'button': '0 4px 16px rgba(0,166,81,0.25)',
        'button-hover': '0 6px 20px rgba(0,166,81,0.35)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-green': 'pulseGreen 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 2s infinite linear',
        'slide-up-sheet': 'slideUpSheet 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'shake': 'shake 0.4s ease-in-out',
      },
      keyframes: {
        pulseGreen: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0,166,81,0.2)' },
          '50%': { boxShadow: '0 0 0 10px rgba(0,166,81,0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-24px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        slideUpSheet: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' },
        },
      },
    },
  },
  plugins: [],
};
