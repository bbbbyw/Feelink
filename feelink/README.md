# Feelink

A serverless emotion analysis app with a Next.js frontend and an AWS SAM backend.

- Architecture: see `ARCHITECTURE.md` for diagrams, AWS services, data flow, and deployment.
- Frontend: Next.js app under `frontend/` (built and hosted on S3 + CloudFront).
- Backend: SAM stack under `backend/` (API Gateway + Lambda + DynamoDB + SSM/KMS + CloudWatch + SNS).

## Diagrams

Mermaid sources live under `feelink/docs/`.

Generate PNGs:

```bash
npx @mermaid-js/mermaid-cli -i feelink/docs/component.mmd -o feelink/docs/component.png
npx @mermaid-js/mermaid-cli -i feelink/docs/sequence.mmd -o feelink/docs/sequence.png
```

## Development

- Frontend: `cd feelink/frontend && npm install && npm run dev`
- Backend: `cd feelink/backend && sam build && sam deploy --guided`
