"""
Chat Orchestrator Lambda — uses Bedrock Claude to understand user queries
and routes them to the appropriate specialist Lambda function.
Acts as a multi-agent orchestrator for the DISCOM capacity planning system.
"""
import json
import os
import boto3

bedrock = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
lambda_client = boto3.client("lambda", region_name=os.environ.get("AWS_REGION", "ap-south-1"))

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "anthropic.claude-sonnet-4-20250514-v1:0")
DT_FUNCTION = os.environ.get("DT_FORECAST_FUNCTION", "guj-discom-dt-forecast")
EV_FUNCTION = os.environ.get("EV_FORECAST_FUNCTION", "guj-discom-ev-forecast")
SOLAR_FUNCTION = os.environ.get("SOLAR_FORECAST_FUNCTION", "guj-discom-solar-forecast")
CAPACITY_FUNCTION = os.environ.get("CAPACITY_PLAN_FUNCTION", "guj-discom-capacity-plan")

SYSTEM_PROMPT = """You are an AI assistant for Gujarat DISCOM capacity planning. You help utility engineers analyze grid data and plan capacity.

You have access to 4 specialist tools:
1. DT_FORECAST - Distribution Transformer load forecasting. Use for questions about transformer loads, feeder analysis, load growth trends, area-wise demand.
2. EV_FORECAST - EV charging demand growth analysis. Use for questions about EV adoption, charging patterns, charger utilization.
3. SOLAR_FORECAST - Solar/DER generation forecasting. Use for questions about solar generation, net metering, export patterns, irradiance.
4. CAPACITY_PLAN - Combined capacity planning. Use for holistic capacity assessment, scenario analysis, what-if planning across all data sources.

When the user asks a question:
1. Determine which tool(s) to use
2. Extract relevant parameters (city, area_type, dt_id, etc.)
3. Return a JSON response with: {"tool": "<tool_name>", "params": {<parameters>}}

Available cities: Ahmedabad, Surat, Vadodara, Rajkot, Gandhinagar, Bhavnagar, Jamnagar, Junagadh, Anand, Mehsana, Bharuch
Area types: Commercial, Residential, Industrial
Actions for DT: forecast, list_transformers, raw_data
Actions for EV: forecast, raw_data
Actions for Solar: forecast, raw_data
Actions for Capacity: plan, scenario, summary

For scenario analysis, extract growth percentages if mentioned (ev_growth_pct, solar_growth_pct, load_growth_pct).

IMPORTANT: Always respond with valid JSON only. No markdown, no explanation outside JSON."""

TOOLS = [
    {
        "name": "dt_forecast",
        "description": "Query DT transformer load data and forecasting. Use for transformer loads, feeder analysis, area-wise demand.",
        "input_schema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["forecast", "list_transformers", "raw_data"]},
                "dt_id": {"type": "string", "description": "Transformer ID like DT-AHM-0001"},
                "city": {"type": "string"},
                "area_type": {"type": "string", "enum": ["Commercial", "Residential", "Industrial"]},
                "limit": {"type": "integer", "default": 500}
            },
            "required": ["action"]
        }
    },
    {
        "name": "ev_forecast",
        "description": "Query EV charging data and demand growth projections. Use for EV adoption trends, charging patterns.",
        "input_schema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["forecast", "raw_data"]},
                "city": {"type": "string"},
                "connector_type": {"type": "string"},
                "location_type": {"type": "string", "enum": ["Highway", "Mall", "Office", "Residential", "Public"]},
                "limit": {"type": "integer", "default": 1000}
            },
            "required": ["action"]
        }
    },
    {
        "name": "solar_forecast",
        "description": "Query solar/DER generation data and forecasting. Use for solar generation trends, net metering impact.",
        "input_schema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["forecast", "raw_data"]},
                "meter_id": {"type": "string"},
                "city": {"type": "string"},
                "area_type": {"type": "string"},
                "limit": {"type": "integer", "default": 500}
            },
            "required": ["action"]
        }
    },
    {
        "name": "capacity_plan",
        "description": "Combined capacity planning across all data sources. Use for holistic assessment, scenario analysis, what-if planning.",
        "input_schema": {
            "type": "object",
            "properties": {
                "action": {"type": "string", "enum": ["plan", "scenario", "summary"]},
                "city": {"type": "string"},
                "ev_growth_pct": {"type": "integer", "default": 50},
                "solar_growth_pct": {"type": "integer", "default": 25},
                "load_growth_pct": {"type": "integer", "default": 8}
            },
            "required": ["action"]
        }
    }
]

FUNCTION_MAP = {
    "dt_forecast": DT_FUNCTION,
    "ev_forecast": EV_FUNCTION,
    "solar_forecast": SOLAR_FUNCTION,
    "capacity_plan": CAPACITY_FUNCTION,
}


def invoke_tool(tool_name, params):
    """Invoke the specialist Lambda function."""
    function_name = FUNCTION_MAP.get(tool_name)
    if not function_name:
        return {"error": f"Unknown tool: {tool_name}"}

    response = lambda_client.invoke(
        FunctionName=function_name,
        InvocationType="RequestResponse",
        Payload=json.dumps(params),
    )
    payload = json.loads(response["Payload"].read())
    if "body" in payload:
        return json.loads(payload["body"])
    return payload


def chat_with_bedrock(user_message, conversation_history=None):
    """Send message to Bedrock Claude with tool use, execute tools, return final answer."""
    messages = conversation_history or []
    messages.append({"role": "user", "content": user_message})

    # First call — let Claude decide which tool to use
    response = bedrock.invoke_model(
        modelId=MODEL_ID,
        contentType="application/json",
        accept="application/json",
        body=json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096,
            "system": SYSTEM_PROMPT,
            "messages": messages,
            "tools": TOOLS,
        }),
    )

    result = json.loads(response["body"].read())
    stop_reason = result.get("stop_reason")
    content_blocks = result.get("content", [])

    # If Claude wants to use a tool
    if stop_reason == "tool_use":
        tool_results = []
        assistant_content = content_blocks

        for block in content_blocks:
            if block.get("type") == "tool_use":
                tool_name = block["name"]
                tool_input = block["input"]
                tool_id = block["id"]

                # Invoke the specialist Lambda
                tool_output = invoke_tool(tool_name, tool_input)

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_id,
                    "content": json.dumps(tool_output, default=str),
                })

        # Send tool results back to Claude for final answer
        messages.append({"role": "assistant", "content": assistant_content})
        messages.append({"role": "user", "content": tool_results})

        final_response = bedrock.invoke_model(
            modelId=MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 4096,
                "system": SYSTEM_PROMPT,
                "messages": messages,
                "tools": TOOLS,
            }),
        )

        final_result = json.loads(final_response["body"].read())
        final_text = ""
        tool_data = tool_output  # last tool output for charts
        for block in final_result.get("content", []):
            if block.get("type") == "text":
                final_text += block["text"]

        return {"answer": final_text, "tool_used": tool_name, "tool_data": tool_data}

    # No tool use — direct text response
    text = ""
    for block in content_blocks:
        if block.get("type") == "text":
            text += block["text"]

    return {"answer": text, "tool_used": None, "tool_data": None}


def handler(event, context):
    """Lambda handler for chat orchestrator."""
    try:
        body = event
        if isinstance(event.get("body"), str):
            body = json.loads(event["body"])

        user_message = body.get("message", body.get("query", ""))
        if not user_message:
            return {
                "statusCode": 400,
                "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "No message provided"}),
            }

        result = chat_with_bedrock(user_message)

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps(result, default=str),
        }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)}),
        }
