# Automation lifecycle

**Input → file checks → extraction → schema validation → normalization → financial checks → decision → review or processing → notification → audit.**

- **Demo mode:** the six fictional cases are fixed fixtures, not model output. Their validations and outcomes are reproducible. The interface labels sample data and Demo Mode.
- **Live mode:** configure Supabase and OpenAI. The worker retrieves the private source file, sends supported PDF/image input to OpenAI, validates structured output, normalizes candidate values, applies deterministic rules, persists invoices and validations, routes exceptions, and logs notifications and audit events. Extraction/schema failures cannot be automatically approved.
- **n8n mode:** import `n8n/ledgerlens-document-workflow.json`. n8n validates intake metadata, hands base64 content to the authenticated endpoint, then branches on the worker's result. The app owns financial rules and persistence.

The app logs run steps and validation outcomes. Notification delivery is best-effort and must not change an invoice's financial decision. Human approve/reject actions capture an actor, timestamp, and note.
