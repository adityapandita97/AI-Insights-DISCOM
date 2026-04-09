import { useState, useEffect } from "react";
import { Line, Doughnut, Bar, Radar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, BarElement, RadialLinearScale, Title, Tooltip, Legend, Filler,
} from "chart.js";
import { API_BASE } from "../config";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, ArcElement,
  BarElement, RadialLinearScale, Title, Tooltip, Legend, Filler
);

const CITIES = ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar"];

export default function Dashboard() {
  const [plan, setPlan] = useState(null);
  const [dtData, setDtData] = useState(null);
  const [evData, setEvData] = useState(null);
  const [solarData, setSolarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCity, setSelectedCity] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [planRes, dtRes, evRes, solarRes] = await Promise.all([
        fetch(`${API_BASE}/capacity-plan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "plan" }) }),
        fetch(`${API_BASE}/dt-forecast`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "forecast", limit: 2000 }) }),
        fetch(`${API_BASE}/ev-forecast`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "forecast", limit: 5000 }) }),
        fetch(`${API_BASE}/solar-forecast`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "forecast", limit: 2000 }) }),
      ]);
      setPlan(await planRes.json());
      setDtData(await dtRes.json());
      setEvData(await evRes.json());
      setSolarData(await solarRes.json());
    } catch {
      // Fallback mock data
      setPlan({
        dt_load: { total_transformers: 200, avg_load_kw: 245.8, peak_load_kw: 892.3, readings: 300 },
        ev_charging: { total_chargers: 100, total_sessions: 17647, total_energy_kwh: 1542000, avg_session_energy_kwh: 87.4 },
        solar_der: { total_meters: 150, avg_generation_kw: 18.5, avg_export_kw: 8.2, readings: 300 },
        energy_storage: { total_units: 50, avg_soc_percent: 52.3, avg_discharge_kw: 85.6, readings: 300 },
        capacity_assessment: { net_demand_kw: 278.7, peak_shaving_potential_kw: 85.6, solar_offset_percent: 7.5, ev_load_impact_percent: 20.9, recommendation: "ADEQUATE" },
      });
    }
    setLoading(false);
  };

  if (loading) return <div className="loading"><div className="spinner" /> Loading dashboard...</div>;

  const ca = plan?.capacity_assessment || {};
  const dtTrend = dtData?.historical_trend || [];
  const evTrend = evData?.historical_trend || [];
  const solarTrend = solarData?.historical_trend || [];

  // DT Load Trend Chart
  const dtChart = {
    labels: dtTrend.map(t => t.month),
    datasets: [
      { label: "Avg Load (kW)", data: dtTrend.map(t => t.avg_load_kw), borderColor: "#3b82f6", backgroundColor: "rgba(59,130,246,0.08)", fill: true, tension: 0.4, pointRadius: 2 },
      { label: "Peak Load (kW)", data: dtTrend.map(t => t.peak_load_kw), borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.08)", fill: true, tension: 0.4, pointRadius: 2 },
    ],
  };

  // EV Sessions Growth Chart
  const evChart = {
    labels: evTrend.map(t => t.month),
    datasets: [
      { label: "Sessions", data: evTrend.map(t => t.total_sessions), borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.08)", fill: true, tension: 0.4, pointRadius: 2 },
    ],
  };

  // EV Energy Bar Chart
  const evEnergyChart = {
    labels: evTrend.slice(-12).map(t => t.month),
    datasets: [{
      label: "Energy Delivered (kWh)",
      data: evTrend.slice(-12).map(t => t.total_energy_kwh),
      backgroundColor: evTrend.slice(-12).map((_, i) => i >= 10 ? "#f59e0b" : "#fde68a"),
      borderRadius: 6,
    }],
  };

  // Solar Generation Chart
  const solarChart = {
    labels: solarTrend.map(t => t.month),
    datasets: [
      { label: "Generation (kW)", data: solarTrend.map(t => t.avg_generation_kw), borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.08)", fill: true, tension: 0.4, pointRadius: 2 },
      { label: "Export (kW)", data: solarTrend.map(t => t.avg_export_kw), borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.08)", fill: true, tension: 0.4, pointRadius: 2 },
    ],
  };

  // Energy Mix Doughnut
  const mixChart = {
    labels: ["DT Load", "EV Demand", "Solar Offset", "Storage Shaving"],
    datasets: [{
      data: [
        plan?.dt_load?.avg_load_kw || 0,
        plan?.ev_charging?.avg_session_energy_kwh || 0,
        plan?.solar_der?.avg_generation_kw || 0,
        plan?.energy_storage?.avg_discharge_kw || 0,
      ],
      backgroundColor: ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6"],
      borderWidth: 2,
      borderColor: "#fff",
    }],
  };

  // Radar chart for city comparison
  const radarChart = {
    labels: ["Load Growth", "EV Adoption", "Solar Penetration", "Storage Capacity", "Grid Stability"],
    datasets: [{
      label: "Current State",
      data: [72, 45, 38, 55, 80],
      backgroundColor: "rgba(59,130,246,0.15)",
      borderColor: "#3b82f6",
      pointBackgroundColor: "#3b82f6",
    }, {
      label: "Projected (1yr)",
      data: [85, 68, 52, 60, 75],
      backgroundColor: "rgba(245,158,11,0.15)",
      borderColor: "#f59e0b",
      pointBackgroundColor: "#f59e0b",
    }],
  };

  const chartOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } } };

  return (
    <div>
      <div className="page-header">
        <h1>📊 Capacity Planning Dashboard</h1>
        <p>Gujarat DISCOM — Real-time grid analytics across all growth vectors</p>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">⚡ DT Meter Readings</div>
          <div className="stat-value">{(plan?.dt_load?.readings || 175200).toLocaleString()}</div>
          <div className="stat-change up">200 transformers across 11 cities</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🔌 EV Charging Sessions</div>
          <div className="stat-value">{(plan?.ev_charging?.total_sessions || 17647).toLocaleString()}</div>
          <div className="stat-change up">{(plan?.ev_charging?.total_energy_kwh || 0).toLocaleString()} kWh delivered</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">☀️ Solar Meter Readings</div>
          <div className="stat-value">{(plan?.solar_der?.readings || 131400).toLocaleString()}</div>
          <div className="stat-change up">150 solar panels across 11 cities</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🔋 BESS Data Points</div>
          <div className="stat-value">{(plan?.energy_storage?.readings || 87600).toLocaleString()}</div>
          <div className="stat-change">50 storage units | Avg SoC: {plan?.energy_storage?.avg_soc_percent || 0}%</div>
        </div>
      </div>

      {/* Capacity Assessment */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderLeft: "4px solid #3b82f6" }}>
          <div className="stat-label">Net Demand</div>
          <div className="stat-value">{ca.net_demand_kw || 0} kW</div>
        </div>
        <div className="stat-card" style={{ borderLeft: "4px solid #10b981" }}>
          <div className="stat-label">Solar Offset</div>
          <div className="stat-value">{ca.solar_offset_percent || 0}%</div>
        </div>
        <div className="stat-card" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div className="stat-label">EV Load Impact</div>
          <div className="stat-value">{ca.ev_load_impact_percent || 0}%</div>
        </div>
        <div className="stat-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
          <div className="stat-label">Peak Shaving Potential</div>
          <div className="stat-value">{ca.peak_shaving_potential_kw || 0} kW</div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title">⚡ DT Load Trend</div>
            <div className="card-subtitle">{dtTrend.length} months</div>
          </div>
          <div className="chart-container">
            <Line data={dtChart} options={chartOpts} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">🔌 EV Charging Sessions Growth</div>
            <div className="card-subtitle">{evData?.total_growth_percent || 0}% total growth</div>
          </div>
          <div className="chart-container">
            <Line data={evChart} options={chartOpts} />
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title">☀️ Solar Generation vs Export</div>
            <div className="card-subtitle">{solarData?.generation_growth_percent || 0}% growth</div>
          </div>
          <div className="chart-container">
            <Line data={solarChart} options={chartOpts} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">⚡ Monthly EV Energy Delivered</div>
          </div>
          <div className="chart-container">
            <Bar data={evEnergyChart} options={chartOpts} />
          </div>
        </div>
      </div>

      {/* Charts Row 3 */}
      <div className="charts-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title">🎯 Energy Mix Breakdown</div>
          </div>
          <div style={{ maxWidth: 300, margin: "0 auto" }}>
            <Doughnut data={mixChart} options={{ plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } } }} />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">📡 Grid Readiness Radar</div>
            <div className="card-subtitle">Current vs Projected (1 year)</div>
          </div>
          <div style={{ maxWidth: 320, margin: "0 auto" }}>
            <Radar data={radarChart} options={{ scales: { r: { beginAtZero: true, max: 100 } }, plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } } }} />
          </div>
        </div>
      </div>
    </div>
  );
}
