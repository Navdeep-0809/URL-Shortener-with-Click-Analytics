import { lazy, Suspense, useEffect, useState } from "react";
import api from "../api/client.js";
import ShortenForm from "../components/ShortenForm.jsx";
import Toast from "../components/Toast.jsx";
import { getErrorMessage } from "../utils/errors.js";

const QrCodeDialog = lazy(() => import("../components/QrCodeDialog.jsx"));

const EMPTY_SUMMARY = {
  totalLinks: 0,
  totalClicks: 0,
  activeLinks: 0,
  topLinks: [],
  recentLinks: []
};

function getLinkAvailability(link) {
  const expired = link.expiresAt && new Date(link.expiresAt) <= new Date();
  const exhausted = link.clickLimit !== null &&
    link.clickLimit !== undefined &&
    link.clicks >= link.clickLimit;
  return {
    available: link.isActive && !expired && !exhausted,
    label: !link.isActive
      ? "Disabled"
      : expired
        ? "Expired"
        : exhausted
          ? "Limit reached"
          : "Active"
  };
}

function DashboardPage({ onViewAnalytics }) {
  const [links, setLinks] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [editingId, setEditingId] = useState(null);
  const [editDestination, setEditDestination] = useState("");
  const [editAlias, setEditAlias] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [editClickLimit, setEditClickLimit] = useState("");
  const [editOneTimeUse, setEditOneTimeUse] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState("success");
  const [refreshKey, setRefreshKey] = useState(0);
  const [qrLink, setQrLink] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    Promise.all([
      api.get("/urls", {
        params: { page, search, status },
        signal: controller.signal
      }),
      api.get("/urls/summary", { signal: controller.signal })
    ])
      .then(([linksResponse, summaryResponse]) => {
        setLinks(linksResponse.data.items);
        setPagination(linksResponse.data.pagination);
        setSummary(summaryResponse.data);
        setSelected(new Set());
      })
      .catch((requestError) => {
        if (requestError.code !== "ERR_CANCELED") {
          setError(getErrorMessage(requestError, "Your links couldn't be loaded."));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [page, search, status, refreshKey]);

  function showToast(message, type = "success") {
    setToastType(type);
    setToast(message);
  }

  async function saveEdit(event, link) {
    event.preventDefault();
    const changes = {
      longUrl: editDestination.trim(),
      expiresAt: editExpiresAt || null,
      oneTimeUse: editOneTimeUse
    };
    if (!editOneTimeUse) {
      changes.clickLimit = editClickLimit ? Number(editClickLimit) : null;
    }
    if (editAlias.trim() !== (link.customAlias ?? "")) {
      changes.customAlias = editAlias.trim() || null;
    }
    if (editPassword) {
      changes.password = editPassword;
    } else if (removePassword) {
      changes.password = null;
    }

    try {
      await api.patch(`/urls/${link.id}`, changes);
      setEditingId(null);
      setRefreshKey((value) => value + 1);
      showToast("Link updated.");
    } catch (requestError) {
      showToast(getErrorMessage(requestError, "The link couldn't be updated."), "error");
    }
  }

  async function toggleActive(link) {
    try {
      await api.patch(`/urls/${link.id}`, { isActive: !link.isActive });
      setRefreshKey((value) => value + 1);
      showToast(link.isActive ? "Link disabled." : "Link enabled.");
    } catch (requestError) {
      showToast(getErrorMessage(requestError, "The link status couldn't be changed."), "error");
    }
  }

  async function deleteLink(link) {
    if (!window.confirm(`Delete the short link ${link.shortUrl}? This cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/urls/${link.id}`);
      setRefreshKey((value) => value + 1);
      showToast("Link deleted.");
    } catch (requestError) {
      showToast(getErrorMessage(requestError, "The link couldn't be deleted."), "error");
    }
  }

  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link.shortUrl);
      showToast("Short link copied.");
    } catch {
      showToast("Clipboard access is unavailable in this browser.", "error");
    }
  }

  async function runBulkAction(action) {
    const ids = [...selected];
    if (ids.length === 0) {
      return;
    }
    if (action === "delete" && !window.confirm(`Delete ${ids.length} selected links? This cannot be undone.`)) {
      return;
    }
    try {
      const { data } = await api.post("/urls/bulk", { ids, action });
      setRefreshKey((value) => value + 1);
      showToast(`${data.affected} link${data.affected === 1 ? "" : "s"} ${action === "delete" ? "deleted" : `${action}d`}.`);
    } catch (requestError) {
      showToast(getErrorMessage(requestError, "The bulk action couldn't be completed."), "error");
    }
  }

  function toggleSelected(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => (
      links.every((link) => current.has(link.id))
        ? new Set()
        : new Set(links.map((link) => link.id))
    ));
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Your workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl dark:text-white">Link dashboard</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Create, organize, and keep track of your short links.</p>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Showing your saved links
        </div>
      </div>

      <section aria-label="Link summary" className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Total links", summary.totalLinks, "Created in your account"],
          ["Total clicks", summary.totalClicks, "Across your saved links"],
          ["Active links", summary.activeLinks, "Available to visitors"]
        ].map(([label, value, caption]) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" key={label}>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-ink dark:text-white">{value.toLocaleString()}</p>
            <p className="mt-1 text-xs text-slate-400">{caption}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-ink dark:text-white">Create a short link</h2>
          <p className="mb-5 mt-1 text-sm text-slate-500 dark:text-slate-400">New links created while signed in are saved to your account.</p>
          <ShortenForm onCreated={() => setRefreshKey((value) => value + 1)} />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
          <LinkHighlights title="Top links" links={summary.topLinks} emptyLabel="Clicks will appear here as your links are visited." />
          <LinkHighlights title="Recently created" links={summary.recentLinks} emptyLabel="Links you create will appear here." />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink dark:text-white">Your links</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{pagination.total.toLocaleString()} saved</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="link-search">Search links</label>
            <input
              className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 sm:w-64 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              id="link-search"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search URL or alias"
              type="search"
              value={searchInput}
            />
            <label className="sr-only" htmlFor="link-status">Filter link status</label>
            <select
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              id="link-status"
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              value={status}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Disabled</option>
            </select>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-indigo-50 p-3 dark:bg-indigo-950/40">
            <span className="mr-2 text-sm font-semibold text-indigo-900 dark:text-indigo-200">{selected.size} selected</span>
            <button className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200" onClick={() => runBulkAction("enable")} type="button">Enable</button>
            <button className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200" onClick={() => runBulkAction("disable")} type="button">Disable</button>
            <button className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:bg-slate-900 dark:text-rose-300" onClick={() => runBulkAction("delete")} type="button">Delete</button>
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" role="alert">{error}</p>}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <div aria-label="Loading links" className="space-y-3 p-6" role="status">
              <span className="sr-only">Loading links…</span>
              {[1, 2, 3].map((item) => <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" key={item} />)}
            </div>
          ) : links.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-lg font-semibold text-ink dark:text-white">{search || status !== "all" ? "No links match these filters." : "No saved links yet."}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Create a link above and it will appear here.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800">
                <input
                  aria-label="Select all visible links"
                  checked={links.every((link) => selected.has(link.id))}
                  onChange={toggleAllVisible}
                  type="checkbox"
                />
                <span>{links.length} on this page</span>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {links.map((link) => {
                  const { available, label } = getLinkAvailability(link);
                  return (
                  <li className="p-4 sm:p-5" key={link.id}>
                    <div className="flex items-start gap-3">
                      <input
                        aria-label={`Select ${link.shortUrl}`}
                        checked={selected.has(link.id)}
                        className="mt-1"
                        onChange={() => toggleSelected(link.id)}
                        type="checkbox"
                      />
                      <div className="min-w-0 flex-1">
                        {editingId === link.id ? (
                          <form className="space-y-3" onSubmit={(event) => saveEdit(event, link)}>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor={`destination-${link.id}`}>Destination URL</label>
                            <input
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                              id={`destination-${link.id}`}
                              onChange={(event) => setEditDestination(event.target.value)}
                              required
                              type="url"
                              value={editDestination}
                            />
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor={`alias-${link.id}`}>Custom alias</label>
                            <input
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                              id={`alias-${link.id}`}
                              maxLength={30}
                              onChange={(event) => setEditAlias(event.target.value)}
                              placeholder="Leave blank to use a generated code"
                              value={editAlias}
                            />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor={`expiry-${link.id}`}>
                                Expiration date
                                <input
                                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                  id={`expiry-${link.id}`}
                                  onChange={(event) => setEditExpiresAt(event.target.value)}
                                  type="date"
                                  value={editExpiresAt}
                                />
                              </label>
                              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor={`click-limit-${link.id}`}>
                                Maximum clicks
                                <input
                                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white disabled:opacity-50"
                                  disabled={editOneTimeUse}
                                  id={`click-limit-${link.id}`}
                                  min="1"
                                  onChange={(event) => setEditClickLimit(event.target.value)}
                                  placeholder="No limit"
                                  type="number"
                                  value={editClickLimit}
                                />
                              </label>
                            </div>
                            <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                              <input
                                checked={editOneTimeUse}
                                className="mt-0.5"
                                onChange={(event) => {
                                  setEditOneTimeUse(event.target.checked);
                                  if (event.target.checked) {
                                    setEditClickLimit("");
                                  }
                                }}
                                type="checkbox"
                              />
                              One-time use (first successful visit only)
                            </label>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor={`password-${link.id}`}>
                              {link.hasPassword ? "Change link password" : "Add link password"}
                              <input
                                autoComplete="new-password"
                                className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                                id={`password-${link.id}`}
                                maxLength={72}
                                minLength={8}
                                onChange={(event) => setEditPassword(event.target.value)}
                                placeholder="Leave blank to keep current password"
                                type="password"
                                value={editPassword}
                              />
                            </label>
                            {link.hasPassword && (
                              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <input
                                  checked={removePassword}
                                  onChange={(event) => setRemovePassword(event.target.checked)}
                                  type="checkbox"
                                />
                                Remove password protection
                              </label>
                            )}
                            <div className="flex gap-2">
                              <button className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white" type="submit">Save changes</button>
                              <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold dark:border-slate-700" onClick={() => setEditingId(null)} type="button">Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <a className="break-all font-semibold text-accent hover:underline" href={link.shortUrl} rel="noreferrer" target="_blank">{link.shortUrl}</a>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${available ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                                {label}
                              </span>
                            </div>
                            <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">{link.longUrl}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                              <span>{link.clicks.toLocaleString()} clicks</span>
                              {link.clickLimit && <span>{Math.max(0, link.clickLimit - link.clicks)} of {link.clickLimit} remaining</span>}
                              {link.hasPassword && <span>Password protected</span>}
                              {link.expiresAt && <span>Expires {new Date(link.expiresAt).toLocaleDateString()}</span>}
                              <time dateTime={link.createdAt}>{new Date(link.createdAt).toLocaleDateString()}</time>
                            </div>
                          </>
                        )}
                      </div>
                      {editingId !== link.id && (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button aria-label={`Copy ${link.shortUrl}`} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => copyLink(link)} type="button">Copy</button>
                          <button aria-label={`Show QR code for ${link.shortUrl}`} className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => setQrLink(link)} type="button">QR code</button>
                          <button aria-label={`View analytics for ${link.shortUrl}`} className="rounded-lg border border-indigo-200 px-2.5 py-2 text-xs font-semibold text-accent hover:bg-indigo-50 dark:border-indigo-900 dark:hover:bg-indigo-950/40" onClick={() => onViewAnalytics(link)} type="button">Analytics</button>
                          <button className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => {
                            setEditingId(link.id);
                            setEditDestination(link.longUrl);
                            setEditAlias(link.customAlias ?? "");
                            setEditExpiresAt(link.expiresAt ? new Date(link.expiresAt).toISOString().slice(0, 10) : "");
                            setEditClickLimit(link.clickLimit && link.clickLimit > 1 ? String(link.clickLimit) : "");
                            setEditOneTimeUse(link.oneTimeUse ?? link.clickLimit === 1);
                            setEditPassword("");
                            setRemovePassword(false);
                          }} type="button">Edit</button>
                          <button className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => toggleActive(link)} type="button">{link.isActive ? "Disable" : "Enable"}</button>
                          <button className="rounded-lg border border-rose-200 px-2.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950" onClick={() => deleteLink(link)} type="button">Delete</button>
                        </div>
                      )}
                    </div>
                  </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                <span className="text-xs text-slate-500">Page {pagination.page} of {Math.max(pagination.totalPages, 1)}</span>
                <div className="flex gap-2">
                  <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40 dark:border-slate-700" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} type="button">Previous</button>
                  <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-40 dark:border-slate-700" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} type="button">Next</button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
      <Toast message={toast} type={toastType} onClose={() => setToast("")} />
      {qrLink && (
        <Suspense fallback={null}>
          <QrCodeDialog link={qrLink} onClose={() => setQrLink(null)} />
        </Suspense>
      )}
    </main>
  );
}

function LinkHighlights({ title, links, emptyLabel }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-bold text-ink dark:text-white">{title}</h2>
      {links.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {links.map((link) => (
            <li className="flex items-center justify-between gap-3" key={link.id}>
              <a className="min-w-0 truncate text-sm font-medium text-accent hover:underline" href={link.shortUrl} rel="noreferrer" target="_blank">
                {link.shortUrl}
              </a>
              <span className="shrink-0 text-xs text-slate-500">{link.clicks.toLocaleString()} clicks</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default DashboardPage;
