# ⚡ AI-Driven Capacity Planning Platform

A complete end-to-end AI-powered capacity planning solution for power distribution companies (DISCOMs), built on AWS. The platform analyzes Distribution Transformer (DT) meter data, EV charging patterns, solar/DER generation, and battery energy storage to provide demand forecasting, growth projections, and scenario-based capacity planning.

**Pipeline: S3 → DynamoDB → Lambda → Bedrock (Claude) → API Gateway → CloudFront**

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Features](#-features)
- [Data Sources](#-data-sources)
- [Prerequisites](#-prerequisites)
- [Project Structure](#-project-structure)
- [Deployment Guide](#-deployment-guide)
- [API Reference](#-api-reference)
- [Frontend](#-frontend)
- [Cost Estimation](#-cost-estimation)
- [Cleanup](#-cleanup)
- [Customization](#-customization)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Overview

This platform helps Gujarat DISCOMs improve capacity planning by:

- **DT Load Forecasting** — Analyzing historical consumption from Distribution Transformer meters to predict load growth by city, area type (Commercial/Residential/Industrial), and feeder
- **EV Charging Demand Growth** — Tracking EV adoption trends from OCPP-based charging management systems to project future charging infrastructure needs
- **Solar/DER Generation Forecasting** — Monitoring solar generation, net metering, and export patterns to plan renewable integration
- **Combined Capacity Planning** — Holistic assessment across all data sources with what-if scenario analysis for different growth trajectories
- **AI Chat Assistant** — Natural language interface powered by Amazon Bedrock (Claude) that routes queries to specialist agents

### Use Case

Gujarat DISCOMs need to plan grid capacity considering four growth vectors simultaneously:
1. Consumer power load growth (varying by commercial vs residential areas)
2. EV charging infrastructure expansion (50%+ YoY growth)
3. Distributed solar generation (net metering, reverse power flow)
4. Battery energy storage (peak shaving, load balancing)

This platform provides data-driven insights to transform capacity planning from months to weeks.

---

## 🏗️  AWS Architecture

<img width="1557" height="703" alt="image" src="https://github.com/user-attachments/assets/95ac6199-3317-4eb9-bc30-07da885ea800" />


```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                       │
│  S3 (Private) → CloudFront (OAC) → HTTPS Dashboard + AI Chat Bot   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ API Calls
┌──────────────────────────────▼──────────────────────────────────────┐
│                      Amazon API Gateway (REST)                       │
│  /dt-forecast  /ev-forecast  /solar-forecast  /capacity-plan  /chat │
└──────┬────────────┬────────────┬────────────┬────────────┬─────────┘
       │            │            │            │            │
┌──────▼───┐ ┌──────▼───┐ ┌─────▼────┐ ┌─────▼────┐ ┌────▼──────────┐
│ DT Lambda│ │EV Lambda │ │Solar     │ │Capacity  │ │Chat           │
│ Forecast │ │Forecast  │ │Lambda    │ │Planning  │ │Orchestrator   │
│          │ │          │ │Forecast  │ │Lambda    │ │Lambda         │
└──────┬───┘ └──────┬───┘ └─────┬────┘ └─────┬────┘ └────┬──────────┘
       │            │           │             │           │
       │            │           │             │     ┌─────▼──────────┐
       │            │           │             │     │ Amazon Bedrock │
       │            │           │             │     │ Claude Sonnet 4│
       │            │           │             │     │ (Tool Use)     │
       │            │           │             │     └────────────────┘
┌──────▼────────────▼───────────▼─────────────▼──────────────────────┐
│                        Amazon DynamoDB                               │
│  guj-discom-dt-meter    │ guj-discom-ev-charging                    │
│  guj-discom-solar-der   │ guj-discom-energy-storage                 │
└─────────────────────────────────────────────────────────────────────┘
       ▲
       │ Batch Load
┌──────┴─────────────────────────────────────────────────────────────┐
│                         Amazon S3 (Data Lake)                       │
│  guj-discom-poc-datalake/raw/dt-meter/                              │
│  guj-discom-poc-datalake/raw/ev-charging/                           │
│  guj-discom-poc-datalake/raw/solar-der/                             │
│  guj-discom-poc-datalake/raw/energy-storage/                        │
└─────────────────────────────────────────────────────────────────────┘
```

### AWS Services Used

| Service | Purpose |
|---------|---------|
| **Amazon S3** | Raw data lake + frontend static hosting (private bucket) |
| **Amazon DynamoDB** | Operational data store for all 4 datasets (PAY_PER_REQUEST) |
| **AWS Lambda** | 5 Python functions for forecasting, planning, and chat orchestration |
| **Amazon API Gateway** | REST API with CORS support |
| **Amazon Bedrock** | Claude Sonnet 4 for multi-agent AI chat with tool use |
| **Amazon CloudFront** | CDN with Origin Access Control (OAC) for secure frontend delivery |
| **AWS CloudFormation** | Infrastructure as Code for backend deployment |
| **AWS IAM** | Least-privilege roles for Lambda execution |

---

## ✨ Features

### Dashboard
- Real-time KPI cards showing data volume across all 4 growth vectors
- Interactive charts: DT load trends, EV session growth, solar generation vs export, energy mix breakdown
- Grid readiness radar comparing current vs projected state
- City and area-type filtering

### Forecasting Modules
- **DT Load Forecast** — Monthly avg/peak load trends with 6-month projections, filterable by city, area type, and specific transformer ID
- **EV Demand Growth** — Session count and energy delivery trends with adoption growth projections, filterable by city, connector type, and location type
- **Solar/DER Forecast** — Generation, export, consumption, and irradiance trends with growth projections
- **Capacity Planning** — Combined assessment with scenario analysis (adjustable EV/solar/load growth percentages)

### AI Chat Assistant
- Natural language queries routed to specialist agents via Amazon Bedrock Claude
- Tool-use integration — Claude decides which Lambda to invoke based on the question
- Markdown-formatted responses with clickable links
- Suggestion chips for common queries
- Shows which agent was used for each response

---

## 📊 Data Sources

### 1. DT Meter Data (175,200 records)
Distribution Transformer meter readings at 2-hour intervals across 2 years.

| Field | Type | Description |
|-------|------|-------------|
| `dt_id` | String | Transformer ID (e.g., DT-AHM-0042) |
| `timestamp` | String | ISO 8601 timestamp |
| `city` | String | Gujarat city (11 cities) |
| `area_type` | String | Commercial / Residential / Industrial |
| `feeder` | String | Feeder name (F1-F8) |
| `capacity_kva` | Number | Transformer capacity (100-2000 kVA) |
| `load_kw` | Number | Active power load |
| `load_kva` | Number | Apparent power load |
| `consumption_kwh` | Number | Energy consumption |
| `power_factor` | Number | Power factor (0.80-0.98) |
| `voltage_v` | Number | Voltage (~415V) |
| `current_a` | Number | Current in amps |
| `frequency_hz` | Number | Grid frequency (~50Hz) |
| `thd_percent` | Number | Total harmonic distortion |

### 2. EV Charging Data (17,647 records)
OCPP-style charging session data with 50% YoY adoption growth.

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | String | Unique session identifier |
| `charger_id` | String | Charger ID (e.g., EVC-SUR-0005) |
| `city` | String | Gujarat city |
| `connector_type` | String | CCS2 / CHAdeMO / Type2_AC / Bharat_DC |
| `max_power_kw` | Number | Charger max power (3.3-150 kW) |
| `location_type` | String | Highway / Mall / Office / Residential / Public |
| `start_time` | String | Session start timestamp |
| `end_time` | String | Session end timestamp |
| `energy_delivered_kwh` | Number | Energy delivered |
| `peak_power_kw` | Number | Peak power during session |
| `soc_start` / `soc_end` | Number | Battery state of charge |

### 3. Solar/DER Data (131,400 records)
Solar generation and net metering data at 2-hour intervals.

| Field | Type | Description |
|-------|------|-------------|
| `meter_id` | String | Solar meter ID (e.g., SOL-AHM-0012) |
| `timestamp` | String | ISO 8601 timestamp |
| `city` | String | Gujarat city |
| `installed_capacity_kw` | Number | Panel capacity (3-200 kW) |
| `generation_kw` | Number | Solar generation |
| `export_kw` | Number | Power exported to grid |
| `consumption_kw` | Number | Local consumption |
| `net_flow_kw` | Number | Net flow (negative = exporting) |
| `irradiance_wm2` | Number | Solar irradiance (W/m²) |

### 4. Energy Storage Data (87,600 records)
Battery Energy Storage System (BESS) data at 2-hour intervals.

| Field | Type | Description |
|-------|------|-------------|
| `unit_id` | String | BESS unit ID (e.g., BESS-AHM-0003) |
| `timestamp` | String | ISO 8601 timestamp |
| `city` | String | Gujarat city |
| `capacity_kwh` | Number | Battery capacity (50-2000 kWh) |
| `chemistry` | String | LFP / NMC / LTO |
| `soc_percent` | Number | State of charge |
| `charge_kw` / `discharge_kw` | Number | Charge/discharge power |
| `mode` | String | charging / discharging / idle |
| `temperature_c` | Number | Battery temperature |
| `efficiency_percent` | Number | Round-trip efficiency |

### Cities Covered
Ahmedabad, Surat, Vadodara, Rajkot, Gandhinagar, Bhavnagar, Jamnagar, Junagadh, Anand, Mehsana, Bharuch

---

## ✅ Prerequisites

### AWS Account Requirements
- AWS account with access to `ap-south-1` (Mumbai) region
- IAM user/role with permissions for: S3, DynamoDB, Lambda, API Gateway, CloudFormation, CloudFront, Bedrock
- Amazon Bedrock model access enabled for **Claude Sonnet 4** in ap-south-1

### Software Requirements
- Python 3.9+ with `boto3` installed (`pip install boto3`)
- Node.js 18+ and npm
- AWS CLI v2 configured (`aws configure`)

### Enable Bedrock Model Access
1. Go to [Amazon Bedrock Console](https://ap-south-1.console.aws.amazon.com/bedrock/home?region=ap-south-1)
2. Navigate to **Model access** → **Manage model access**
3. Enable **Anthropic Claude Sonnet 4**
4. Wait for access to be granted

---

## 📁 Project Structure

```
discom/
├── README.md                              # This file
├── data/
│   ├── generate_data_large.py             # Synthetic data generator (large scale)
│   ├── generate_data.py                   # Synthetic data generator (small scale)
│   ├── load_to_dynamodb.py                # DynamoDB batch loader
│   ├── dt_meter_data_large.csv            # Generated DT meter data (181MB)
│   ├── ev_charging_data_large.csv         # Generated EV charging data (2.2MB)
│   ├── solar_der_data_large.csv           # Generated solar data (117MB)
│   └── energy_storage_data_large.csv      # Generated storage data (38MB)
├── backend/
│   ├── template.yaml                      # SAM template (alternative)
│   ├── deploy/
│   │   ├── cfn-template.yaml              # CloudFormation template
│   │   ├── create_cf_oac.py               # CloudFront OAC setup script
│   │   └── lambdas/                       # Zipped Lambda packages
│   └── lambda/
│       ├── dt_forecast/handler.py         # DT load forecasting
│       ├── ev_forecast/handler.py         # EV demand growth
│       ├── solar_forecast/handler.py      # Solar/DER forecasting
│       ├── capacity_planning/handler.py   # Combined capacity planning
│       └── chat_orchestrator/handler.py   # Bedrock multi-agent chat
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx                        # Main app with routing
        ├── App.css                        # Global styles
        ├── config.js                      # API base URL config
        ├── components/
        │   ├── Sidebar.jsx                # Navigation sidebar
        │   └── ChatBot.jsx                # AI chat assistant
        └── pages/
            ├── Dashboard.jsx              # Main dashboard
            ├── DtForecast.jsx             # DT load forecasting page
            ├── EvForecast.jsx             # EV demand growth page
            ├── SolarForecast.jsx          # Solar/DER forecasting page
            └── CapacityPlan.jsx           # Capacity planning + scenarios
```

---

## 🚀 Deployment Guide

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/guj-discom-poc.git
cd guj-discom-poc
```

### Step 2: Generate Synthetic Data

```bash
cd data
python3 generate_data_large.py
```

This creates 4 CSV files (~338MB total) with 2 years of synthetic data for 200 transformers, 100 EV chargers, 150 solar meters, and 50 BESS units across 11 Gujarat cities.

### Step 3: Create S3 Data Lake and Upload

```bash
# Create the S3 bucket
aws s3api create-bucket \
  --bucket guj-discom-poc-datalake \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1

# Upload datasets
aws s3 cp dt_meter_data_large.csv s3://guj-discom-poc-datalake/raw/dt-meter/ --region ap-south-1
aws s3 cp ev_charging_data_large.csv s3://guj-discom-poc-datalake/raw/ev-charging/ --region ap-south-1
aws s3 cp solar_der_data_large.csv s3://guj-discom-poc-datalake/raw/solar-der/ --region ap-south-1
aws s3 cp energy_storage_data_large.csv s3://guj-discom-poc-datalake/raw/energy-storage/ --region ap-south-1
```

### Step 4: Create DynamoDB Tables

```bash
# Create all 4 tables (PAY_PER_REQUEST billing)
aws dynamodb create-table --table-name guj-discom-dt-meter \
  --attribute-definitions AttributeName=dt_id,AttributeType=S AttributeName=timestamp,AttributeType=S \
  --key-schema AttributeName=dt_id,KeyType=HASH AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST --region ap-south-1

aws dynamodb create-table --table-name guj-discom-ev-charging \
  --attribute-definitions AttributeName=session_id,AttributeType=S AttributeName=start_time,AttributeType=S \
  --key-schema AttributeName=session_id,KeyType=HASH AttributeName=start_time,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST --region ap-south-1

aws dynamodb create-table --table-name guj-discom-solar-der \
  --attribute-definitions AttributeName=meter_id,AttributeType=S AttributeName=timestamp,AttributeType=S \
  --key-schema AttributeName=meter_id,KeyType=HASH AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST --region ap-south-1

aws dynamodb create-table --table-name guj-discom-energy-storage \
  --attribute-definitions AttributeName=unit_id,AttributeType=S AttributeName=timestamp,AttributeType=S \
  --key-schema AttributeName=unit_id,KeyType=HASH AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST --region ap-south-1
```

### Step 5: Load Data into DynamoDB

```bash
# Install boto3 if not already installed
pip3 install boto3

# Run the batch loader (takes ~10-15 minutes for ~411K items)
python3 load_to_dynamodb.py
```

The loader samples the data (every 10th row for DT/Solar, every 5th for Storage, all EV sessions) to keep DynamoDB costs reasonable while maintaining enough data for meaningful analysis.

### Step 6: Deploy Backend (CloudFormation)

```bash
cd ../backend

# Package Lambda functions
zip -j deploy/lambdas/dt_forecast.zip lambda/dt_forecast/handler.py
zip -j deploy/lambdas/ev_forecast.zip lambda/ev_forecast/handler.py
zip -j deploy/lambdas/solar_forecast.zip lambda/solar_forecast/handler.py
zip -j deploy/lambdas/capacity_planning.zip lambda/capacity_planning/handler.py
zip -j deploy/lambdas/chat_orchestrator.zip lambda/chat_orchestrator/handler.py

# Upload to S3
aws s3 sync deploy/lambdas/ s3://guj-discom-poc-datalake/deploy/lambdas/ --region ap-south-1

# Deploy CloudFormation stack
aws cloudformation create-stack \
  --stack-name guj-discom-poc \
  --template-body file://deploy/cfn-template.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-south-1

# Wait for deployment (~3-5 minutes)
aws cloudformation wait stack-create-complete --stack-name guj-discom-poc --region ap-south-1

# Get the API Gateway URL
aws cloudformation describe-stacks --stack-name guj-discom-poc --region ap-south-1 \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text
```

**Important:** After deployment, find the Bedrock inference profile ID and update the chat orchestrator Lambda:

```bash
# Get the APAC inference profile for Claude Sonnet 4
aws bedrock list-inference-profiles --region ap-south-1 \
  --query "inferenceProfileSummaries[?contains(inferenceProfileId, 'claude-sonnet-4')].inferenceProfileId" \
  --output text

# Update the Lambda environment variable (replace PROFILE_ID)
aws lambda update-function-configuration \
  --function-name guj-discom-chat-orchestrator \
  --environment "Variables={DT_TABLE=guj-discom-dt-meter,EV_TABLE=guj-discom-ev-charging,SOLAR_TABLE=guj-discom-solar-der,STORAGE_TABLE=guj-discom-energy-storage,DT_FORECAST_FUNCTION=guj-discom-dt-forecast,EV_FORECAST_FUNCTION=guj-discom-ev-forecast,SOLAR_FORECAST_FUNCTION=guj-discom-solar-forecast,CAPACITY_PLAN_FUNCTION=guj-discom-capacity-plan,BEDROCK_MODEL_ID=PROFILE_ID}" \
  --region ap-south-1
```

### Step 7: Deploy Frontend

```bash
cd ../frontend

# Install dependencies
npm install

# Update API base URL in src/config.js with your API Gateway URL
# export const API_BASE = "https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/prod";

# Build
npm run build

# Create frontend S3 bucket
aws s3api create-bucket \
  --bucket guj-discom-poc-frontend \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1

# Enable static website hosting
aws s3 website s3://guj-discom-poc-frontend --index-document index.html --error-document index.html

# Upload built assets
aws s3 sync dist/ s3://guj-discom-poc-frontend/ --region ap-south-1
```

### Step 8: Set Up CloudFront with OAC (Private Bucket)

```bash
cd ../backend

# Run the CloudFront OAC setup script
python3 deploy/create_cf_oac.py
```

This script:
1. Creates a CloudFront Origin Access Control (OAC)
2. Creates a CloudFront distribution pointing to the private S3 bucket
3. Sets a bucket policy allowing only CloudFront to read objects
4. The S3 bucket remains fully private — no public access

**Your frontend URL:** `https://DISTRIBUTION_DOMAIN.cloudfront.net` (takes ~5 minutes to deploy)

### Step 9: Verify Everything Works

```bash
# Test DT forecast API
curl -s -X POST https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/prod/dt-forecast \
  -H "Content-Type: application/json" \
  -d '{"action":"forecast","limit":500}' | python3 -m json.tool

# Test chat API
curl -s -X POST https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/prod/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the load forecast for Ahmedabad?"}' | python3 -m json.tool

# Open the frontend
open https://YOUR_CLOUDFRONT_DOMAIN.cloudfront.net
```

---

## 📡 API Reference

Base URL: `https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/prod`

### POST /dt-forecast
DT load forecasting and transformer data queries.

```json
{
  "action": "forecast",       // forecast | list_transformers | raw_data
  "dt_id": "DT-AHM-0042",    // optional: specific transformer
  "city": "Ahmedabad",        // optional: filter by city
  "area_type": "Commercial",  // optional: Commercial | Residential | Industrial
  "limit": 500                // optional: max items to analyze
}
```

### POST /ev-forecast
EV charging demand growth analysis.

```json
{
  "action": "forecast",        // forecast | raw_data
  "city": "Surat",             // optional
  "connector_type": "CCS2",    // optional: CCS2 | CHAdeMO | Type2_AC | Bharat_DC
  "location_type": "Highway",  // optional: Highway | Mall | Office | Residential | Public
  "limit": 1000
}
```

### POST /solar-forecast
Solar/DER generation forecasting.

```json
{
  "action": "forecast",        // forecast | raw_data
  "meter_id": "SOL-SUR-0001", // optional: specific meter
  "city": "Surat",             // optional
  "area_type": "Commercial",   // optional
  "limit": 500
}
```

### POST /capacity-plan
Combined capacity planning and scenario analysis.

```json
{
  "action": "plan",            // plan | scenario | summary
  "city": "Ahmedabad",        // optional
  "area_type": "Commercial",  // optional
  "ev_growth_pct": 50,        // scenario only: EV growth %
  "solar_growth_pct": 25,     // scenario only: solar growth %
  "load_growth_pct": 8        // scenario only: load growth %
}
```

### POST /chat
AI chat assistant (Bedrock Claude multi-agent orchestrator).

```json
{
  "message": "What is the projected EV charging demand for Surat next year?"
}
```

Response includes `answer` (markdown text), `tool_used` (which agent was invoked), and `tool_data` (raw data from the agent).

---

## 🖥️ Frontend

The frontend is a React + Vite single-page application with:

- **Dashboard** — Overview with 8 KPI cards, 6 interactive charts (Line, Bar, Doughnut, Radar)
- **DT Load Forecast** — Filter by city/area, view trends and 6-month projections
- **EV Demand Growth** — Session and energy trends with growth projections
- **Solar/DER Forecast** — Generation, export, irradiance trends
- **Capacity Planning** — Combined assessment with adjustable scenario parameters
- **AI Chat Bot** — Floating chat widget with markdown rendering, suggestion chips

### Local Development

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:5173
```

Set the API URL in `src/config.js` or via environment variable:
```bash
VITE_API_BASE=https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/prod npm run dev
```

---

## 💰 Cost Estimation

Monthly cost breakdown (ap-south-1 region, POC usage):

| Service | Configuration | Estimated Monthly Cost |
|---------|--------------|----------------------|
| Amazon DynamoDB | PAY_PER_REQUEST, ~411K items, ~50 GB | ~$12.50 |
| AWS Lambda | 5 functions, ~1000 invocations/month | ~$0.50 |
| Amazon API Gateway | ~1000 requests/month | ~$0.01 |
| Amazon Bedrock | Claude Sonnet 4, ~500 chat queries | ~$15-30 |
| Amazon S3 | ~500MB storage (data + frontend) | ~$0.01 |
| Amazon CloudFront | ~10GB transfer | ~$1.00 |
| **Total** | | **~$30-45/month** |

### Cost Optimization Tips
- DynamoDB PAY_PER_REQUEST is ideal for POC; switch to provisioned for production
- Bedrock costs scale with chat usage — prompt caching can reduce by 90%
- CloudFront caching reduces S3 and API calls
- Delete the stack when not demoing to avoid ongoing charges

---

## 🧹 Cleanup

To avoid ongoing charges, delete all resources in this order:

```bash
# 1. Empty and delete frontend bucket
aws s3 rm s3://guj-discom-poc-frontend --recursive --region ap-south-1
aws s3api delete-bucket --bucket guj-discom-poc-frontend --region ap-south-1

# 2. Delete CloudFront distribution
# First disable it, wait for deployment, then delete
aws cloudfront get-distribution-config --id YOUR_CF_ID --query "ETag" --output text
# Use the ETag to disable, then delete

# 3. Delete CloudFormation stack (removes Lambdas, API GW, IAM roles)
aws cloudformation delete-stack --stack-name guj-discom-poc --region ap-south-1
aws cloudformation wait stack-delete-complete --stack-name guj-discom-poc --region ap-south-1

# 4. Delete DynamoDB tables
aws dynamodb delete-table --table-name guj-discom-dt-meter --region ap-south-1
aws dynamodb delete-table --table-name guj-discom-ev-charging --region ap-south-1
aws dynamodb delete-table --table-name guj-discom-solar-der --region ap-south-1
aws dynamodb delete-table --table-name guj-discom-energy-storage --region ap-south-1

# 5. Empty and delete data lake bucket
aws s3 rm s3://guj-discom-poc-datalake --recursive --region ap-south-1
aws s3api delete-bucket --bucket guj-discom-poc-datalake --region ap-south-1
```

---

## 🔧 Customization

### Using Real DISCOM Data
Replace the synthetic data generator with your actual data sources:

1. **DT Meter Data** — Export from your MDMS/AMI system in the same CSV schema
2. **EV Charging Data** — Export from your OCPP-based charging management system
3. **Solar/DER Data** — Export from net metering systems
4. **Energy Storage Data** — Export from BESS management systems

Update `load_to_dynamodb.py` transform functions to match your column names.

### Adding More Cities / States
Edit `generate_data_large.py` and add entries to the `LOCATIONS` list. The system scales horizontally — DynamoDB and Lambda handle any number of cities.

### Changing the AI Model
Update the `BEDROCK_MODEL_ID` environment variable on the chat orchestrator Lambda to use a different Claude model or any Bedrock-supported model.

### Adding Authentication
Add Amazon Cognito by:
1. Creating a Cognito User Pool
2. Adding a Cognito authorizer to API Gateway
3. Adding login UI to the frontend

---

## 🔍 Troubleshooting

### Chat returns "InvokeModel ValidationException"
The Bedrock model ID needs to be an inference profile ID, not a raw model ID. Run:
```bash
aws bedrock list-inference-profiles --region ap-south-1 \
  --query "inferenceProfileSummaries[?contains(inferenceProfileId, 'claude-sonnet')].inferenceProfileId"
```

### City filter returns no data
DynamoDB scans are partition-based. The Lambda functions paginate through partitions to find filtered data. If a specific city still returns empty, increase `max_pages` in the Lambda handler.

### CloudFront returns 403
Ensure the S3 bucket policy allows the CloudFront distribution's service principal. Check:
```bash
aws s3api get-bucket-policy --bucket guj-discom-poc-frontend --region ap-south-1
```

### Lambda timeout
Increase the Lambda timeout in the CloudFormation template or via CLI:
```bash
aws lambda update-function-configuration --function-name FUNCTION_NAME --timeout 120 --region ap-south-1
```

---

## 📚 Additional Resources

- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [CloudFront Origin Access Control](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)
- [OCPP Protocol Specification](https://www.openchargealliance.org/protocols/ocpp-201/)
- [Gujarat Energy Regulatory Commission (GERC)](https://www.gercin.org/)

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-analysis`)
3. Commit your changes (`git commit -m 'Add new analysis module'`)
4. Push to the branch (`git push origin feature/new-analysis`)
5. Open a Pull Request

---

**Questions or Issues?** Please open an issue on GitHub.
