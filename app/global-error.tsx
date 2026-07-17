'use client'

/**
 * Root error boundary — the last resort. Next renders this ONLY when the root
 * layout (app/[locale]/layout.tsx) itself throws; ordinary page errors are
 * caught by app/[locale]/error.tsx (which keeps the Header/footer and i18n).
 *
 * Because it replaces the root layout, this file must render its own <html>/
 * <body> and cannot rely on anything the layout provides: no NextIntlClient
 * provider (so no useTranslations), no tenant theme CSS variables, and no
 * guarantee our global stylesheet's custom properties resolved. Everything here
 * is therefore self-contained — inline styles plus a scoped <style> block for
 * dark mode — so it renders correctly even when the rest of the app can't.
 *
 * Note: this does NOT catch boot-time failures (e.g. a throw in
 * instrumentation.ts) or Route Handler errors under app/api — those never reach
 * a React boundary. Keep env validation correct so the server can boot at all.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // The layout that resolves the locale is what failed, so infer language from
  // the URL / browser instead. Defaults to English (routing.defaultLocale).
  const isPt =
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/pt-BR') ||
      navigator.language?.toLowerCase().startsWith('pt'))

  const copy = isPt
    ? {
        lang: 'pt-BR',
        tag: 'erro',
        title: 'Algo deu errado',
        body: 'Não foi possível concluir a operação. Tente novamente em instantes.',
        retry: 'Tentar novamente',
        home: 'Voltar ao início',
        ref: 'Código de referência',
      }
    : {
        lang: 'en',
        tag: 'error',
        title: 'Something went wrong',
        body: "We couldn't complete the operation. Please try again shortly.",
        retry: 'Try again',
        home: 'Back to home',
        ref: 'Reference code',
      }

  return (
    <html lang={copy.lang}>
      <body>
        <style>{`
          .ge-root {
            min-height: 100vh;
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1.5rem;
            background: #f8fafc;
            color: #0f172a;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
          }
          .ge-card {
            width: 100%;
            max-width: 32rem;
            border: 1px solid #e2e8f0;
            border-radius: 0.75rem;
            overflow: hidden;
            background: #ffffff;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
          }
          .ge-head { padding: 1.5rem; border-bottom: 1px solid #e2e8f0; }
          .ge-tag {
            margin: 0;
            font-size: 10px;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            color: #b45309;
          }
          .ge-title { margin: 0.35rem 0 0; font-size: 1.25rem; font-weight: 700; letter-spacing: -0.01em; }
          .ge-body-wrap { padding: 1.5rem; }
          .ge-text { margin: 0; font-size: 0.875rem; line-height: 1.6; color: #475569; }
          .ge-digest {
            margin: 1rem 0 0;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 10px;
            color: rgba(100, 116, 139, 0.8);
          }
          .ge-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.5rem; }
          .ge-btn {
            display: inline-flex;
            align-items: center;
            border-radius: 0.5rem;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            border: 1px solid transparent;
          }
          .ge-btn-primary { background: #4338ca; color: #ffffff; }
          .ge-btn-primary:hover { background: #3730a3; }
          .ge-btn-ghost { background: transparent; color: #4338ca; border-color: #e2e8f0; }
          .ge-btn-ghost:hover { background: #f1f5f9; }
          @media (prefers-color-scheme: dark) {
            .ge-root { background: #0b1120; color: #e2e8f0; }
            .ge-card { background: #0f172a; border-color: #1e293b; box-shadow: none; }
            .ge-head { border-bottom-color: #1e293b; }
            .ge-tag { color: #fbbf24; }
            .ge-text { color: #94a3b8; }
            .ge-btn-primary { background: #6366f1; }
            .ge-btn-primary:hover { background: #4f46e5; }
            .ge-btn-ghost { color: #a5b4fc; border-color: #1e293b; }
            .ge-btn-ghost:hover { background: #1e293b; }
          }
        `}</style>
        <div className="ge-root">
          <div className="ge-card" role="alert">
            <div className="ge-head">
              <p className="ge-tag">{copy.tag}</p>
              <h1 className="ge-title">{copy.title}</h1>
            </div>
            <div className="ge-body-wrap">
              {/* Never render error.message: it may leak internals or a raw
                  backend/English string. Show a friendly localized message. */}
              <p className="ge-text">{copy.body}</p>
              {error.digest ? (
                <p className="ge-digest">
                  {copy.ref}: {error.digest}
                </p>
              ) : null}
              <div className="ge-actions">
                <button
                  type="button"
                  onClick={() => reset()}
                  className="ge-btn ge-btn-primary"
                >
                  {copy.retry}
                </button>
                <a href={`/${copy.lang}`} className="ge-btn ge-btn-ghost">
                  {copy.home}
                </a>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
