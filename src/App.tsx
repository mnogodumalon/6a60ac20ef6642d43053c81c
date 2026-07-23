import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import ProjektePage from '@/pages/ProjektePage';
import ProjekteDetailPage from '@/pages/ProjekteDetailPage';
import AufgabenPage from '@/pages/AufgabenPage';
import AufgabenDetailPage from '@/pages/AufgabenDetailPage';
import PublicFormProjekte from '@/pages/public/PublicForm_Projekte';
import PublicFormAufgaben from '@/pages/public/PublicForm_Aufgaben';
// <public:imports>
// </public:imports>
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a60ac10150ed11a39476862" element={<PublicFormProjekte />} />
              <Route path="public/6a60ac133bfb4b8bb765f87b" element={<PublicFormAufgaben />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="projekte" element={<ProjektePage />} />
                <Route path="projekte/:id" element={<ProjekteDetailPage />} />
                <Route path="aufgaben" element={<AufgabenPage />} />
                <Route path="aufgaben/:id" element={<AufgabenDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
