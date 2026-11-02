import { lazy, Suspense, useEffect, useState } from "react";
import AuthPage from "./pages/AuthPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";

const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage.jsx"));

function Application() {
  const { user, loading, signIn, register, signOut } = useAuth();
  const [view, setView] = useState("home");
  const [analyticsLink, setAnalyticsLink] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("shortly.theme");
    return savedTheme
      ? savedTheme === "dark"
      : window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("shortly.theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (user && (view === "login" || view === "register")) {
      setView("dashboard");
    }
    if (!user && (view === "dashboard" || view === "analytics") && !loading) {
      setView("home");
    }
  }, [user, loading, view]);

  async function handleAuthentication(credentials) {
    const action = view === "register" ? register : signIn;
    await action(credentials);
    setView("dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-ink transition-colors dark:bg-slate-950 dark:text-white">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <button
            aria-label="Go to Shortly home"
            className="text-xl font-bold tracking-tight text-ink dark:text-white"
            onClick={() => setView("home")}
            type="button"
          >
            shortly<span className="text-accent">.</span>
          </button>
          <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <button className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 sm:block dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => setView("home")} type="button">Shorten a link</button>
                <button className={`rounded-lg px-3 py-2 text-sm font-semibold ${view === "dashboard" ? "bg-indigo-50 text-accent dark:bg-indigo-950/50" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`} onClick={() => setView("dashboard")} type="button">Dashboard</button>
                <span className="hidden max-w-40 truncate text-sm text-slate-500 md:block dark:text-slate-400">{user.email}</span>
                <button className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => {
                  signOut();
                  setView("home");
                }} type="button">Sign out</button>
              </>
            ) : (
              <>
                <button className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => setView("login")} type="button">Sign in</button>
                <button className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-600 sm:px-4" onClick={() => setView("register")} type="button">Get started</button>
              </>
            )}
            <button
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              className="ml-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setDarkMode((value) => !value)}
              type="button"
            >
              {darkMode ? "Light" : "Dark"}
            </button>
          </nav>
        </div>
      </header>

      {loading ? (
        <main className="flex min-h-[70vh] items-center justify-center" role="status">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-accent" aria-hidden="true" />
          <span className="sr-only">Checking your session…</span>
        </main>
      ) : view === "login" || view === "register" ? (
        <AuthPage
          mode={view}
          onAuthenticated={handleAuthentication}
          onNavigate={setView}
        />
      ) : view === "dashboard" && user ? (
        <DashboardPage
          onViewAnalytics={(link) => {
            setAnalyticsLink(link);
            setView("analytics");
          }}
        />
      ) : view === "analytics" && user && analyticsLink ? (
        <Suspense fallback={<main className="flex min-h-[60vh] items-center justify-center" role="status">Loading analytics…</main>}>
          <AnalyticsPage link={analyticsLink} onBack={() => setView("dashboard")} />
        </Suspense>
      ) : (
        <LandingPage onNavigate={setView} />
      )}

      <footer className="border-t border-slate-200 px-5 py-5 text-center text-xs text-slate-400 dark:border-slate-800">
        Shortly · Make every link count.
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Application />
    </AuthProvider>
  );
}

export default App;
