"""
EV Charging Demand Growth Lambda — queries DynamoDB for EV charging data,
computes adoption trends and demand growth projections.
"""
import json
import os
import boto3
from decimal import Decimal
from datetime import datetime

dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
table = dynamodb.Table(os.environ.get("EV_TABLE", "guj-discom-ev-charging"))


class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


def scan_ev_data(city=None, connector_type=None, location_type=None, limit=1000):
    """Scan EV charging data with optional filters."""
    filter_parts = []
    expr_values = {}
    expr_names = {}

    if city:
        filter_parts.append("#c = :city")
        expr_values[":city"] = city
        expr_names["#c"] = "city"
    if connector_type:
        filter_parts.append("connector_type = :ct")
        expr_values[":ct"] = connector_type
    if location_type:
        filter_parts.append("location_type = :lt")
        expr_values[":lt"] = location_type

    scan_kwargs = {"Limit": limit}
    if filter_parts:
        scan_kwargs["FilterExpression"] = " AND ".join(filter_parts)
        scan_kwargs["ExpressionAttributeValues"] = expr_values
        if expr_names:
            scan_kwargs["ExpressionAttributeNames"] = expr_names

    response = table.scan(**scan_kwargs)
    return response.get("Items", [])


def compute_ev_growth(items):
    """Compute EV charging adoption trends and demand projections."""
    if not items:
        return {"error": "No EV charging data found"}

    monthly = {}
    for item in items:
        month = item.get("month_year", item.get("start_time", "")[:7])
        energy = float(item.get("energy_delivered_kwh", 0))
        duration = float(item.get("session_duration_min", 0))
        peak = float(item.get("peak_power_kw", 0))

        if month not in monthly:
            monthly[month] = {"sessions": 0, "total_energy": 0, "total_duration": 0, "max_peak": 0}
        monthly[month]["sessions"] += 1
        monthly[month]["total_energy"] += energy
        monthly[month]["total_duration"] += duration
        monthly[month]["max_peak"] = max(monthly[month]["max_peak"], peak)

    sorted_months = sorted(monthly.keys())
    trend = []
    for m in sorted_months:
        d = monthly[m]
        trend.append({
            "month": m,
            "total_sessions": d["sessions"],
            "total_energy_kwh": round(d["total_energy"], 1),
            "avg_session_duration_min": round(d["total_duration"] / d["sessions"], 1) if d["sessions"] > 0 else 0,
            "peak_demand_kw": round(d["max_peak"], 1),
        })

    # Growth calculation
    if len(trend) >= 2:
        first = trend[0]["total_sessions"]
        last = trend[-1]["total_sessions"]
        months = len(trend)
        if first > 0:
            total_growth = (last - first) / first * 100
            monthly_growth = total_growth / months
        else:
            total_growth = 0
            monthly_growth = 0

        # Project next 6 months
        forecast = []
        for i in range(1, 7):
            projected_sessions = round(last * (1 + monthly_growth / 100) ** i)
            projected_energy = round(trend[-1]["total_energy_kwh"] * (1 + monthly_growth / 100) ** i, 1)
            forecast.append({
                "month_offset": i,
                "projected_sessions": projected_sessions,
                "projected_energy_kwh": projected_energy,
            })
    else:
        total_growth = 0
        forecast = []

    return {
        "historical_trend": trend[-12:],
        "total_growth_percent": round(total_growth, 1),
        "forecast_next_6_months": forecast,
        "total_sessions_analyzed": len(items),
    }


def handler(event, context):
    """Lambda handler for EV demand growth forecasting."""
    try:
        body = event
        if isinstance(event.get("body"), str):
            body = json.loads(event["body"])
        elif "inputText" in event:
            body = {"query": event["inputText"]}

        action = body.get("action", "forecast")
        city = body.get("city")
        connector_type = body.get("connector_type")
        location_type = body.get("location_type")
        limit = int(body.get("limit", 1000))

        if action == "forecast":
            items = scan_ev_data(city=city, connector_type=connector_type,
                                location_type=location_type, limit=limit)
            result = compute_ev_growth(items)
            result["filters"] = {"city": city, "connector_type": connector_type,
                                 "location_type": location_type}
        elif action == "raw_data":
            items = scan_ev_data(city=city, limit=limit)
            result = {"data": items[:50], "total_returned": len(items)}
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
