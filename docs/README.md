# Project documentation

This directory records durable decisions and operator-only knowledge that cannot be recovered safely from code.

## Navigate

- [Architecture decisions](decisions/architecture-decisions.md) explains the product boundaries and rejected alternatives.
- [Launch checklist](operations/launch-checklist.md) defines the approvals and evidence required before production traffic.
- [Incident runbook](operations/incident-runbook.md) defines safe containment for payment, inventory, auth, and publishing incidents.
- [Backup and restore](operations/backup-restore.md) defines the data-safety gate around migrations and imports.
- [Scheduled jobs](operations/scheduled-jobs.md) lists the maintenance endpoints, their cadence, and how operators retry them.

Implementation details remain in the executable owners linked from those documents.
