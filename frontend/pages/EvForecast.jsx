import { useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from "chart.js";
import { API_BASE } from "../config";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const CITIES = ["", "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhavnagar", "Jamnagar"];

export default function EvForecast() {
  const [city, setCity] = useState("");
  const [locType, setLocType] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ev-forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "forecast", city: city || undefined, location_type: locType || undefined }),
      });
      setData(await res.json());
    } catch {
      setData({ error: "API not available. Deploy backend first." });
    }
    setLoading(false);
  };

  const trend = data?.historical_trend || [];
  const forecast = data?.forecast_next_6_months || [];

  const sessionsChart = {
    labels: trend.map((t) => t.month),
    datasets: [{
      label: "Total Sessions",
      data: trend.map((t) => t.total_sessions),
      borderColor: "#f59e0b",
      backgroundColor: "rgba(245,158,11,0.1)",
      fill: true, tension: 0.3,
    }],
  };

  const energyChart = {
    labels: trend.map((t) => t.month),
    datasets: [{
      label: "Energy Delivered (kWh)",
      data: trend.map((t) => t.total_energy_kwh),
      backgroundColor: "#10b981",
      borderRadius: 6,
    }],
  };

  const forecastChart = {
    labels: forecast.map((f) => `+${f.month_offset}mo`),
    datasets: [
      { label: "Projected Sessions", data: forecast.map((f) => f.projected_sessions), backgroundColor: "#f59e0b", borderRadius: 6 },
      { label: "Projected Energy (kWh)", data: forecast.map((f) => f.projected_energy_kwh), backgroundColor: "#10b981", borderRadius: 6 },
    ],
  };

  return (
    <div>
      <div className="page-header">
        <h1>🔌 EV Charging Demand Growth</h1>
        <p>EV adoption trends, charging patterns, and demand projections</p>
      </div>

      <div className="filters">
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">All Cities</option>
          {CITIES.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={locType} onChange={(e) => setLocType(e.target.value)}>
          <option value="">All Locations</option>
          {["Highway", "Mall", "Office", "Residential", "Public"].map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button onClick={fetchForecast}>Run Forecast</button>
      </div>

      {loading && <div className="loading"><div className="spinner" /></div>}
      {data?.error && <div className="card"><p style={{ color: "var(--danger)" }}>{data.error}</p></div>}

      {data && !data.error && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Total Growth</div>
              <div className="stat-value">{data.total_growth_percent || 0}%</div>
              <div className="stat-change up">Over analysis period</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sessions Analyzed</div>
              <div className="stat-value">{data.total_sessions_analyzed || 0}</div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="card">
              <div className="card-title">Monthly Charging Sessions</div>
              <div className="chart-container">
                <Line data={sessionsChart} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
            <div className="card">
              <div className="card-title">Monthly Energy Delivered</div>
              <div className="chart-container">
                <Bar data={energyChart} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </div>

          {forecast.length > 0 && (
            <div className="card">
              <div className="card-title">6-Month Demand Projection</div>
              <div className="chart-container">
                <Bar data={forecastChart} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
