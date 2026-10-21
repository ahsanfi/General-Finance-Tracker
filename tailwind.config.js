/** Static build config — mirrors the former inline Play CDN config in index.html/demo.html. */
const colors = ['amber','rose','emerald','blue','teal','purple'];
module.exports = {
  content: [
    './index.html',
    './demo.html',
    './offline.html',
    './app.js',
    './shell.js',
    './modules/*.js',
  ],
  darkMode: 'class',
  safelist: [
    'bg-emerald-500/10', 'bg-rose-500/10',
    ...colors.flatMap(c => [`text-${c}-400`, `bg-${c}-500/10`, `border-${c}-500/20`, `bg-${c}-600`, `hover:bg-${c}-500`]),
  ],
  theme: {
    extend: {
      colors: {
        theme: {
          bg: '#050B14',
          card: '#0B1325',
          border: '#1E293B',
          primary: '#4F46E5',
          primaryHover: '#4338CA',
          primaryLight: '#818CF8',
        },
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'monospace'],
      },
    },
  },
};
