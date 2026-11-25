import { useState } from "react";
import api from "../api/client.js";
import { getErrorMessage } from "../utils/errors.js";
import { parseLinkImport } from "../utils/linkImport.js";

function LinkImportPanel({ onImported, domains = [] }) {
  const [format, setFormat] = useState("lines");
  const [source, setSource] = useState("");
  const [domainId, setDomainId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function loadFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      setSource(await file.text());
      setFormat(file.name.toLowerCase().endsWith(".csv") ? "csv" : "lines");
      setError("");
      setResult(null);
    } catch {
      setError("The selected file couldn't be read.");
    }
  }

  async function submitImport(event) {
    event.preventDefault();
    setError("");
    setResult(null);

    let items;
    try {
      items = parseLinkImport(source, format);
    } catch (parseError) {
      setError(parseError.message);
      return;
    }
    if (items.length < 1 || items.length > 100) {
      setError("Import between 1 and 100 URLs at a time.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/urls/import", {
        items,
        ...(domainId ? { domainId } : {})
      });
      setResult(data);
      onImported?.();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "The links couldn't be imported."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-bold text-ink dark:text-white">Import links</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Import up to 100 URLs at a time from a text list or CSV.
      </p>
      <form className="mt-4 space-y-3" onSubmit={submitImport}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Format
            <select
              className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              onChange={(event) => setFormat(event.target.value)}
              value={format}
            >
              <option value="lines">One URL per line</option>
              <option value="csv">CSV</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Or choose a file
            <input
              accept=".csv,.txt,text/csv,text/plain"
              className="ml-2 max-w-56 text-sm"
              onChange={loadFile}
              type="file"
            />
          </label>
        </div>
        <textarea
          className="min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          onChange={(event) => setSource(event.target.value)}
          placeholder={format === "csv" ? "longUrl,customAlias\nhttps://example.com,example" : "https://example.com"}
          value={source}
        />
        {domains.some((domain) => domain.verifiedAt) && (
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
            Short-link domain
            <select
              className="ml-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              onChange={(event) => setDomainId(event.target.value)}
              value={domainId}
            >
              <option value="">Default domain</option>
              {domains.filter((domain) => domain.verifiedAt).map((domain) => (
                <option key={domain.id} value={domain.id}>{domain.hostname}</option>
              ))}
            </select>
          </label>
        )}
        {error && <p className="text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p>}
        <button
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          disabled={loading}
          type="submit"
        >
          {loading ? "Importing…" : "Import URLs"}
        </button>
      </form>
      {result && (
        <div className="mt-4" role="status">
          <p className="text-sm font-semibold text-ink dark:text-white">
            Imported {result.imported}; failed {result.failed}.
          </p>
          {result.failed > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-rose-700 dark:text-rose-300">
              {result.results.filter((item) => item.status === "error").map((item) => (
                <li key={item.row}>Row {item.row}: {item.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export default LinkImportPanel;
