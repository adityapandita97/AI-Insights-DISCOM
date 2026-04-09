import { useState } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from "chart.js";
import { API_BASE } from "../config";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const CITIES = ["", "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhavnagar", "Jamnagar"];

export default function SolarForecast() {
  const [city, setCity] = useState("");
  const [areaType, setAreaType] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/solar-forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "forecast", city: city || undefined, area_type: areaType || undefined }),
      });
      setData(await res.json());
    } catch {
      setData({ error: "API not available. Deploy backend first." });
    }
    setLoading(false);
  };

  const trend = data?.historical_trend || [];

  const genChart = {
    labels: trend.map((t) => t.month),
    datasets: [
      { label: "Avg Generation (kW)", data: trend.map((t) => t.avg_generation_kw), borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.1)", fill: true, tension: 0.3 },
      { label: "Avg Export (kW)", data: trend.map((t) => t.avg_export_kw), borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.1)", fill: true, tension: 0.3 },
      { label: "Avg Consumption (kW)", data: trend.map((t) => t.avg_consumption_kw), borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.1)", fill: true, tension: 0.3 },
    ],
  };

  const irradianceChart = {
    labels: trend.map((t) => t.month),
    datasets: [{
      label: "Avg Irradiance (W/m²)",
      data: trend.map((t) => t.avg_irradiance_wm2),
      borderColor: "#8b5cf6",
      backgroundColor: "rgba(139,92,246,0.1)",
      fill: true, tension: 0.3,
    }],
  };

  return (
    <div>
      <div className="page-header">
        <h1>☀️ Solar/DER Generation Forecast</h1>
        <p>Solar generation trends, net metering impact, and growth projections</p>
      </div>

      <div className="filters">
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">All Cities</option>
          {CITIES.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={areaType} onChange={(e) => setAreaType(e.target.value)}>
          <option value="">All Areas</option>
          {["Commercial", "Residential", "Industrial"].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={fetchForecast}>Run Forecast</button>
      </div>

      {loading && <div className="loading"><div className="spinner" /></div>}
      {data?.error && <div className="card"><p style={{ color: "var(--danger)" }}>{data.error}</p></div>}

      {data && !data.error && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Generation Growth</div>
              <div className="stat-value">{data.generation_growth_percent || 0}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Readings Analyzed</div>
              <div className="stat-value">{data.total_readings_analyzed || 0}</div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="card">
              <div className="card-title">Generation vs Export vs Consumption</div>
              <div className="chart-container">
                <Line data={genChart} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
            <div className="card">
              <div className="card-title">Solar Irradiance Trend</div>
              <div className="chart-container">
                <Line data={irradianceChart} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </div>

          {trend.length > 0 && (
            <div className="card">
              <div className="card-title">Monthly Solar Data</div>
              <table className="data-table">
                <thead>
                  <tr><th>Month</th><th>Gen (kW)</th><th>Export (kW)</th><th>Net Export Ratio</th><th>Irradiance</th></tr>
                </thead>
                <tbody>
                  {trend.map((t) => (
                    <tr key={t.month}>
                      <td>{t.month}</td><td>{t.avg_generation_kw}</td><td>{t.avg_export_kw}</td>
                      <td>{(t.net_export_ratio * 100).toFixed(0)}%</td><td>{t.avg_irradiance_wm2} W/m²</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
