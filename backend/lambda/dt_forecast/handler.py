"""
DT Load Forecasting Lambda — queries DynamoDB for transformer data,
computes load trends, and returns forecasting insights.
"""
import json
import os
import boto3
from decimal import Decimal
from boto3.dynamodb.conditions import Key
from datetime import datetime, timedelta

dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
table = dynamodb.Table(os.environ.get("DT_TABLE", "guj-discom-dt-meter"))


class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


def query_dt_data(dt_id=None, city=None, area_type=None, limit=100):
    """Query DT meter data with optional filters."""
    if dt_id:
        response = table.query(
            KeyConditionExpression=Key("dt_id").eq(dt_id),
            ScanIndexForward=False,
            Limit=limit,
        )
        return response.get("Items", [])

    # Scan with filters for city/area_type — paginate to get enough filtered results
    filter_expr = None
    expr_values = {}
    expr_names = {}

    if city:
        filter_expr = "#c = :city"
        expr_values[":city"] = city
        expr_names["#c"] = "city"
    if area_type:
        at_expr = "area_type = :at"
        expr_values[":at"] = area_type
        filter_expr = f"{filter_expr} AND {at_expr}" if filter_expr else at_expr

    scan_kwargs = {}
    if filter_expr:
        scan_kwargs["FilterExpression"] = filter_expr
        scan_kwargs["ExpressionAttributeValues"] = expr_values
        if expr_names:
            scan_kwargs["ExpressionAttributeNames"] = expr_names

    all_items = []
    max_pages = 100
    pages = 0
    while len(all_items) < limit and pages < max_pages:
        response = table.scan(**scan_kwargs, Limit=5000)
        all_items.extend(response.get("Items", []))
        pages += 1
        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return all_items[:limit]


def compute_load_forecast(items):
    """Compute simple load trend and forecast from historical data."""
    if not items:
        return {"error": "No data found"}

    # Group by month
    monthly = {}
    for item in items:
        ts = item.get("timestamp", "")[:7]  # YYYY-MM
        load = float(item.get("load_kw", 0))
        if ts not in monthly:
            monthly[ts] = {"total_load": 0, "count": 0, "max_load": 0}
        monthly[ts]["total_load"] += load
        monthly[ts]["count"] += 1
        monthly[ts]["max_load"] = max(monthly[ts]["max_load"], load)

    # Sort by month
    sorted_months = sorted(monthly.keys())
    trend = []
    for m in sorted_months:
        d = monthly[m]
        trend.append({
            "month": m,
            "avg_load_kw": round(d["total_load"] / d["count"], 2),
            "peak_load_kw": round(d["max_load"], 2),
            "readings": d["count"],
        })

    # Simple linear growth projection
    if len(trend) >= 2:
        first_avg = trend[0]["avg_load_kw"]
        last_avg = trend[-1]["avg_load_kw"]
        months_span = len(trend)
        monthly_growth = (last_avg - first_avg) / months_span if months_span > 0 else 0
        annual_growth_pct = round((monthly_growth * 12 / first_avg) * 100, 1) if first_avg > 0 else 0

        # Forecast next 6 months
        forecast = []
        for i in range(1, 7):
            projected = round(last_avg + monthly_growth * i, 2)
            forecast.append({
                "month_offset": i,
                "projected_avg_load_kw": projected,
            })
    else:
        annual_growth_pct = 0
        forecast = []

    return {
        "historical_trend": trend[-12:],  # last 12 months
        "annual_growth_percent": annual_growth_pct,
        "forecast_next_6_months": forecast,
        "total_readings_analyzed": len(items),
    }


def handler(event, context):
    """Lambda handler for DT load forecasting."""
    try:
        # Parse input — could come from API GW or Bedrock agent
        body = event
        if isinstance(event.get("body"), str):
            body = json.loads(event["body"])
        elif "inputText" in event:
            # Bedrock agent invocation
            body = {"query": event["inputText"]}

        action = body.get("action", "forecast")
        dt_id = body.get("dt_id")
        city = body.get("city")
        area_type = body.get("area_type")
        limit = int(body.get("limit", 500))

        if action == "list_transformers":
            items = query_dt_data(city=city, area_type=area_type, limit=50)
            unique_dts = list({item["dt_id"]: item for item in items}.values())
            result = {
                "transformers": [
                    {"dt_id": d["dt_id"], "city": d.get("city"), "area_type": d.get("area_type"),
                     "capacity_kva": float(d.get("capacity_kva", 0))}
                    for d in unique_dts
                ]
            }
        elif action == "forecast":
            items = query_dt_data(dt_id=dt_id, city=city, area_type=area_type, limit=limit)
            result = compute_load_forecast(items)
            result["filters"] = {"dt_id": dt_id, "city": city, "area_type": area_type}
        elif action == "raw_data":
            items = query_dt_data(dt_id=dt_id, city=city, area_type=area_type, limit=limit)
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
