# Vishwa Infra

A private, self-hosted business management application for quotations, GST invoices, repair bills, work orders, payments and reporting. It runs on your own computer, your data never leaves it unless you choose to back it up to the cloud, and it works from a laptop or a phone on the same network.

*Neurava AI by Parag*

Developed by **Parag Kiran Udgirkar**. For custom software requirements, contact details are in [Author and contact](#author-and-contact).

\---

## Contents

1. [Features](#features)
2. [Quick start](#quick-start)
3. [Accounts and access control](#accounts-and-access-control)
4. [Daily use](#daily-use)
5. [Configuration](#configuration)
6. [Security](#security)
7. [Backup and recovery](#backup-and-recovery)
8. [Using it on a phone or as an installed app](#using-it-on-a-phone-or-as-an-installed-app)
9. [Updating](#updating)
10. [Troubleshooting](#troubleshooting)
11. [For developers](#for-developers)
12. [Known limitations](#known-limitations)
13. [Changelog](#changelog)
14. [Author and contact](#author-and-contact)

\---

## Features

**Documents and billing**

* Quotations, GST invoices, repair bills and work orders, with any number of line items
* Automatic, collision-safe document numbering per financial year
* Printable / PDF output on your own letterhead, with a colour-accented layout
* UPI "scan and pay" QR code printed on invoices and repair bills
* One-click duplication of a document as a new draft
* Share a document by WhatsApp or email straight from its row

**Customers, products and payments**

* Customer list that grows as you type new names
* Products and services with HSN/SAC codes and basic stock tracking, including low-stock hints
* Payment recording against invoices, with outstanding balances

**Reporting**

* Dashboard and reports with revenue, collections and receivables charts
* CSV export for customers, each document type and payments
* GST summary report for your accountant

**Security and administration**

* Role-based access with a full audit trail (Activity Log)
* Optional two-factor login (authenticator app)
* Login lockout, API rate limiting and per-device session sign-out

**Reliability**

* Automatic daily local backup (30 days retained)
* Optional automatic off-site backup to Dropbox

**Experience**

* Light, dark and system themes, keyboard shortcuts and a command palette (`Ctrl + K`)
* Responsive layout, installable as an app on desktop and mobile

\---

## Quick start

**Requirements:** Windows, and [Node.js](https://nodejs.org/) 20 or newer (installed once).

1. Double-click **`Start-Vishwa-Infra.bat`**.
2. The application opens in its own window at `http://localhost:4000`.
3. Keep the black console window open while you work. Closing it stops the application.

The first start takes a few minutes while dependencies install and the app builds. Later starts are fast.

For a one-touch launcher, run **`Create-Desktop-Shortcut.bat`** once. The resulting Desktop icon starts the server and opens the application in a clean window, with no address bar, in a single double-click.

\---

## Accounts and access control

Three accounts are created on first start.

Default temporary passwords are `admin123`, `Parag@2026` and `Vishwas@2026`. Parag and Vishwas are required to choose a new password at first sign-in. **Change the `admin` password in Settings immediately**, or set your own temporary passwords before first start (see [Configuration](#configuration)).

|Capability|Full Access|Access (No Build)|
|-|-|-|
|Documents, customers, products, payments, reports, letterheads|Yes|Yes|
|Delete records|Yes|No|
|Edit company profile|Yes|No|
|View Activity Log|Yes|No|
|Repair/rebuild the app, Developer Mode|Yes|Requires developer PIN|

The developer PIN is stored in `devpin.txt`, created next to the scripts on first use. Edit that file to change the PIN. It is excluded from version control and from shared zips.

\---

## Daily use

**Create a document**

1. Click **New document** (or press `N`).
2. Choose the type: Quotation, GST Invoice, Repair Bill or Work Order.
3. Type a customer name or pick a saved one. New names are added to Customers automatically.
4. Add items and click **Save**.

**Print or save as PDF**
Open the document, click **Print / Save as PDF**, then choose a printer or "Save as PDF".

**Record a payment**
Open **Payments**, click **Record payment**, select the invoice, enter the amount and method, and save.

**Search**
Press `Ctrl + K` to search documents and customers or jump to any page.

**Letterheads**
Three letterheads are built in: *Vishwa Infra Solutions India Pvt Ltd* (default for invoices, quotations and repair bills), *Vishwas Bhikaji Chorge - Government Contractor* (default for work orders) and *Roylance Enterprises* (selected manually). Use **Letterheads** in the side menu to upload header, stamp and footer images and to choose the default per document type.

**UPI payment QR**
Enter your UPI ID once under **Settings → Company profile**. Every printed GST invoice and repair bill then carries a scan-to-pay QR for its exact amount. Quotations never show one. Leave the field blank to disable it.

\---

## Configuration

|Variable|Purpose|Default|
|-|-|-|
|`PORT`|Port the server listens on|`4000`|
|`ADMIN\_TEMP\_PASSWORD`|First-time password for `admin`|
|`PARAG\_TEMP\_PASSWORD`|First-time password for `parag`|
|`VISHWAS\_TEMP\_PASSWORD`|First-time password for `vishwas`|
|`CORS\_ORIGIN`|Restrict which origin may call the API|`\*` (any)|
|`DROPBOX\_ACCESS\_TOKEN`|Enables Dropbox cloud backup|empty (off)|
|`DROPBOX\_FOLDER`|Dropbox folder for backups|`/Vishwa Infra Backups`|

Temporary passwords apply only when an account is first created. Changing them later does not alter existing accounts.

\---

## Security

* Passwords are hashed with scrypt and compared in constant time; all database access uses parameterised queries.
* Five failed sign-ins lock that login for 15 minutes. API requests are rate limited.
* Sessions expire after 12 hours. **Settings → Sign out everywhere** ends every session for your account.
* Every create, edit and delete is recorded in the Activity Log (Full Access only).
* Secrets and business data are excluded from version control by `.gitignore` (`.env`, `devpin.txt`, `server/data`).

### Two-factor login (optional, per account)

1. Go to **Settings → Two-factor login** and choose **Set up two-factor login**.
2. Scan the QR code with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or similar).
3. Enter the 6-digit code to confirm. From then on that account requires a code at every sign-in.

You can turn it off from the same screen with your password. If an authenticator is lost, another Full Access user can be asked to reset it, or as a last resort set `totp\_enabled=0` for that user in `server/data/vishwa.db`.

\---

## Backup and recovery

All data is stored in a single file: `server/data/vishwa.db`.

|Method|Details|
|-|-|
|Automatic daily backup|Created on startup if the newest backup is over 24 hours old. Stored in `backups/`, last 30 kept.|
|Manual download|**Settings → Download database backup**|
|Script|Double-click `Backup-Database.bat`|
|Dropbox (optional)|Every automatic backup is also uploaded; **Back up to Dropbox now** appears in Settings|

Keep at least one copy off this computer, for example on a USB drive or in cloud storage.

### Enabling Dropbox backup

1. Create an app at [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps) (Scoped access, App folder is sufficient).
2. Under **Permissions**, enable `files.content.write`.
3. Under **Settings**, choose **Generate access token**.
4. Paste the token into `DROPBOX\_ACCESS\_TOKEN` in `server/.env` and restart the application.

Settings shows whether cloud backup is configured.

### Restoring

Close the application, replace `server/data/vishwa.db` with a backup copy (renamed to `vishwa.db`), and start again.

\---

## Using it on a phone or as an installed app

The server listens on your local network, so no extra setup is required.

1. Connect the phone to the **same Wi-Fi** as the computer and start the application there.
2. Open **Settings → Mobile \& install**.
3. Type the address shown into the phone's browser, or scan the QR code.

If the page does not load, Windows Firewall may be blocking the connection. Allow the prompt when it appears.

**Installing as an app**

|Device|How|
|-|-|
|The computer running the server|Use the Desktop shortcut from `Create-Desktop-Shortcut.bat`. A browser-installed icon on this same computer can only open the app, not start the server.|
|Android, or desktop Chrome/Edge on another device|Use **Install as an app** in Settings, or the install icon in the browser address bar.|
|iPhone / iPad|In Safari, tap **Share → Add to Home Screen**.|

An installed app opens in its own window with its own icon and tolerates brief network interruptions. It does not display business data while truly offline, so you never see stale invoices.

\---

## Updating

1. Close the black console window.
2. Replace the project folder with the new version. **Keep your `server/data` folder.**
3. Double-click `Start-Vishwa-Infra.bat`. It stops the previous copy, installs new dependencies and rebuilds automatically.

If anything still misbehaves, run `Repair-And-Rebuild.bat`. Your data is preserved.

\---

## Troubleshooting

|Problem|Resolution|
|-|-|
|"Node.js is not installed"|Install Node.js 20+ from nodejs.org and start again.|
|"Can't reach this page"|The server is not running. Start it with `Start-Vishwa-Infra.bat` and keep its window open.|
|A message says the server did not start|Open the "Vishwa Infra Business Suite" window in the taskbar to read the error, or run `Repair-And-Rebuild.bat`.|
|A save fails or shows an error|Close the console window and start again.|
|Still failing|Run `Repair-And-Rebuild.bat`.|
|Phone cannot connect|Confirm the same Wi-Fi, keep the computer awake, and allow Windows Firewall access.|
|Forgot a password|Ask your developer to reset it in the database.|

\---

## For developers

**Stack:** React, TypeScript and Vite (client); Node.js, Express and SQLite via `better-sqlite3` (server); Zod for validation; Vitest for tests.

```text
npm install
npm run dev       # client on :5173, API on :4000
npm run build     # production build
npm start         # production: single server on :4000
npm test          # server unit tests (Vitest)
npm run lint      # ESLint across client and server
npm run format    # Prettier
```

`Start-Developer-Mode.bat` starts development mode and requires the developer PIN.

```text
client/           React app (pages/, charts, forms, PWA service worker in public/)
server/src/       index.ts (API), print.ts (document templates), totp.ts (2FA),
                  utils.ts (numbering, amount in words), \_\_tests\_\_/
server/data/      SQLite database (git-ignored)
backups/          automatic daily backups
```

Tests cover financial-year logic, amount-in-words and the TOTP implementation, which is verified against the RFC 4226 test vectors.

\---

## Known limitations

* GST is split into CGST and SGST only. Inter-state IGST is not yet supported.
* Built for a single computer hosting the data; concurrent multi-user editing is not designed for.
* GST e-invoicing (IRN/QR from the government portal) is not integrated. Confirm with your accountant whether your turnover requires it.

\---

## Changelog

### Latest update

* Two-factor login, UPI payment QR on invoices, Dropbox cloud backup
* Installable app, phone access with QR code, one-touch desktop launcher with server-readiness check
* Secrets moved to `server/.env` and `devpin.txt`; API rate limiting; unit tests and linting
* Chart loading states and refined number-entry fields in forms

### Earlier

* Role-based access control and Activity Log
* Automatic daily backup
* Login lockout and sign-out of all devices
* Collision-safe invoice numbering
* HSN/SAC codes and stock tracking
* CSV and GST summary exports
* Repeat document, WhatsApp and email sharing
* Colour-accented print layout that follows each letterhead

\---

################################################################

## Author and contact

# Parag Kiran Udgirkar

|Software developer| |Neurava AI|
| Phone | [9359971823]  (tel:+919359971823) |
| Email | neurava.hq@gmail.com |

Please get in touch for any software requirements: custom business applications, new features for this suite, integrations, support and maintenance.

################################################################
