# Design upgrade — what changed

Only the client's visual layer was rebuilt. **The server, database, API and all business logic are untouched.**

## To apply
1. Replace your project folder with this one (keep your existing `server\data` folder — it holds your data).
2. Double-click **Repair-And-Rebuild.bat** (installs one small new font package and rebuilds).
3. Start the app as usual with **Start-Vishwa-Infra.bat**.

## New in the interface
- New design system: brand palette, Inter Variable typography (bundled — works offline), layered shadows, motion.
- Light / Dark / System themes (header toggle + Settings → Appearance).
- Custom SVG charts (no extra libraries): revenue area chart, monthly columns, donuts, gauge, sparklines, ageing bars.
- Dashboard: hero with live summary, animated KPIs, quick-create tiles, collection health, top balances.
- Command palette — press **Ctrl K** (search documents, customers, pages, create actions). Press **N** for a new document.
- Notifications bell: invoices older than 30 days and draft quotations.
- Toasts and confirmation dialogs replace browser alert()/confirm().
- Document preview now renders the real letterhead header/footer/stamp on a paper sheet.
- Sidebar now lists Repair Bills and Work Orders (they were creatable before but had no list page).
- Responsive layout with mobile drawer navigation; skeleton loading states; empty states.

## Note on numbers
Dashboard/Reports "Invoiced / Collected / Outstanding" are calculated from **GST invoices only**, so quotations
and work orders no longer inflate the outstanding balance. The previous "All documents" total is still shown on Reports.

## Letterheads added (header / footer / stamp images you supplied)
- **Vishwa Infra Solutions India Pvt Ltd** — new header, footer and Chorge proprietor seal.
- **Roylance Enterprises** — new header, footer and the Roylance stamp with "Tejas Patil" signature (stamps converted to transparent PNG so they don't put a white box over the document).

How it is applied: the first time the server starts after this update, it replaces the images of the letterheads with the same short code (VIS, RE)
or same name. Names, numbering, colours, documents, payments, default mappings, and your other letterheads
(e.g. Vishwas Bhikaji Chorge – Government Contractor) are **not** touched. It runs only once per database.
If a letterhead was deleted earlier, it is re-created. The artwork lives in `server/src/letterhead-pack.ts`.
