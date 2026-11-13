/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: '#FAF9F5',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#1C2321',
          muted: '#5B6561',
        },
        primary: {
          DEFAULT: '#146C54',
          hover: '#0F5642',
          tint: '#EBF5F1',
        },
        tag: {
          yellow: '#F5B82E',
          tint: '#FEF8E8',
        },
        signal: {
          red: '#C8372D',
          tint: '#FCECEB',
        },
        counter: {
          grey: '#E5E3DB',
          light: '#F4F2EC',
        },
      },
      fontFamily: {
        heading: ["'Bricolage Grotesque Variable'", "-apple-system", "sans-serif"],
        body: ["'Figtree Variable'", "-apple-system", "sans-serif"],
        mono: ["'DM Mono'", "monospace"],
      },
      borderRadius: {
        control: '8px',
        panel: '14px',
      },
    },
  },
  plugins: [],
}
