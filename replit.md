# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── expense-tracker/    # Smart Expense Tracker React web app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Smart Expense Tracker App

A full-featured web expense tracker designed for iOS (and all platforms) using email-based transaction import.

### Features
- **Email Import**: Paste bank email content to auto-extract transactions
- **Categories**: Pre-seeded defaults + custom categories with icons and colors
- **Accounts**: Multiple payment sources (bank, credit card, cash, wallet) with opening/current balance
- **Transactions**: Full CRUD with filters by date, category, account, type
- **Insights & Analytics**: Spending by category (chart), daily trends, income vs expenses, savings rate
- **Notifications**: Configurable browser-based reminders (daily review, weekly summary, bill alerts)
- **Currency**: Default INR (₹)

### DB Tables
- `categories` — expense/income categories with icon, color
- `accounts` — payment sources with opening balance
- `transactions` — all financial transactions (linked to category + account)
- `notifications` — reminder settings

### API Endpoints (all under /api)
- `GET/POST /transactions` — list (with filters) and create
- `PUT/DELETE /transactions/:id`
- `GET/POST /categories`
- `PUT/DELETE /categories/:id`
- `GET/POST /accounts`
- `PUT/DELETE /accounts/:id`
- `GET /insights/summary` — stats for period
- `GET /insights/spending-by-category`
- `GET /insights/daily-spending`
- `GET/POST /notifications`
- `PUT/DELETE /notifications/:id`
- `POST /email-import/parse` — parse email text → extracted transactions
- `POST /email-import/import` — bulk import confirmed transactions

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on B, A's `tsconfig.json` must list B in its `references`

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/`.

### `artifacts/expense-tracker` (`@workspace/expense-tracker`)

React + Vite frontend. Pages: Dashboard, Transactions, Insights, Accounts, Settings.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

- `pnpm --filter @workspace/db run push` — apply schema changes

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI spec + Orval codegen config.

- `pnpm --filter @workspace/api-spec run codegen` — regenerate React Query hooks + Zod schemas
