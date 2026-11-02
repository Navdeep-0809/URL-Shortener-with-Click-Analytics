import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import api from "../api/client.js";
import { getErrorMessage } from "../utils/errors.js";

const COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

function toDateInputValue(date) {
  return date.toISOString().slice(0, 10);
}

function AnalyticsPage({ link, onBack }) {
  const [to, setTo] = useState(() => toDateInputValue(new Date()));
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 29);
    return toDateInputValue(date);
  });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    api.get(`/urls/${link.id}/analytics`, {
      params: { from, to },
      signal: controller.signal
    })
      .then(({ data }) => setAnalytics(data))
      .catch((requestError) => {
        if (requestError.code !== "ERR_CANCELED") {
          setError(getErrorMessage(requestError, "Analytics couldn't be loaded."));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [link.id, from, to]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
      <button
        className="mb-6 rounded-lg px-3 py-2 text-sm font-semibold text-accent hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
        onClick={onBack}
        type="button"
      >
        ← Back to dashboard
      </button>
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent">Link insights</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink dark:text-white">Click analytics</h1>
          <a className="mt-2 block break-all text-sm font-medium text-accent hover:underline" href={link.shortUrl} rel="noreferrer" target="_blank">{link.shortUrl}</a>
          <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">{link.longUrl}</p>
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            From
            <input
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              type="date"
              value={from}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            To
            <input
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              max={toDateInputValue(new Date())}
              min={from}
              onChange={(event) => setTo(event.target.value)}
              type="date"
              value={to}
            />
          </label>
        </form>
      </div>

      {error && <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" role="alert">{error}</p>}

      {loading ? (
        <div aria-label="Loading analytics" className="mt-8 grid gap-5 md:grid-cols-2" role="status">
          <span className="sr-only">Loading click analytics…</span>
          {[1, 2, 3, 4].map((item) => <div className="h-72 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" key={item} />)}
        </div>
      ) : analytics ? (
        <>
          <section aria-label="Analytics summary" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Clicks in range" value={analytics.totalClicks} />
            <SummaryCard label="Referrers" value={analytics.referrers.length} />
            <SummaryCard label="Countries" value={analytics.countries.filter((item) => item.country !== "Unknown").length} />
            <SummaryCard label="Date range" value={`${from} – ${to}`} compact />
          </section>

          {analytics.totalClicks === 0 ? (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-lg font-semibold text-ink dark:text-white">No clicks in this date range</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Share this short link to start collecting insights.</p>
            </section>
          ) : (
            <>
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <h2 className="font-bold text-ink dark:text-white">Clicks over time</h2>
                <div className="mt-5 h-72" role="img" aria-label="Line chart of clicks by day">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.clicksByDay} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line dataKey="clicks" name="Clicks" stroke="#4f46e5" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section aria-label="Click breakdowns" className="mt-6 grid gap-5 lg:grid-cols-2">
                <BreakdownCard title="Devices" items={analytics.devices} kind="pie" />
                <BreakdownCard title="Browsers" items={analytics.browsers} />
                <BreakdownCard title="Operating systems" items={analytics.operatingSystems} />
                <BreakdownCard title="Top referrers" items={analytics.referrers} />
              </section>

              <section aria-label="Geographic breakdown" className="mt-6 grid gap-5 lg:grid-cols-2">
                <BreakdownCard
                  title="Countries (approximate)"
                  items={analytics.countries.map(({ country, clicks }) => ({ name: country, clicks }))}
                />
                <BreakdownCard
                  title="Cities (approximate)"
                  items={analytics.cities.map(({ city, country, clicks }) => ({ name: `${city}, ${country}`, clicks }))}
                />
              </section>
            </>
          )}

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-bold text-ink dark:text-white">Recent clicks</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Location is approximate and may be unavailable.</p>
              </div>
              <span className="text-xs text-slate-400">Up to 20 events</span>
            </div>
            {analytics.recentClicks.length === 0 ? (
              <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">No click events to show.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr><th className="py-2 pr-4">Time (UTC)</th><th className="py-2 pr-4">Referrer</th><th className="py-2 pr-4">Device</th><th className="py-2">Approx. location</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {analytics.recentClicks.map((click, index) => (
                      <tr key={`${click.timestamp}-${index}`}>
                        <td className="whitespace-nowrap py-3 pr-4 text-slate-600 dark:text-slate-300">{new Date(click.timestamp).toLocaleString()}</td>
                        <td className="max-w-56 truncate py-3 pr-4 text-slate-600 dark:text-slate-300">{click.referrer ?? "Direct / unknown"}</td>
                        <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{[click.device, click.browser, click.OS].filter(Boolean).join(" · ")}</td>
                        <td className="py-3 text-slate-600 dark:text-slate-300">{[click.city, click.country].filter(Boolean).join(", ") || "Unknown"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

function SummaryCard({ label, value, compact = false }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`${compact ? "text-sm" : "text-3xl"} mt-2 font-bold tracking-tight text-ink dark:text-white`}>{compact ? value : value.toLocaleString()}</p>
    </article>
  );
}

function BreakdownCard({ title, items, kind = "bar" }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <h2 className="font-bold text-ink dark:text-white">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Not enough data yet.</p>
      ) : kind === "pie" ? (
        <div className="mt-3 h-64" role="img" aria-label={`${title} pie chart`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={items} dataKey="clicks" nameKey="name" outerRadius={88} label>
                {items.map((item, index) => <Cell fill={COLORS[index % COLORS.length]} key={item.name} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-3 h-64" role="img" aria-label={`${title} bar chart`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={items} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="clicks" name="Clicks" fill="#4f46e5" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

export default AnalyticsPage;
