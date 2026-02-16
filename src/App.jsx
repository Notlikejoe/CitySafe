import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./app/Layout";

import MapPage from "./pages/MapPage";
import ReportPage from "./pages/ReportPage";
import SosPage from "./pages/SosPage";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/sos" element={<SosPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
