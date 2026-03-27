# SmartTrack — Local-First PWA Expense Tracker

## Project Overview
SmartTrack is a local-first PWA (Progressive Web App) for personal expense tracking, targeting iOS and web. All data is stored in the browser's IndexedDB (Dexie.js). No account or login is required to use the app. Google sign-in is optional, only for Gmail auto-import.

## Architecture

### Data Layer
- **IndexedDB** (via Dexie.js) — all transactions, accounts, categories, and notifications stored locally
- No server-side database for user data
- JSON backup/restore for data portability
- `artifacts/expense-tracker/src/lib/db.ts` — Dexie schema, CRUD helpers, export/import functions

### Auth (Optional)
- Google OAuth via `@react-oauth/google` (implicit flow)
- Token stored in `localStorage`, user info in `localStorage`
- Only needed for Gmail auto-import (readonly access)
- `VITE_GOOGLE_CLIENT_ID` env var needed for Google features; app works without it
- `artifacts/expense-tracker/src/lib/google-auth.tsx` — Google OAuth context

### Gmail Integration
- Direct browser-side Gmail API calls with the user's OAuth token
- Searches for bank/UPI transaction emails
- `artifacts/expense-tracker/src/lib/gmail.ts` — Gmail API sync logic

### PWA
- VitePWA plugin with offline support and installability
- PWA icons at all sizes in `artifacts/expense-tracker/public/icons/`
- Service worker handles caching
- Push notifications via browser `Notification` API (iOS 16.4+ + Home Screen required for iOS)

### Frontend
- **React + TypeScript + Vite** at `artifacts/expense-tracker/`
- **Tailwind CSS** + **shadcn/ui** components
- **Recharts** for insights/charts
- **TanStack Query** for local async state (Dexie queries wrapped as async functions)
- **Wouter** for routing
- Green (#22c55e) theme, INR (₹) currency, SmartTrack branding

### Backend (Legacy)
- `artifacts/api-server/` — Express API still running but not used for data
- Originally used Replit Auth + PostgreSQL; superseded by local-first approach

## Key Files

| File | Purpose |
|------|---------|
| `artifacts/expense-tracker/src/lib/db.ts` | Dexie database, schema, seed, backup/restore |
| `artifacts/expense-tracker/src/lib/google-auth.tsx` | Google OAuth context provider |
| `artifacts/expense-tracker/src/lib/gmail.ts` | Gmail API integration |
| `artifacts/expense-tracker/src/lib/notifications.ts` | Push notification helpers |
| `artifacts/expense-tracker/src/hooks/use-local-transactions.ts` | Local transaction CRUD hooks |
| `artifacts/expense-tracker/src/hooks/use-local-accounts.ts` | Local account CRUD hooks |
| `artifacts/expense-tracker/src/hooks/use-local-categories.ts` | Local category CRUD hooks |
| `artifacts/expense-tracker/src/hooks/use-local-insights.ts` | Insight computation hooks |
| `artifacts/expense-tracker/src/hooks/use-local-notifications.ts` | Notification setting hooks |
| `artifacts/expense-tracker/src/pages/dashboard.tsx` | Dashboard with monthly summary |
| `artifacts/expense-tracker/src/pages/transactions.tsx` | Transaction list + CRUD + email paste |
| `artifacts/expense-tracker/src/pages/insights.tsx` | Charts — category breakdown, income vs expenses |
| `artifacts/expense-tracker/src/pages/accounts.tsx` | Account management |
| `artifacts/expense-tracker/src/pages/settings.tsx` | Gmail sync, backup/restore, PWA install, categories, alerts |
| `artifacts/expense-tracker/src/components/transaction-dialog.tsx` | Add/edit transaction modal |
| `artifacts/expense-tracker/vite.config.ts` | Vite + PWA plugin config |

## Dependencies (Key)
- `dexie` + `dexie-react-hooks` — IndexedDB ORM
- `@react-oauth/google` — Google OAuth implicit flow
- `vite-plugin-pwa` — Service worker + PWA manifest
- `recharts` — Charts
- `@tanstack/react-query` — Async state management
- `shadcn/ui` — UI component library

## Environment Variables
| Var | Purpose | Required |
|-----|---------|----------|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID for Gmail sync | Optional (app works without) |
| `DATABASE_URL` | PostgreSQL (used by api-server only) | For api-server only |

## Running the App
- Frontend workflow: `pnpm --filter @workspace/expense-tracker run dev`
- Accessible at the preview URL
- API server (legacy): `pnpm --filter @workspace/api-server run dev`

## User Preferences
- INR (₹) currency throughout
- Green (#22c55e) primary color
- Local-first: no account required
- iOS PWA support is a priority
