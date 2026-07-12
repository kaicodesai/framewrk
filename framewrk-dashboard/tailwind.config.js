/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // `ink` = primary text (dark), `paper` = page background (light) —
        // named for what they mean, not which mode they started in.
        ink: '#121212',
        paper: '#F7F6F2',
        panel: '#FFFFFF',
        surface: '#FFFFFF',
        'surface-hover': '#EDECE4',
        line: '#DEDDD2',
        muted: '#65656B',
        faint: '#A6A59D',
        acid: '#D7FF3F',
        'acid-dim': '#BEE62E',
        'acid-text': '#4C7A12',
        danger: '#C81E44',
        info: '#0B72B5',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      letterSpacing: {
        widest2: '0.2em',
      },
      borderRadius: {
        none: '0px',
        sharp: '2px',
      },
    },
  },
  plugins: [],
}
