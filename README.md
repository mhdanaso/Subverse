# Subverse

Subverse is a subscription-management MVP built with React + Vite, FastAPI, and Supabase PostgreSQL/Auth.

## MVP features

- Supabase Auth sign-up, sign-in, session restore, and sign-out
- Customer, product, plan, subscription, discount, invoice, and payment records
- Invoice line totals, discounts, tax amounts, and payment status tracking
- Overview for customers, active subscriptions, monthly payments, MRR, and open invoices
- Protected FastAPI API; the browser does not read or write billing tables directly

This is a single shared workspace for the authorized team. The MVP records manual payment status; it does **not** charge cards or connect to a payment processor.

## Supabase setup

The hosted project has already been configured by the project owner. The SQL files under `database/` describe the schema and security setup for reproducibility:

1. `database/001_initial_schema.sql` — core billing tables
2. `database/002_auth_profiles.sql` — profile table, own-profile policies, and Auth signup trigger
3. `database/003_secure_business_tables.sql` — RLS and removal of direct `anon`/`authenticated` table grants for business data

Do not blindly rerun these against the hosted project. Inspect the current Supabase schema and policies first. The business tables are intended to be used through FastAPI. Add narrower RLS policies only after the app’s ownership model is defined.

## Environment configuration

Copy `backend/.env.example` to `backend/.env`, then fill in values from the Supabase project:

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@YOUR_SESSION_POOLER_HOST:5432/postgres
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
ALLOWED_USER_EMAILS=leader@example.com,member2@example.com,member3@example.com,member4@example.com
```

Use the **Session pooler** string if the local network cannot reach the Direct endpoint. Add the actual team login emails to `ALLOWED_USER_EMAILS`; all allowlisted team members can currently access the shared workspace. Keep `backend/.env` private.

Copy `frontend/.env.example` to `frontend/.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
VITE_API_URL=http://127.0.0.1:8000
```

Only the project URL and publishable key belong in the frontend. Never place the database connection string, password, or a secret/service-role key in frontend files. Both real environment files are ignored by Git.

## Run locally

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

The API is at `http://127.0.0.1:8000`; interactive API documentation is at `http://127.0.0.1:8000/docs`. `/health` checks the app and `/health/db` checks PostgreSQL connectivity.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open the local Vite URL (normally `http://localhost:5173`). If `.env.local` changes while Vite is running, restart the dev server.

## API contract

All `/api/*` routes require `Authorization: Bearer <Supabase access token>`. FastAPI verifies the token against Supabase Auth and checks that the user’s email is in `ALLOWED_USER_EMAILS`.

- `GET /api/overview`
- `GET|POST /api/customers`
- `GET|POST /api/products`
- `GET|POST /api/plans`
- `GET|POST /api/subscriptions`
- `POST /api/subscriptions/{id}/cancel`
- `GET|POST /api/discounts`
- `GET|POST /api/invoices`
- `GET|POST /api/invoices/{id}/payments`

The overview reports money grouped by currency rather than adding different currencies together. Invoice/payment endpoints store billing records; no card transaction is initiated.

## Team ownership

- Member 1: schema/API coordination and integration
- Member 2: React dashboard and API integration
- Member 3: Auth, profiles, products, and plans
- Member 4: subscriptions, invoices, discounts, payments, and analytics

Coordinate schema edits before applying them to the shared Supabase project. Keep migrations in `database/` so the schema can be reviewed and recreated.
