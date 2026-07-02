/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /**
         * Paleta personalizada FinFam.
         * Mantemos as chaves semânticas (uso pretendido) e também
         * expomos os nomes em PT-BR como aliases para conveniência.
         */
        brand: {
          // Cinza Escuro — Texto / Elementos neutros
          gray: '#8C888A',
          // Verde Água — Destaques / Valores positivos (receitas)
          aqua: '#9BBFB5',
          // Verde Musgo — Secundário / Bordas
          moss: '#6D7368',
          // Amarelo Claro — Avisos / Fundos de destaque
          cream: '#F1F2CE',
          // Cinza Muito Claro — Background principal
          light: '#F2F2F2',
          // Semânticos: entradas (verde) e saídas (vermelho)
          income: '#15966B',
          expense: '#D64550',
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
        card: '0 1px 3px 0 rgb(109 115 104 / 0.12), 0 1px 2px -1px rgb(109 115 104 / 0.10)',
      },
    },
  },
  plugins: [],
};
