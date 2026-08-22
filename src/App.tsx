import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ShellProvider } from './context/ShellContext';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { ProtectedRoute } from './components/navigation/ProtectedRoute';
import { PublicLayout } from './components/layout/PublicLayout';
import { AppShell } from './components/layout/AppShell';

import { LandingPage } from './pages/public/LandingPage';
import { LoginPage } from './pages/public/LoginPage';
import { SignupPage } from './pages/public/SignupPage';
import { AppOverviewPage } from './pages/app/AppOverviewPage';
import { TasksPage } from './pages/app/TasksPage';
import { GoalsPage } from './pages/app/GoalsPage';
import { HabitsPage } from './pages/app/HabitsPage';
import { FinancesPage } from './pages/app/FinancesPage';
import { EmotionsPage } from './pages/app/EmotionsPage';
import { RelationshipsPage } from './pages/app/RelationshipsPage';
import { NotesPage } from './pages/app/NotesPage';
import { InsightsPage } from './pages/app/InsightsPage';
import { ArchitecturePage } from './pages/app/ArchitecturePage';
import { SettingsPage } from './pages/app/SettingsPage';
import { AIPage } from './pages/app/AIPage';
import { ModulePlaceholderPage } from './pages/app/ModulePlaceholderPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { GenericErrorPage } from './pages/GenericErrorPage';

export default function App() {
  return (
    <ErrorBoundary fallback={<GenericErrorPage />}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <ShellProvider>
              <BrowserRouter>
                <Routes>
                  {/* Public Route Group */}
                  <Route element={<PublicLayout />}>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                  </Route>

                  {/* Protected Application Workspace */}
                  <Route
                    path="/app"
                    element={
                      <ProtectedRoute>
                        <AppShell />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<AppOverviewPage />} />
                    <Route path="tasks" element={<TasksPage />} />
                    <Route path="goals" element={<GoalsPage />} />
                    <Route path="habits" element={<HabitsPage />} />
                    <Route path="finances" element={<FinancesPage />} />
                    <Route path="emotions" element={<EmotionsPage />} />
                    <Route path="relationships" element={<RelationshipsPage />} />
                    <Route path="notes" element={<NotesPage />} />
                    <Route path="insights" element={<InsightsPage />} />
                    <Route path="ai" element={<AIPage />} />
                    <Route path="architecture" element={<ArchitecturePage />} />
                    <Route path="settings" element={<SettingsPage />} />
                  </Route>

                  {/* Errors and Catch-All Fallback */}
                  <Route path="/404" element={<NotFoundPage />} />
                  <Route path="/500" element={<GenericErrorPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </BrowserRouter>
            </ShellProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
