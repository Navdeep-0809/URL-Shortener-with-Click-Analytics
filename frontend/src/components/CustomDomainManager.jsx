import { useEffect, useState } from "react";
import api from "../api/client.js";
import { getErrorMessage } from "../utils/errors.js";

function CustomDomainManager({ onChanged }) {
  const [domains, setDomains] = useState([]);
  const [hostname, setHostname] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refreshDomains() {
    const { data } = await api.get("/domains");
    setDomains(data.items);
    onChanged?.(data.items);
  }

  useEffect(() => {
    let active = true;
    api.get("/domains")
      .then(({ data }) => {
        if (active) {
          setDomains(data.items);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(getErrorMessage(requestError, "Custom domains couldn't be loaded."));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function addDomain(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.post("/domains", { hostname });
      setHostname("");
      await refreshDomains();
      setMessage("Domain added. Publish the TXT record shown below, then verify it.");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "The domain couldn't be added."));
    }
  }

  async function verifyDomain(domain) {
    setWorkingId(domain.id);
    setError("");
    setMessage("");
    try {
      await api.post(`/domains/${domain.id}/verify`);
      await refreshDomains();
      setMessage(`${domain.hostname} is verified and ready to use.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "The domain couldn't be verified."));
    } finally {
      setWorkingId("");
    }
  }

  async function removeDomain(domain) {
    setWorkingId(domain.id);
    setError("");
    setMessage("");
    try {
      await api.delete(`/domains/${domain.id}`);
      await refreshDomains();
      setMessage(`${domain.hostname} disconnected.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "The domain couldn't be disconnected."));
    } finally {
      setWorkingId("");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-bold text-ink dark:text-white">Custom domains</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Verify a domain you control with DNS, then use it for new short links.
        Configure its DNS and HTTPS to route to this app before sharing links.
      </p>
      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={addDomain}>
        <label className="sr-only" htmlFor="custom-domain">Domain hostname</label>
        <input
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          id="custom-domain"
          onChange={(event) => setHostname(event.target.value)}
          placeholder="links.example.com"
          required
          value={hostname}
        />
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white" type="submit">Add domain</button>
      </form>
      {error && <p className="mt-3 text-sm text-rose-700 dark:text-rose-300" role="alert">{error}</p>}
      {message && <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300" role="status">{message}</p>}
      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading domains…</p>
      ) : domains.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No custom domains connected.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {domains.map((domain) => (
            <li className="py-4" key={domain.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink dark:text-white">{domain.hostname}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {domain.verifiedAt ? "Verified" : "Pending verification"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!domain.verifiedAt && (
                    <button
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700"
                      disabled={workingId === domain.id}
                      onClick={() => verifyDomain(domain)}
                      type="button"
                    >
                      Verify DNS
                    </button>
                  )}
                  <button
                    className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:text-rose-300"
                    disabled={workingId === domain.id}
                    onClick={() => removeDomain(domain)}
                    type="button"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
              {domain.verificationRecord && (
                <dl className="mt-3 grid gap-1 rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-950">
                  <div><dt className="inline font-semibold">Type: </dt><dd className="inline">{domain.verificationRecord.type}</dd></div>
                  <div className="break-all"><dt className="inline font-semibold">Name: </dt><dd className="inline">{domain.verificationRecord.name}</dd></div>
                  <div className="break-all"><dt className="inline font-semibold">Value: </dt><dd className="inline">{domain.verificationRecord.value}</dd></div>
                </dl>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default CustomDomainManager;
