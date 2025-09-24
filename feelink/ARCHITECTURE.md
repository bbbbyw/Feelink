## Feelink Architecture

This document outlines the architecture for the Feelink project: frontend delivery, backend services, data, observability, and deployment.

### High-Level Overview

- **Frontend (Next.js 14 + Tailwind)**: Built from `feelink/frontend`. Static assets are hosted in an S3 bucket and served via CloudFront with Origin Access Control (OAC).
- **Backend (AWS SAM / Lambda + HTTP API)**: One Lambda function (`ChatFunction`) behind an API Gateway HTTP API provides `POST /chat` for emotion analysis and activity suggestions.
- **Data (DynamoDB)**: Stores chat sessions (`FeelinkTable`) and monthly usage counters (`FeelinkUsage`). Optionally reads activities from `ActivitiesEncourageFeelink`.
- **Secrets (SSM Parameter Store + KMS)**: Hugging Face API key stored as SecureString; Lambda reads via `ssm.getParameter` with decryption.
- **Observability (CloudWatch)**: Custom metric `Feelink/HF.HFMonthlyCount` with an alarm and SNS email; Lambda logs.
- **Deployment (SAM/CloudFormation)**: Infrastructure defined in `backend/template.yaml`, deployed as stack `feelink-stack`. Frontend deployed to S3; CloudFront invalidations on updates.

### Component Diagram

```mermaid
flowchart TB
  subgraph Client
    B[Browser]
  end

  subgraph CDN[CloudFront Distribution]
    CF[CloudFront]
  end

  subgraph S3Bucket[S3 Static Site]
    S3[(S3: feelinkfrontendbucketbyw)]
  end

  B <-- static assets --> CF
  CF -- OAC read --> S3

  B -- POST /chat --> APIGW[API Gateway (HTTP API)]
  APIGW --> LAMBDA[Lambda: ChatFunction]

  subgraph Data[DynamoDB]
    D1[(FeelinkTable: Sessions)]
    D2[(FeelinkUsage: Monthly Counters)]
    D3[(ActivitiesEncourageFeelink)]
  end

  LAMBDA --> D1
  LAMBDA --> D2
  LAMBDA -. optional read .-> D3

  subgraph Secrets[SSM Parameter Store + KMS]
    SSM[(HF API Key SecureString)]
  end

  LAMBDA -- getParameter(Decrypt) --> SSM

  subgraph Observability[CloudWatch]
    CWLogs[(Logs)]
    CWMetrics[(Metric: Feelink/HF.HFMonthlyCount)]
    CWAlarm[Alarm: HFMonthlyCountAlarm]
  end

  LAMBDA --> CWMetrics
  LAMBDA --> CWLogs

  subgraph Alerts[SNS]
    SNSTopic[(HFAlertTopic)]
    Email[(Email Subscription)]
  end

  CWAlarm --> SNSTopic --> Email
```

### Request Flow (Sequence)

```mermaid
sequenceDiagram
  autonumber
  participant U as User Browser
  participant CF as CloudFront
  participant S3 as S3 (Static Assets)
  participant API as API Gateway (HTTP API)
  participant L as Lambda (ChatFunction)
  participant D1 as DynamoDB (FeelinkTable)
  participant D2 as DynamoDB (FeelinkUsage)
  participant SSM as SSM Parameter Store
  participant CW as CloudWatch (Metrics/Logs)
  participant SNS as SNS Topic

  U->>CF: GET index.html, JS, CSS
  CF->>S3: OAC GetObject
  S3-->>CF: Assets
  CF-->>U: Delivered assets

  U->>API: POST /chat { text }
  API->>L: Invoke with event
  par Resolve secret
    L->>SSM: getParameter(HF key, WithDecryption)
    SSM-->>L: SecureString value
  end
  L->>L: Analyze emotion (HF + sentiment + keywords)
  L->>D2: Update monthly counter (ADD count)
  L->>CW: PutMetricData HFMonthlyCount
  L->>D1: PutItem session record
  L-->>API: 200 { emotion, activity, encouragement }
  API-->>U: JSON response

  note over CW,SNS: Alarm on metric triggers SNS email when threshold reached
```

### AWS Services Used

- API Gateway (HTTP API)
- AWS Lambda
- Amazon DynamoDB
- AWS Systems Manager Parameter Store (+ KMS decrypt)
- Amazon CloudWatch (Logs, Metrics, Alarms)
- Amazon Simple Notification Service (SNS)
- Amazon S3 (static hosting + SAM packaging)
- Amazon CloudFront (with OAC)
- AWS CloudFormation (via AWS SAM)
- AWS IAM

