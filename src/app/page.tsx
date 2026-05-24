import { SpendForm } from "../components/SpendForm";

export default function HomePage() {
  return (
    <main className="app-shell">
      <div className="app-shell__backdrop" />
      <div className="app-shell__content">
        <section className="hero">
          <div className="hero__copy">
            <p className="eyebrow">AI Spend Audit</p>
            <h1 className="hero__title">Turn AI tool spend into a clean, shareable operating snapshot.</h1>
            <p className="hero__lede">
              Capture team context, persist edits locally, and export an audit payload without storing sensitive data in the browser or on a server.
            </p>

            <div className="hero__pills">
              <span className="pill">Local persistence</span>
              <span className="pill">Shareable audit payload</span>
              <span className="pill">PII-free workflow</span>
            </div>
          </div>

          <div className="hero__cards">
            <article className="info-card info-card--dark">
              <p className="info-card__eyebrow">Focus</p>
              <h2 className="info-card__title">Single source</h2>
              <p className="info-card__text">A compact workspace for the spend audit without extra navigation.</p>
            </article>

            <article className="info-card info-card--cyan">
              <p className="info-card__eyebrow">Data</p>
              <h2 className="info-card__title">Local only</h2>
              <p className="info-card__text">Your edits stay in browser storage until you intentionally export them.</p>
            </article>

            <article className="info-card info-card--amber">
              <p className="info-card__eyebrow">Outcome</p>
              <h2 className="info-card__title">Audit-ready</h2>
              <p className="info-card__text">Generate a structured payload that is easy to review or send downstream.</p>
            </article>
          </div>
        </section>

        <SpendForm />
      </div>
    </main>
  );
}