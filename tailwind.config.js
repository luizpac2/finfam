/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /**
         * Paleta personalizada FinFam.
         *
         * Os tokens são referenciados via variáveis CSS (canais RGB) para que a
         * MESMA classe (ex.: `text-brand-moss`, `bg-white`) troque de valor no
         * tema escuro — ver `:root` e `.dark` em `index.css`. A sintaxe
         * `rgb(var(--x) / <alpha-value>)` preserva utilitários de opacidade
         * (`bg-brand-aqua/20`, `border-brand-moss/15`, …).
         *
         * `white` é sobrescrito de propósito: no app ele é usado apenas como
         * cor de superfície (cartões/inputs), então vira o "surface" do tema.
         */
        white: 'rgb(var(--c-surface) / <alpha-value>)',
        brand: {
          // Cinza Escuro — Texto / Elementos neutros
          gray: 'rgb(var(--c-muted) / <alpha-value>)',
          // Verde Água — Destaques / Valores positivos (receitas)
          aqua: 'rgb(var(--c-accent) / <alpha-value>)',
          // Verde Musgo — Texto principal / Bordas
          moss: 'rgb(var(--c-ink) / <alpha-value>)',
          // Amarelo Claro — Avisos / Fundos de destaque
          cream: 'rgb(var(--c-cream) / <alpha-value>)',
          // Cinza Muito Claro — Background principal
          light: 'rgb(var(--c-bg) / <alpha-value>)',
          // Semânticos: entradas (verde) e saídas (vermelho)
          income: 'rgb(var(--c-income) / <alpha-value>)',
          expense: 'rgb(var(--c-expense) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.12), 0 1px 2px -1px rgb(0 0 0 / 0.10)',
      },
    },
  },
  plugins: [],
};
