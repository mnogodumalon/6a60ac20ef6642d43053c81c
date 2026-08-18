import '@/lib/sentry';
import '@/lib/stale-bundle';
import { Fragment, lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { locale, onLocaleChange, syncProfileLocale } from '@/i18n';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import PublicPagesAdmin from '@/pages/PublicPagesAdmin';
import ProjektePage from '@/pages/ProjektePage';
import ProjekteDetailPage from '@/pages/ProjekteDetailPage';
import AufgabenPage from '@/pages/AufgabenPage';
import AufgabenDetailPage from '@/pages/AufgabenDetailPage';
// <custom:imports>
const IntentProjektStartenPage = lazy(() => import('@/pages/intents/ProjektStartenPage'));
const IntentAufgabeErledigePage = lazy(() => import('@/pages/intents/AufgabeErledigePage'));
// </custom:imports>

// Lazy: public pages live outside <Layout> and only load on /#/public/:slug —
// dashboard users never pay for them, anonymous visitors skip the dashboard.
const PublicPage = lazy(() => import('@/pages/public/PublicPage'));

// Language switch = full remount below the router: every t()/label lookup
// re-evaluates, the la-* widgets re-read <html lang>. Sits INSIDE
// ActionsProvider so chat/drawer state survives a switch, and inside
// HashRouter so the current route survives (it re-reads the URL hash).
function LocaleGate({ children }: { children: React.ReactNode }) {
  // The i18n layer notifies for locale CHANGES and for catalog/overlay
  // ARRIVALS (same locale, new data). `setCurrent(locale)` bailed out on
  // the arrivals — when locales/pages.json lost the race against the first
  // paint, the page stayed frozen in the build language until the next
  // locale switch. A generation counter accepts every notification; the
  // key must include it because `children` is the same element object on
  // every gate render (React would bail out without the remount).
  const [gen, setGen] = useState(0);
  useEffect(() => onLocaleChange(() => setGen((g) => g + 1)), []);
  // Adopt the LA profile language (SSOT) — but never on public routes,
  // where the visitor's browser language governs (initPublicLocale).
  useEffect(() => {
    if (!window.location.hash.startsWith('#/public')) void syncProfileLocale();
  }, []);
  return <Fragment key={`${locale}:${gen}`}>{children}</Fragment>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <LocaleGate>
            <Routes>
              <Route path="public/:slug" element={<Suspense fallback={null}><PublicPage /></Suspense>} />
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="projekte" element={<ProjektePage />} />
                <Route path="projekte/:id" element={<ProjekteDetailPage />} />
                <Route path="aufgaben" element={<AufgabenPage />} />
                <Route path="aufgaben/:id" element={<AufgabenDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                <Route path="verwaltung/oeffentliche-seiten" element={<PublicPagesAdmin />} />
                {/* <custom:routes> */}
                <Route path="intents/projekt-starten" element={<Suspense fallback={null}><IntentProjektStartenPage /></Suspense>} />
                <Route path="intents/aufgabe-erledigen" element={<Suspense fallback={null}><IntentAufgabeErledigePage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
            </LocaleGate>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
