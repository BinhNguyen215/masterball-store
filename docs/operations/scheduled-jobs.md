# Scheduled jobs

Three idempotent maintenance jobs keep reservations, publishing, and
transactional email truthful. Each is a `POST` route guarded by a Bearer token
and can be run again safely after a failure.

## Endpoints

| Job | Endpoint | What it does | Typical cadence |
| --- | --- | --- | --- |
| Release expired reservations | `POST /api/jobs/release-expired` | Cancels `PENDING_PAYMENT` orders past `reservationExpiresAt`, releases reserved stock, marks the payment failed, writes order history. | every 5 minutes |
| Publish scheduled tournaments | `POST /api/jobs/publish-scheduled` | Flips `SCHEDULED` announcements whose `scheduledPublishAt` is due to `PUBLISHED`. | every 5 minutes |
| Process email outbox | `POST /api/jobs/process-email-outbox` | Sends queued transactional email over SMTP. | every 1 minute |

Authorization: `Authorization: Bearer $CRON_SECRET`. The secret must be at least
32 characters; a missing or short secret returns `503 JOB_CONFIGURATION_UNAVAILABLE`
and a wrong secret returns `401 UNAUTHORIZED`. Nothing else (session, capability)
is accepted for these routes.

## Scheduling options

Pick one and record the choice in the launch checklist.

**VPS or a long-running host** — a crontab entry per job:

```cron
*/5 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://store.example.com/api/jobs/release-expired > /dev/null
*/5 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://store.example.com/api/jobs/publish-scheduled > /dev/null
*/1 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://store.example.com/api/jobs/process-email-outbox > /dev/null
```

**GitHub Actions** — `.github/workflows/cron.yml` with a `schedule:` trigger and
`CRON_SECRET` stored as a repository secret:

```yaml
on:
  schedule:
    - cron: "*/5 * * * *"
jobs:
  jobs:
    runs-on: ubuntu-latest
    steps:
      - run: |
          for path in release-expired publish-scheduled process-email-outbox; do
            curl -fsS -X POST -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" "https://store.example.com/api/jobs/$path"
          done
```

**Vercel Cron** — `vercel.json` `crons` entries; note that Vercel only invokes
cron for deployments that receive traffic.

## Running a job by hand

`/admin/jobs` (capability `jobs.run`: OWNER and ORDER_STAFF) shows whether
`CRON_SECRET` is configured, documents each endpoint, and lets an operator run any
job immediately. The action calls the same domain service the endpoint calls, so
it needs no secret and reports how many records were processed.

Use it from the [incident runbook](incident-runbook.md) when a job failed and its
idempotent owner must be retried.

## Safety notes

- Jobs are idempotent: re-running after a partial failure never double-cancels an
  order, double-publishes an announcement, or double-sends an outbox email.
- Each job runs inside a transaction and locks its rows (`for update skipLocked`),
  so overlapping schedulers are safe.
- Job failures are logged with the request id; alert on any non-2xx response.
