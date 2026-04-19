/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sora: ['Sora', 'sans-serif'],
        dmsans: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        'green-900': 'var(--green-900)',
        'green-700': 'var(--green-700)',
        'green-500': 'var(--green-500)',
        'green-300': 'var(--green-300)',
        'green-100': 'var(--green-100)',
        'amber-500': 'var(--amber-500)',
        'amber-300': 'var(--amber-300)',
        'red-500': 'var(--red-500)',
        'sky-500': 'var(--sky-500)',
        'bg-base': 'var(--bg-base)',
        'bg-card': 'var(--bg-card)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'border-color': 'var(--border)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
      }
    },
  },
  plugins: [],
}
