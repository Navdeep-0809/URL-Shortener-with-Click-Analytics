import ShortenForm from "../components/ShortenForm.jsx";

const features = [
  {
    number: "01",
    title: "Short links, instantly",
    description: "Turn a long destination into a clean link you can share anywhere."
  },
  {
    number: "02",
    title: "Your links in one place",
    description: "Create an account to save, search, update, and disable your links."
  },
  {
    number: "03",
    title: "Useful click insights",
    description: "See how your links perform with a focused analytics dashboard."
  }
];

function LandingPage({ onNavigate }) {
  return (
    <main>
      <section className="relative overflow-hidden px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24">
        <div className="pointer-events-none absolute -right-36 -top-32 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl dark:bg-violet-900/20" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-accent shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
              A better way to share links
            </p>
            <h1 className="max-w-2xl text-5xl font-bold leading-[1.08] tracking-tight text-ink sm:text-6xl lg:text-7xl dark:text-white">
              Make every link <span className="text-accent">count.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              Create tidy, memorable links and keep an eye on how they perform — all from one calm, clear workspace.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-2"><span className="text-emerald-500">✓</span> Free to get started</span>
              <span className="inline-flex items-center gap-2"><span className="text-emerald-500">✓</span> No setup required</span>
            </div>
          </div>

          <div className="rounded-3xl border border-white bg-white/90 p-5 shadow-2xl shadow-indigo-950/10 backdrop-blur sm:p-8 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-ink dark:text-white">Shorten a link</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Paste a destination and make it shareable.</p>
            </div>
            <ShortenForm />
            <p className="mt-4 text-center text-xs leading-5 text-slate-400">
              Use a custom alias or let us create one for you.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white/70 px-5 py-16 sm:px-8 sm:py-20 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Simple by design</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl dark:text-white">
              Everything your links need.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <article
                className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
                key={feature.number}
              >
                <span className="text-sm font-bold text-accent">{feature.number}</span>
                <h3 className="mt-4 text-lg font-bold text-ink dark:text-white">{feature.title}</h3>
                <p className="mt-2 leading-7 text-slate-600 dark:text-slate-400">{feature.description}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-5 rounded-2xl bg-indigo-50 p-6 sm:flex-row sm:items-center sm:p-8 dark:bg-indigo-950/40">
            <div>
              <h3 className="text-xl font-bold text-ink dark:text-white">Keep your links organized.</h3>
              <p className="mt-1 text-slate-600 dark:text-slate-300">Create an account to save links and manage them from your dashboard.</p>
            </div>
            <button
              className="rounded-xl bg-accent px-5 py-3 font-semibold text-white hover:bg-indigo-600"
              onClick={() => onNavigate("register")}
              type="button"
            >
              Create an account
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default LandingPage;
