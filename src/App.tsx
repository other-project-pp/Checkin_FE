import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import HeaderTabs from "./components/layout/HeaderTabs";
import SettingsPage from "./pages/SettingPage";
import DiscordStatusPage from "./pages/DiscordStatusPage";
import DiscordStatusPage1 from "./pages/DiscordStatusPagenew88";

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout header={<HeaderTabs />}>
        <Routes>
          <Route path="/" element={<DiscordStatusPage />} />
          <Route path="/discord88" element={<DiscordStatusPage1 />} />
          <Route path="/setting" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
