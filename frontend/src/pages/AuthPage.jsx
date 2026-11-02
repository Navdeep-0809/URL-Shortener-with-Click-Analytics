import { useState } from "react";
import { getErrorMessage } from "../utils/errors.js";

function AuthPage({ mode, onNavigate, onAuthenticated }) {
  const isRegister = mode === "register";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const passwordLength = Array.from(password).length;
    const passwordBytes = new TextEncoder().encode(password).length;
    if (passwordBytes > 72) {
      setError("Password must be no more than 72 UTF-8 bytes.");
      return;
    }
    if (isRegister && passwordLength < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    setLoading(true);
    try {
      await onAuthenticated({ email, password });
    } catch (requestError) {
      setError(getErrorMessage(requestError, "We couldn't sign you in."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-88px)] max-w-6xl items-center justify-center px-5 py-12 sm:px-8">
      <section className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 md:grid-cols-[0.9fr_1.1fr] dark:border-slate-800 dark:bg-slate-900">
        <div className="hidden flex-col justify-between bg-gradient-to-br from-indigo-600 to-violet-700 p-10 text-white md:flex">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-100">Shortly workspace</p>
            <h1 className="mt-8 text-4xl font-bold leading-tight">
              Your links deserve a home.
            </h1>
          </div>
          <p className="text-sm leading-6 text-indigo-100">
            Save your links, update destinations, and keep everything organized in one place.
          </p>
        </div>

        <div className="p-7 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
            {isRegister ? "Get started" : "Welcome back"}
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink dark:text-white">
            {isRegister ? "Create your account" : "Sign in"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {isRegister
              ? "Save and manage the links you create."
              : "Sign in to pick up where you left off."}
          </p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="account-email">
                Email address
              </label>
              <input
                autoComplete="email"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                id="account-email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="account-password">
                Password
              </label>
              <input
                autoComplete={isRegister ? "new-password" : "current-password"}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-ink outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                id="account-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
              {isRegister && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Use at least 12 characters (maximum 72 UTF-8 bytes).
                </p>
              )}
            </div>

            {error && <p className="text-sm font-medium text-rose-600" role="alert">{error}</p>}

            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 font-semibold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
              {loading ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            {isRegister ? "Already have an account?" : "New to Shortly?"}{" "}
            <button
              className="font-semibold text-accent hover:underline"
              onClick={() => onNavigate(isRegister ? "login" : "register")}
              type="button"
            >
              {isRegister ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

export default AuthPage;
