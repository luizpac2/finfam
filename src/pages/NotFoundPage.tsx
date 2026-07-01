import { Link } from 'react-router-dom';

/** Página 404. */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-light px-4 text-center">
      <p className="text-6xl font-bold text-brand-aqua">404</p>
      <h1 className="mt-2 text-xl font-semibold text-brand-moss">
        Página não encontrada
      </h1>
      <p className="mt-1 text-sm text-brand-gray">
        A página que você procura não existe ou foi movida.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-brand-aqua px-5 py-2.5 font-medium text-brand-moss shadow-sm transition hover:brightness-95"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
