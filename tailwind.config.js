/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        heard: {
          50:  '#f0f7ff',
          100: '#e0effe',
          200: '#baddfd',
          300: '#7dc2fb',
          400: '#38a1f6',
          500: '#0e82e7',
          600: '#0265c4',
          700: '#03519f',
          800: '#074583',
          900: '#0c3a6d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
