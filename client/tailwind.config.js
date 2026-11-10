/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#FFF6E8',        // Requested Background
          primary: '#C1121F',   // Requested Primary
          'primary-hover': '#9F0E19',
          'primary-light': '#FBECEE',
          secondary: '#A9C6EA', // Requested Secondary
          'secondary-dark': '#4F7AA8',
          'secondary-light': '#E9F1FA',
          surface: '#FFFFFF',
          card: '#FFFFFF',
          border: '#E8DEC9',
          muted: '#6B7280',
          dark: '#1C1917',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}

