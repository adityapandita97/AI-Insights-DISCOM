"""
Combined Capacity Planning Lambda — aggregates data from all 4 DynamoDB tables
to provide holistic capacity planning insights and scenario analysis.
Supports filtering by city and area_type (Commercial/Residential/Industrial).
"""
import json
import os
import boto3
from decimal import Decimal

dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
dt_table = dynamodb.Table(os.environ.get("DT_TABLE", "guj-discom-dt-meter"))
ev_table = dynamodb.Table(os.environ.get("EV_TABLE", "guj-discom-ev-charging"))
solar_table = dynamodb.Table(os.environ.get("SOLAR_TABLE", "guj-discom-solar-der"))
storage_table = dynamodb.Table(os.environ.get("STORAGE_TABLE", "guj-discom-energy-storage"))


class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


def paginated_scan(table_obj, city=None, area_type=None, target=500):
    """Scan with pagination to get enough filtered results across partitions."""
    scan_kwargs = {}
    filter_parts = []
    expr_values = {}
    expr_names = {}

    if city:
        filter_parts.append("#c = :city")
        expr_values[":city"] = city
        expr_names["#c"] = "city"
    if area_type:
        filter_parts.append("area_type = :at")
        expr_values[":at"] = area_type

    if filter_parts:
        scan_kwargs["FilterExpression"] = " AND ".join(filter_parts)
        scan_kwargs["ExpressionAttributeValues"] = expr_values
        if expr_names:
            scan_kwargs["ExpressionAttributeNames"] = expr_names

    all_items = []
    max_pages = 80
    pages = 0
    while len(all_items) < target and pages < max_pages:
        response = table_obj.scan(**scan_kwargs, Limit=5000)
        all_items.extend(response.get("Items", []))
        pages += 1
        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return all_items[:target]


def compute_capacity_plan(city=None, area_type=None):
    """Compute combined capacity plan across all data sources."""
    dt_items = paginated_scan(dt_table, city=city, area_type=area_type, target=2000)

    # EV table doesn't have area_type, only city
    ev_items = paginated_scan(ev_table, city=city, target=2000)

    solar_items = paginated_scan(solar_table, city=city, area_type=area_type, target=2000)
    storage_items = paginated_scan(storage_table, city=city, target=1000)

    # DT Load Summary
    dt_loads = [float(i.get("load_kw", 0)) for i in dt_items]
    unique_dts = set(i.get("dt_id") for i in dt_items)
    dt_summary = {
        "total_transformers": len(unique_dts),
        "avg_load_kw": round(sum(dt_loads) / len(dt_loads), 2) if dt_loads else 0,
        "peak_load_kw": round(max(dt_loads), 2) if dt_loads else 0,
        "readings": len(dt_items),
    }

    # EV Summary
    ev_energy = [float(i.get("energy_delivered_kwh", 0)) for i in ev_items]
    unique_chargers = set(i.get("charger_id") for i in ev_items)
    ev_summary = {
        "total_chargers": len(unique_chargers),
        "total_sessions": len(ev_items),
        "total_energy_kwh": round(sum(ev_energy), 1),
        "avg_session_energy_kwh": round(sum(ev_energy) / len(ev_energy), 1) if ev_energy else 0,
    }

    # Solar Summary
    solar_gen = [float(i.get("generation_kw", 0)) for i in solar_items]
    solar_export = [float(i.get("export_kw", 0)) for i in solar_items]
    unique_meters = set(i.get("meter_id") for i in solar_items)
    solar_summary = {
        "total_meters": len(unique_meters),
        "avg_generation_kw": round(sum(solar_gen) / len(solar_gen), 2) if solar_gen else 0,
        "avg_export_kw": round(sum(solar_export) / len(solar_export), 2) if solar_export else 0,
        "readings": len(solar_items),
    }

    # Storage Summary
    storage_soc = [float(i.get("soc_percent", 0)) for i in storage_items]
    storage_discharge = [float(i.get("discharge_kw", 0)) for i in storage_items if float(i.get("discharge_kw", 0)) > 0]
    unique_units = set(i.get("unit_id") for i in storage_items)
    storage_summary = {
        "total_units": len(unique_units),
        "avg_soc_percent": round(sum(storage_soc) / len(storage_soc), 1) if storage_soc else 0,
        "avg_discharge_kw": round(sum(storage_discharge) / len(storage_discharge), 1) if storage_discharge else 0,
        "readings": len(storage_items),
    }

    # Combined capacity assessment
    net_demand = dt_summary["avg_load_kw"] + ev_summary.get("avg_session_energy_kwh", 0) - solar_summary["avg_generation_kw"]
    peak_shaving_potential = storage_summary["avg_discharge_kw"]

    capacity_assessment = {
        "net_demand_kw": round(net_demand, 2),
        "peak_shaving_potential_kw": round(peak_shaving_potential, 2),
        "solar_offset_percent": round(
            (solar_summary["avg_generation_kw"] / dt_summary["avg_load_kw"]) * 100, 1
        ) if dt_summary["avg_load_kw"] > 0 else 0,
        "ev_load_impact_percent": round(
            (ev_summary["avg_session_energy_kwh"] / dt_summary["avg_load_kw"]) * 100, 1
        ) if dt_summary["avg_load_kw"] > 0 else 0,
    }

    return {
        "city_filter": city,
        "area_type_filter": area_type,
        "dt_load": dt_summary,
        "ev_charging": ev_summary,
        "solar_der": solar_summary,
        "energy_storage": storage_summary,
        "capacity_assessment": capacity_assessment,
    }


