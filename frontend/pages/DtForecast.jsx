import { useState } from "react";
import { Line, Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from "chart.js";
import { API_BASE } from "../config";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

const CITIES = ["", "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhavnagar", "Jamnagar"];
const AREA_TYPES = ["", "Commercial", "Residential", "Industrial"];

export default function DtForecast() {
  const [city, setCity] = useState("");
  const [areaType, setAreaType] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchForecast = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/dt-forecast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "forecast", city: city || undefined, area_type: areaType || undefined, limit: 1000 }),
      });
      setData(await res.json());
    } catch {
      setData({ error: "API not available. Deploy backend first." });
    }
    setLoading(false);
  };

  const trend = data?.historical_trend || [];
  const forecast = data?.forecast_next_6_months || [];

  const trendChart = {
    labels: trend.map((t) => t.month),
    datasets: [
      {
        label: "Avg Load (kW)",
        data: trend.map((t) => t.avg_load_kw),
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.1)",
        fill: true,
        tension: 0.3,
      },
      {
        label: "Peak Load (kW)",
        data: trend.map((t) => t.peak_load_kw),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.1)",
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const forecastChart = {
    labels: forecast.map((f) => `+${f.month_offset}mo`),
    datasets: [{
      label: "Projected Avg Load (kW)",
      data: forecast.map((f) => f.projected_avg_load_kw),
      backgroundColor: "#8b5cf6",
      borderRadius: 6,
    }],
  };

  return (
    <div>
      <div className="page-header">
        <h1>⚡ DT Load Forecasting</h1>
        <p>Distribution Transformer load trends and demand projections</p>
      </div>

      <div className="filters">
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">All Cities</option>
          {CITIES.filter(Boolean).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={areaType} onChange={(e) => setAreaType(e.target.value)}>
          <option value="">All Area Types</option>
          {AREA_TYPES.filter(Boolean).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button onClick={fetchForecast}>Run Forecast</button>
      </div>

      {loading && <div className="loading"><div className="spinner" /></div>}

      {data?.error && <div className="card"><p style={{ color: "var(--danger)" }}>{data.error}</p></div>}

      {data && !data.error && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Annual Growth</div>
              <div className="stat-value">{data.annual_growth_percent || 0}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Readings Analyzed</div>
              <div className="stat-value">{data.total_readings_analyzed || 0}</div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="card">
              <div className="card-title">Historical Load Trend</div>
              <div className="chart-container">
                <Line data={trendChart} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
            <div className="card">
              <div className="card-title">6-Month Forecast</div>
              <div className="chart-container">
                <Bar data={forecastChart} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            </div>
          </div>

          {trend.length > 0 && (
            <div className="card">
              <div className="card-title">Monthly Data</div>
              <table className="data-table">
                <thead>
                  <tr><th>Month</th><th>Avg Load (kW)</th><th>Peak Load (kW)</th><th>Readings</th></tr>
                </thead>
                <tbody>
                  {trend.map((t) => (
                    <tr key={t.month}>
                      <td>{t.month}</td><td>{t.avg_load_kw}</td><td>{t.peak_load_kw}</td><td>{t.readings}</td>
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
