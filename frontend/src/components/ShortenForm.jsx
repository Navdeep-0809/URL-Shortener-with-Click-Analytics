import { lazy, Suspense, useState } from "react";
import api from "../api/client.js";
import { getErrorMessage } from "../utils/errors.js";

const QrCodeDialog = lazy(() => import("./QrCodeDialog.jsx"));

function ShortenForm({
  onCreated,
  onViewAnonymousAnalytics,
  allowCustomDomains = false,
  customDomains = []
}) {
  const [longUrl, setLongUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [clickLimit, setClickLimit] = useState("");
  const [oneTimeUse, setOneTimeUse] = useState(false);
  const [password, setPassword] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [domainId, setDomainId] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setResult(null);
    setCopied(false);
    setShowQrCode(false);
    setLoading(true);

    try {
      const request = { longUrl };
      if (domainId) {
        request.domainId = domainId;
      }
      if (customAlias.trim()) {
        request.customAlias = customAlias.trim();
      }
      if (expiresAt) {
        request.expiresAt = expiresAt;
      }
      if (oneTimeUse) {
        request.oneTimeUse = true;
      } else if (clickLimit) {
        request.clickLimit = Number(clickLimit);
      }
      if (password) {
        request.password = password;
      }
      const { data } = await api.post("/urls", request);
      setResult(data);
      setLongUrl("");
      setCustomAlias("");
      setExpiresAt("");
      setClickLimit("");
      setOneTimeUse(false);
      setPassword("");
      setDomainId("");
      onCreated?.(data);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "We couldn't shorten that URL."));
    } finally {
      setLoading(false);
    }
  }

  async function copyShortUrl() {
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
    } catch {
      setError("Clipboard access is unavailable. Select and copy the short URL instead.");
    }
  }

  async function copyAnalyticsToken() {
    try {
      await navigator.clipboard.writeText(result.analyticsToken);
    } catch {
      setError("Clipboard access is unavailable. Keep the analytics token somewhere private.");
    }
  }

  return (
    <div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="long-url">
            Destination URL
          </label>
          <input
            autoComplete="url"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-4 focus:ring-accent/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            id="long-url"
            maxLength={2048}
            onChange={(event) => setLongUrl(event.target.value)}
            placeholder="https://example.com/your-long-link"
            required
            type="url"
            value={longUrl}
          />
        </div>
        {allowCustomDomains && customDomains.some((domain) => domain.verifiedAt) && (
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
            Short-link domain
            <select
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              onChange={(event) => setDomainId(event.target.value)}
              value={domainId}
            >
              <option value="">Default domain</option>
              {customDomains.filter((domain) => domain.verifiedAt).map((domain) => (
                <option key={domain.id} value={domain.id}>{domain.hostname}</option>
              ))}
            </select>
          </label>
        )}
        <details className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
            Expiry, click limits, and password
          </summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Expiration date
              <input
                className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setExpiresAt(event.target.value)}
                type="date"
                value={expiresAt}
              />
            </label>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Maximum clicks
              <input
                className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white disabled:opacity-50"
                disabled={oneTimeUse}
                min="1"
                onChange={(event) => setClickLimit(event.target.value)}
                placeholder="No limit"
                type="number"
                value={clickLimit}
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                checked={oneTimeUse}
                className="mt-1"
                onChange={(event) => {
                  setOneTimeUse(event.target.checked);
                  if (event.target.checked) {
                    setClickLimit("");
                  }
                }}
                type="checkbox"
              />
              <span>
                One-time use
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">The first successful visit uses the link.</span>
              </span>
            </label>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Link password
              <input
                autoComplete="new-password"
                className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                maxLength={72}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                type="password"
                value={password}
              />
            </label>
          </div>
        </details>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200" htmlFor="custom-alias">
            Custom alias <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            autoComplete="off"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-base text-ink shadow-sm outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-4 focus:ring-accent/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            id="custom-alias"
            maxLength={30}
            onChange={(event) => setCustomAlias(event.target.value)}
            placeholder="my-custom-link"
            value={customAlias}
          />
        </div>
        {error && <p className="text-sm font-medium text-rose-600" role="alert">{error}</p>}
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3.5 font-semibold text-white shadow-lg shadow-accent/20 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          type="submit"
        >
          {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
          {loading ? "Creating your link…" : "Shorten URL"}
        </button>
      </form>

      {result && (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            Your short link is ready
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              className="min-w-0 flex-1 break-all font-semibold text-emerald-900 underline decoration-emerald-300 underline-offset-4 dark:text-emerald-200"
              href={result.shortUrl}
              rel="noreferrer"
              target="_blank"
            >
              {result.shortUrl}
            </a>
            <button
              className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-200"
              onClick={copyShortUrl}
              type="button"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-200"
              onClick={() => setShowQrCode(true)}
              type="button"
            >
              QR code
            </button>
            {result.analyticsToken && onViewAnonymousAnalytics && (
              <button
                className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-200"
                onClick={() => onViewAnonymousAnalytics(result)}
                type="button"
              >
                View analytics
              </button>
            )}
          </div>
          {(result.hasPassword || result.oneTimeUse || result.clickLimit || result.expiresAt) && (
            <p className="mt-3 text-xs text-emerald-800 dark:text-emerald-300">
              {[
                result.hasPassword ? "Password protected" : null,
                result.oneTimeUse ? "One-time use" : result.clickLimit ? `Limit: ${result.clickLimit} clicks` : null,
                result.expiresAt ? `Expires ${new Date(result.expiresAt).toLocaleDateString()}` : null
              ].filter(Boolean).join(" · ")}
            </p>
          )}
          {result.analyticsToken && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
              Save this private token to access these analytics later.
              <button
                className="rounded-md border border-emerald-300 px-2 py-1 font-semibold dark:border-emerald-800"
                onClick={copyAnalyticsToken}
                type="button"
              >
                Copy analytics token
              </button>
            </p>
          )}
        </div>
      )}
      {showQrCode && result && (
        <Suspense fallback={null}>
          <QrCodeDialog link={result} onClose={() => setShowQrCode(false)} />
        </Suspense>
      )}
    </div>
  );
}

export default ShortenForm;
