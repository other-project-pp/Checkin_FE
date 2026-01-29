import { BrowserRouter, Routes, Route  } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import HeaderTabs from "./components/layout/HeaderTabs";
import DashboardPage from "./pages/DashboardPage";
import LatestPage from "./pages/LatestPage";
import PreviousPage from "./pages/PreviousPage";
import DailyPage from "./pages/DailyPage";
import AbsencePage from "./pages/DayOffPage";
import SettingsPage from "./pages/SettingPage";
import TelegramHookPage from "./pages/TelegramHookPage";
import { Box, Typography } from "@mui/material";
import DiscordStatusPage from "./pages/DiscordStatusPage";

function Placeholder({ title }: { title: string }) {
  return (
    <Box sx={{ p: 1 }}>
      <Typography color="text.secondary">{title} (coming soon)</Typography>
    </Box>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout header={<HeaderTabs />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/latest" element={<LatestPage />} />
          <Route path="/previous" element={<PreviousPage/>} />
          <Route path="/daily" element={<DailyPage/>} />
          <Route path="/absence" element={<AbsencePage />} />
          <Route path="/setting" element={<SettingsPage />} />
          <Route path="/discord" element={<DiscordStatusPage />} />
          <Route path="/telegram" element={<TelegramHookPage />} />
          <Route path="/test" element={<Placeholder title="สรุปรายวัน" />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
