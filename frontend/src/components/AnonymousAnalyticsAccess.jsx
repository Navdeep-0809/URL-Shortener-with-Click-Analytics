import { useState } from "react";

function AnonymousAnalyticsAccess({ onOpen }) {
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    if (!/^[A-Za-z0-9_-]{1,30}$/.test(code.trim())) {
      setError("Enter a valid short code.");
      return;
    }
    setError("");
    onOpen({ code: code.trim(), analyticsToken: token.trim() });
  }

  return (
    <details className="mt-4 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
        Open anonymous link analytics
      </summary>
      <form className="mt-3 space-y-3" onSubmit={submit}>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Short code
          <input
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            onChange={(event) => setCode(event.target.value)}
            required
            value={code}
          />
        </label>
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
          Private analytics token
          <input
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            onChange={(event) => setToken(event.target.value)}
            required
            value={token}
          />
        </label>
        {error && <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p>}
        <button
          className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white"
          type="submit"
        >
          View analytics
        </button>
      </form>
    </details>
  );
}

export default AnonymousAnalyticsAccess;
