import { useState } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { API_BASE } from "../config";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CITIES = ["", "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhavnagar", "Jamnagar", "Junagadh", "Anand", "Mehsana", "Bharuch"];
const AREA_TYPES = ["", "Commercial", "Residential", "Industrial"];

export default function CapacityPlan() {
  const [city, setCity] = useState("");
  const [areaType, setAreaType] = useState("");
  const [evGrowth, setEvGrowth] = useState(50);
  const [solarGrowth, setSolarGrowth] = useState(25);
  const [loadGrowth, setLoadGrowth] = useState(8);
  const [plan, setPlan] = useState(null);
  const [scenario, setScenario] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/capacity-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "plan", city: city || undefined, area_type: areaType || undefined }),
      });
      setPlan(await res.json());
      setScenario(null);
    } catch {
      setPlan({ error: "API not available" });
    }
    setLoading(false);
  };

  const runScenario = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/capacity-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "scenario", city: city || undefined, area_type: areaType || undefined,
          ev_growth_pct: evGrowth, solar_growth_pct: solarGrowth, load_growth_pct: loadGrowth,
        }),
      });
      setScenario(await res.json());
    } catch {
      setScenario({ error: "API not available" });
    }
    setLoading(false);
  };

  const scenarioChart = scenario ? {
    labels: ["Current Net Demand", "Projected Net Demand", "With Storage"],
    datasets: [{
      label: "Demand (kW)",
      data: [scenario.current_net_demand_kw, scenario.projected_net_demand_kw, scenario.projected_with_storage_kw],
      backgroundColor: ["#3b82f6", "#f59e0b", "#10b981"],
      borderRadius: 8,
    }],
  } : null;

  const breakdownChart = plan ? {
    labels: ["DT Avg Load", "EV Avg Energy", "Solar Avg Gen", "Storage Avg Discharge"],
    datasets: [{
      label: "kW",
      data: [
        plan.dt_load?.avg_load_kw || 0,
        plan.ev_charging?.avg_session_energy_kwh || 0,
        plan.solar_der?.avg_generation_kw || 0,
        plan.energy_storage?.avg_discharge_kw || 0,
      ],
      backgroundColor: ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6"],
      borderRadius: 8,
    }],
  } : null;

  const filterLabel = [city, areaType].filter(Boolean).join(" — ") || "All Gujarat";

  return (
    <div>
      <div className="page-header">
        <h1>🏗️ Combined Capacity Planning</h1>
        <p>Holistic capacity assessment with area-type segmentation and what-if scenarios</p>
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
        <button onClick={fetchPlan}>Get Capacity Plan</button>
      </div>

      {loading && <div className="loading"><div className="spinner" /></div>}

      {plan && !plan.error && (
        <>
          <div style={{ marginBottom: 12, fontSize: 13, color: "var(--text-light)" }}>
            Showing: <strong>{filterLabel}</strong>
          </div>

          <div className="stats-grid">
            <div className="stat-card" style={{ borderLeft: "4px solid #3b82f6" }}>
              <div className="stat-label">⚡ Transformers</div>
              <div className="stat-value">{plan.dt_load?.total_transformers || 0}</div>
              <div className="stat-change">Avg: {plan.dt_load?.avg_load_kw || 0} kW | Peak: {plan.dt_load?.peak_load_kw || 0} kW</div>
            </div>
            <div className="stat-card" style={{ borderLeft: "4px solid #f59e0b" }}>
              <div className="stat-label">🔌 EV Chargers</div>
              <div className="stat-value">{plan.ev_charging?.total_chargers || 0}</div>
              <div className="stat-change">{(plan.ev_charging?.total_energy_kwh || 0).toLocaleString()} kWh total</div>
            </div>
            <div className="stat-card" style={{ borderLeft: "4px solid #10b981" }}>
              <div className="stat-label">☀️ Solar Meters</div>
              <div className="stat-value">{plan.solar_der?.total_meters || 0}</div>
              <div className="stat-change">Avg Gen: {plan.solar_der?.avg_generation_kw || 0} kW</div>
            </div>
            <div className="stat-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
              <div className="stat-label">🔋 Storage Units</div>
              <div className="stat-value">{plan.energy_storage?.total_units || 0}</div>
              <div className="stat-change">SoC: {plan.energy_storage?.avg_soc_percent || 0}%</div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Net Demand</div>
              <div className="stat-value">{plan.capacity_assessment?.net_demand_kw || 0} kW</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Solar Offset</div>
              <div className="stat-value">{plan.capacity_assessment?.solar_offset_percent || 0}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">EV Impact</div>
              <div className="stat-value">{plan.capacity_assessment?.ev_load_impact_percent || 0}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Peak Shaving</div>
              <div className="stat-value">{plan.capacity_assessment?.peak_shaving_potential_kw || 0} kW</div>
            </div>
          </div>

          {breakdownChart && (
            <div className="card">
              <div className="card-title">Energy Source Breakdown</div>
              <div className="chart-container" style={{ maxWidth: 600, margin: "0 auto" }}>
                <Bar data={breakdownChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-title">📊 Scenario Analysis</div>
            <div className="card-subtitle">Adjust growth parameters and run what-if scenarios</div>
            <div className="filters" style={{ marginTop: 16 }}>
              <label style={{ fontSize: 13 }}>
                EV Growth %
                <input type="number" value={evGrowth} onChange={(e) => setEvGrowth(+e.target.value)} style={{ width: 70, marginLeft: 8 }} />
              </label>
              <label style={{ fontSize: 13 }}>
                Solar Growth %
                <input type="number" value={solarGrowth} onChange={(e) => setSolarGrowth(+e.target.value)} style={{ width: 70, marginLeft: 8 }} />
              </label>
              <label style={{ fontSize: 13 }}>
                Load Growth %
                <input type="number" value={loadGrowth} onChange={(e) => setLoadGrowth(+e.target.value)} style={{ width: 70, marginLeft: 8 }} />
              </label>
              <button onClick={runScenario}>Run Scenario</button>
            </div>

            {scenario && !scenario.error && (
              <div style={{ marginTop: 20 }}>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Demand Change</div>
                    <div className="stat-value" style={{ color: scenario.demand_increase_pct > 15 ? "var(--danger)" : "var(--success)" }}>
                      {scenario.demand_increase_pct > 0 ? "+" : ""}{scenario.demand_increase_pct}%
                    </div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Current Net</div>
                    <div className="stat-value">{scenario.current_net_demand_kw} kW</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Projected Net</div>
                    <div className="stat-value">{scenario.projected_net_demand_kw} kW</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">With Storage</div>
                    <div className="stat-value">{scenario.projected_with_storage_kw} kW</div>
                  </div>
                </div>
                <div className="chart-container" style={{ maxWidth: 500, margin: "0 auto" }}>
                  <Bar data={scenarioChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
