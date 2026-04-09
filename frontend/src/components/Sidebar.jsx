const NAV_ITEMS = [
  { id: "dashboard", icon: "📊", label: "Dashboard" },
  { id: "dt", icon: "⚡", label: "DT Load Forecast" },
  { id: "ev", icon: "🔌", label: "EV Demand Growth" },
  { id: "solar", icon: "☀️", label: "Solar/DER Forecast" },
  { id: "capacity", icon: "🏗️", label: "Capacity Planning" },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>⚡ Gujarat DISCOM</h2>
        <p>AI Capacity Planning</p>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
