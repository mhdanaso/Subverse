# Subverse frontend

React + Vite dashboard. It uses Supabase Auth for team sign-in and sends the current access token to the FastAPI backend for all business data.

## Setup

Copy `.env.example` to `.env.local`, then set the Supabase project URL, publishable key, and FastAPI URL. Never place database credentials or a secret/service-role key in this file.

```powershell
npm install
npm run dev
```

The frontend expects FastAPI at `http://127.0.0.1:8000` by default. Change `VITE_API_URL` if needed. The app's manual payment form records a payment already received; it does not charge a card.
