# Design brief

## Product experience

LedgerLens is an operations workspace for reviewing invoice extraction and decisions. The design should make record state, confidence, validation failures, and required human action easy to scan. It is a demonstration UI and must keep sample content visibly labeled.

## Current visual system

- Light neutral page background with white panels and thin gray-blue borders.
- Deep navy text, blue primary actions, and green/amber/red status colors.
- Fixed left navigation, compact top bar, dashboard metrics, tables, cards, and a vertical run timeline.
- Responsive layout collapses the sidebar and changes multi-column content at narrower breakpoints.
- Typography uses Inter when available, with system sans-serif fallbacks.

## Interaction conventions

- Demo/live mode is shown in the shell and dashboard.
- Status badges use color and text to communicate risk/decision.
- Upload reports progress and a response message and links to the document record.
- Review actions require an explicit decision, and rejection asks for a reason.
- Detail pages show extracted data, line items, checks, run timeline, audit event, and a signed source preview when available.

## Accessibility and responsiveness

The implementation uses native links, buttons, tables, form fields, and a status role for upload feedback. This is not a complete accessibility audit. Before broader release, verify keyboard operation, visible focus, control labels, contrast, screen-reader announcements, table navigation, zoom, and mobile layouts with assistive technology and manual checks.

## Navigation and demo experience

- Sidebar groups: Operate (Overview, Review queue with live count, Documents), Insights (Vendors, Automation runs), Configure (Rules & settings, How it works). Detail pages have breadcrumbs.
- A Small business / Enterprise switch in the top bar swaps the company, data, and policy. Links can preselect a scenario with ?scenario=.
- The overview opens with a three-step guided tour: a clean invoice, a duplicate to resolve, and a high-value invoice routed to the right approver.
- The review page shows a rendered invoice built from extracted fields with amber (low confidence) and red (failed check) highlights, what to check for that exception type, the required approval level, and previous/next queue navigation.
- Charts use the validated categorical pair (blue #2a78d6, orange #eb6834) with a legend, hover tooltip, and a table view. Status colors always appear with a text label.
- Impact figures are illustrative, computed from visible, editable assumptions, and labeled as not measured.

## Known UI gaps

- Authentication and user/tenant context are not represented.
- Demo document previews are rendered from extracted fields; there is no original file in Demo Mode.
- No dark theme, design token library, or visual regression suite is configured.
- Mobile layout was checked at about 520 px wide in a headless browser; a full assistive-technology audit has not been done.
