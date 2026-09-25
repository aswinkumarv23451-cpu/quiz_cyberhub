/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Outfit', 'Cinzel', 'Inter', 'system-ui', 'sans-serif'],
        pirate: ['Cinzel', 'Outfit', 'serif'],
      },
      colors: {
        parchment: {
          50: '#FDFBF7',
          100: '#F7F3E9',
          200: '#EFE7D2',
          300: '#E4D5B4',
          400: '#D5BE91',
          500: '#C2A36B',
          600: '#A48249',
        },
        gold: {
          50: '#FCF9EE',
          100: '#F7EFD2',
          200: '#EEDDA3',
          300: '#E2C770',
          400: '#D4AF37', // Antique Classic Gold
          500: '#B89222',
          600: '#947214',
          700: '#73550D',
          800: '#553E0A',
          900: '#3D2B06',
        },
        bronze: {
          300: '#C7A87A',
          400: '#A88454',
          500: '#8C6836',
          600: '#6E4E24',
          700: '#523817',
          800: '#38250E',
          900: '#231607',
        },
        charcoal: {
          700: '#262930',
          800: '#1C1E24',
          850: '#15171C',
          900: '#0F1115',
          950: '#090A0D',
        },
        wood: {
          800: '#2A1E18',
          850: '#201612',
          900: '#18110D',
          950: '#100B08',
        },
        crimson: {
          500: '#DC2626',
          600: '#B91C1C',
          700: '#991B1B',
          800: '#7F1D1D',
          900: '#5A1212',
          950: '#380909',
        },
        navy: {
          800: '#142132',
          900: '#0D1622',
          950: '#070C14',
        },
      },
    },
  },
  plugins: [],
};
