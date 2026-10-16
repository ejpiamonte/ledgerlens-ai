# Product requirements: LedgerLens AI

## Status and evidence

This document describes the implemented portfolio application and its intended demonstration use. The invoice workflow and visual interface are implemented. Worker behavior has automated tests using a mock Supabase-compatible store and mocked OpenAI responses. The owner reported that the shared Supabase SQL succeeded; screenshots showed the LedgerLens tables and private bucket metadata. Live application reads and writes have not been verified here.

## Problem and objective

Invoice operators repeat data entry, arithmetic checks, duplicate checks, purchase-order checks, and exception routing. LedgerLens demonstrates how extraction can reduce repetitive entry while keeping deterministic validation and human review in control. It makes no measured productivity or financial-impact claim.

## Users

- Portfolio visitor: explores the sample workflow and technical approach.
- Accounting operator: reviews a fictional invoice, its extracted fields, validation results, and processing history.
- Workspace operator: uploads a document and approves, rejects, or reprocesses a persisted record.

The current app has no login, account model, or tenant boundaries. These roles describe intended demo interactions, not authenticated authorization levels.

## Scope

Implemented:

- Demo workspace generated deterministically for two scenarios (small business and enterprise), with a scenario switch, guided tour, dashboard analytics, an illustrative impact estimate with editable assumptions, and per-visitor review decisions that need no database.
- PDF, PNG, and JPEG intake with size and file-signature checks.
- Live-mode OpenAI extraction through the Responses API and strict Zod schema validation.
- Deterministic arithmetic, date, required-field, currency, duplicate, purchase-order, confidence, suspicious-signal, and high-value checks.
- Persistence of invoice, line-item, validation, run, audit, notification, and review records in Supabase.
- Human approve, reject, and reprocess actions for persisted documents (Live Mode) and for demo records (stored per visitor in a cookie).
- Working document search, decision/risk/entity filters, sorting, and pagination.
- Optional Resend email and n8n workflow integration.

Out of scope or not implemented:

- Production financial processing, authentication, tenant isolation, or customer data handling.
- A durable asynchronous queue; live worker execution is synchronous.
- Accounting-system export, payment initiation, or automatic vendor communication.
- Measured ROI. The impact panel is an illustrative estimate from editable assumptions and is labeled as such.
- Import of existing records, uploaded files, or auth users between Supabase projects.

## Requirements and acceptance criteria

- Unsupported, empty, oversized, or signature-mismatched files are rejected before storage.
- Live extraction output must pass the strict schema before financial evaluation.
- Failed checks, duplicates, suspicious signals, high-value totals, and insufficient confidence are routed to human review.
- Only high-confidence invoices with all critical checks passing and no holds may be marked auto-processed.
- Worker writes and decision paths are covered by the existing worker lifecycle test; live provider/database behavior remains a separate smoke-test requirement.
- Demo Mode is the default unless DEMO_MODE is exactly false.
- Credentials remain server-only and example values remain blank.

## Success measures

- Automated tests cover rule boundaries, file signatures, provider adapter behavior, success, failure, review routing, and retry idempotency.
- A reviewer can trace a persisted invoice from intake through its validation and decision records.
- A live integration smoke test succeeds using synthetic documents only, after configuration and approval.

These are project acceptance measures, not customer outcome claims.
