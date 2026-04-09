import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import DtForecast from "./pages/DtForecast";
import EvForecast from "./pages/EvForecast";
import SolarForecast from "./pages/SolarForecast";
import CapacityPlan from "./pages/CapacityPlan";
import ChatBot from "./components/ChatBot";
import "./App.css";

const PAGES = {
  dashboard: Dashboard,
  dt: DtForecast,
  ev: EvForecast,
  solar: SolarForecast,
  capacity: CapacityPlan,
};

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [chatOpen, setChatOpen] = useState(false);
  const Page = PAGES[page] || Dashboard;

  return (
    <div className="app">
      <Sidebar activePage={page} onNavigate={setPage} />
      <main className="main-content">
        <Page />
      </main>
      <button className="chat-fab" onClick={() => setChatOpen(!chatOpen)} title="AI Assistant">
        💬
      </button>
      {chatOpen && <ChatBot onClose={() => setChatOpen(false)} />}
    </div>
  );
}
