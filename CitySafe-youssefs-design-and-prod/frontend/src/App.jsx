import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./app/Layout";

import MapPage from "./pages/MapPage";
import ReportPage from "./pages/ReportPage";
import SosPage from "./pages/SosPage";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";
import { Toaster } from "react-hot-toast";
import { useEffect, useState } from "react";
import client from "./lib/apiClient";
import { ErrorBoundary } from "./components/ErrorBoundary";

function AutoLogin({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("cs_token");
    if (token) {
      setReady(true);
      return;
    }
    client.post("/auth/login", { userId: "user_demo", password: "demo1234" })
      .then((res) => {
        localStorage.setItem("cs_token", res.data?.token || res.token);
        setReady(true);
      })
      .catch((err) => {
        console.error("Auto-login failed:", err);
        setReady(true);
      });
  }, []);

  if (!ready) {
    return (
      <div className="h-screen w-full flex items-center justify-center text-slate-500 font-medium">
        Connecting to backend...
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AutoLogin>
          <Layout>
            <Routes>
              <Route path="/" element={<ErrorBoundary><MapPage /></ErrorBoundary>} />
              <Route path="/report" element={<ErrorBoundary><ReportPage /></ErrorBoundary>} />
              <Route path="/sos" element={<ErrorBoundary><SosPage /></ErrorBoundary>} />
              <Route path="/dashboard" element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
              <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
            </Routes>
          </Layout>
        </AutoLogin>
        <Toaster position="top-center" />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
