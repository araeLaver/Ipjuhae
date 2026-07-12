# Trust Platform Operations

## Required production configuration

- `DATABASE_URL`: PostgreSQL connection string.
- `DB_SCHEMA`: defaults to `ipjuhae`.
- `JWT_SECRET`: authentication signing secret.
- `DISCLOSURE_SIGNING_KEY`: minimum-disclosure package integrity key.
- `CRON_SECRET`: authorization secret for maintenance and outbox jobs.
- `STORAGE_PROVIDER=s3` and the `S3_*` variables: verification document storage.

## Scheduled jobs

- `/api/cron/trust-outbox`: every five minutes; delivers trust events to in-app notifications.
- `/api/cron/trust-maintenance`: daily at 03:00 KST; expires evidence and disclosures, releases due bilateral references and queues retention actions.
- `/api/cron/references`: daily at 03:15 KST; processes legacy reference expiry.

## External verification

Official OCR, registry, building, guarantee-insurance and identity providers must be registered through `/api/v1/admin/trust-sources` after legal and contract review. The platform records consent-bound requests through `/api/v1/external-requests`; provider credentials must never be stored in the registry metadata.

## Release checks

```powershell
node --env-file=.env.local node_modules/tsx/dist/cli.mjs db/migrate.ts
node --env-file=.env.local node_modules/tsx/dist/cli.mjs db/backfill-trust-ledger.ts
node --env-file=.env.local scripts/trust-platform-smoke.mjs
npm run test:run
npm run build
```