def run_scenario(base_plan, ev_growth_pct=50, solar_growth_pct=25, load_growth_pct=8):
    """Run what-if scenario on top of base capacity plan."""
    dt = base_plan["dt_load"]
    ev = base_plan["ev_charging"]
    solar = base_plan["solar_der"]
    storage = base_plan["energy_storage"]

    projected_load = dt["avg_load_kw"] * (1 + load_growth_pct / 100)
    projected_ev_energy = ev["avg_session_energy_kwh"] * (1 + ev_growth_pct / 100)
    projected_solar = solar["avg_generation_kw"] * (1 + solar_growth_pct / 100)

    projected_net = projected_load + projected_ev_energy - projected_solar
    peak_with_storage = projected_net - storage["avg_discharge_kw"]

    current_net = base_plan["capacity_assessment"]["net_demand_kw"]

    return {
        "scenario_params": {
            "ev_growth_pct": ev_growth_pct,
            "solar_growth_pct": solar_growth_pct,
            "load_growth_pct": load_growth_pct,
        },
        "current_net_demand_kw": round(current_net, 2),
        "projected_net_demand_kw": round(projected_net, 2),
        "projected_with_storage_kw": round(peak_with_storage, 2),
        "demand_increase_pct": round(
            ((projected_net - current_net) / current_net) * 100, 1
        ) if current_net > 0 else 0,
    }


def handler(event, context):
    """Lambda handler for combined capacity planning."""
    try:
        body = event
        if isinstance(event.get("body"), str):
            body = json.loads(event["body"])
        elif "inputText" in event:
            body = {"query": event["inputText"]}

        action = body.get("action", "plan")
        city = body.get("city")
        area_type = body.get("area_type")

        if action == "plan" or action == "summary":
            result = compute_capacity_plan(city=city, area_type=area_type)
        elif action == "scenario":
            base = compute_capacity_plan(city=city, area_type=area_type)
            ev_growth = int(body.get("ev_growth_pct", 50))
            solar_growth = int(body.get("solar_growth_pct", 25))
            load_growth = int(body.get("load_growth_pct", 8))
            result = run_scenario(base, ev_growth, solar_growth, load_growth)
        else:
            result = {"error": f"Unknown action: {action}"}

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps(result, cls=DecimalEncoder),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)}),
        }
