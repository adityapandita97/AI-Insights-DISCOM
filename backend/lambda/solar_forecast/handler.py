"""
Solar/DER Generation Forecasting Lambda — queries DynamoDB for solar data,
computes generation trends and net metering impact.
"""
import json
import os
import boto3
from decimal import Decimal
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
table = dynamodb.Table(os.environ.get("SOLAR_TABLE", "guj-discom-solar-der"))


class DecimalEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return float(o)
        return super().default(o)


def query_solar_data(meter_id=None, city=None, area_type=None, limit=500):
    """Query solar/DER data with pagination to handle filtered scans."""
    if meter_id:
        response = table.query(
            KeyConditionExpression=Key("meter_id").eq(meter_id),
            ScanIndexForward=False,
            Limit=limit,
        )
        return response.get("Items", [])

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

    scan_kwargs = {}
    if filter_parts:
        scan_kwargs["FilterExpression"] = " AND ".join(filter_parts)
        scan_kwargs["ExpressionAttributeValues"] = expr_values
        if expr_names:
            scan_kwargs["ExpressionAttributeNames"] = expr_names

    # Paginate to collect enough filtered results
    all_items = []
    max_pages = 100  # scan up to 200K items to find filtered matches
    pages = 0
    while len(all_items) < limit and pages < max_pages:
        response = table.scan(**scan_kwargs, Limit=5000)
        all_items.extend(response.get("Items", []))
        pages += 1
        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return all_items[:limit]


def compute_solar_forecast(items):
    """Compute solar generation trends and net metering impact."""
    if not items:
        return {"error": "No solar data found"}

    monthly = {}
    for item in items:
        month = item.get("timestamp", "")[:7]
        gen = float(item.get("generation_kw", 0))
        export = float(item.get("export_kw", 0))
        consumption = float(item.get("consumption_kw", 0))
        irradiance = float(item.get("irradiance_wm2", 0))

        if month not in monthly:
            monthly[month] = {"gen": 0, "export": 0, "consumption": 0, "irradiance": 0, "count": 0}
        monthly[month]["gen"] += gen
        monthly[month]["export"] += export
        monthly[month]["consumption"] += consumption
        monthly[month]["irradiance"] += irradiance
        monthly[month]["count"] += 1

    sorted_months = sorted(monthly.keys())
    trend = []
    for m in sorted_months:
        d = monthly[m]
        c = d["count"] or 1
        trend.append({
            "month": m,
            "avg_generation_kw": round(d["gen"] / c, 2),
            "avg_export_kw": round(d["export"] / c, 2),
            "avg_consumption_kw": round(d["consumption"] / c, 2),
            "avg_irradiance_wm2": round(d["irradiance"] / c, 0),
            "net_export_ratio": round(d["export"] / d["gen"], 2) if d["gen"] > 0 else 0,
            "readings": c,
        })

    # Growth projection
    if len(trend) >= 2:
        first_gen = trend[0]["avg_generation_kw"]
        last_gen = trend[-1]["avg_generation_kw"]
        if first_gen > 0:
            growth_pct = round((last_gen - first_gen) / first_gen * 100, 1)
        else:
            growth_pct = 0

        forecast = []
        monthly_growth = (last_gen - first_gen) / len(trend) if len(trend) > 0 else 0
        for i in range(1, 7):
            forecast.append({
                "month_offset": i,
                "projected_generation_kw": round(last_gen + monthly_growth * i, 2),
            })
    else:
        growth_pct = 0
        forecast = []

    return {
        "historical_trend": trend[-12:],
        "generation_growth_percent": growth_pct,
        "forecast_next_6_months": forecast,
        "total_readings_analyzed": len(items),
    }


def handler(event, context):
    """Lambda handler for solar/DER forecasting."""
    try:
        body = event
        if isinstance(event.get("body"), str):
            body = json.loads(event["body"])
        elif "inputText" in event:
            body = {"query": event["inputText"]}

        action = body.get("action", "forecast")
        meter_id = body.get("meter_id")
        city = body.get("city")
        area_type = body.get("area_type")
        limit = int(body.get("limit", 500))

        if action == "forecast":
            items = query_solar_data(meter_id=meter_id, city=city, area_type=area_type, limit=limit)
            result = compute_solar_forecast(items)
            result["filters"] = {"meter_id": meter_id, "city": city, "area_type": area_type}
        elif action == "raw_data":
            items = query_solar_data(meter_id=meter_id, city=city, limit=limit)
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
