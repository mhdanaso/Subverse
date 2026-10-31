# Subscription Management System

A full-stack recurring billing and subscription platform built with **React**, **FastAPI**, and **PostgreSQL**.

## Core Modules
- **Auth & Users:** JWT authentication and role-based access control.
- **Catalog & Plans:** Tiered pricing, billing cycles, and trial management.
- **Subscription Lifecycle:** Sign-ups, upgrades, downgrades, pauses, and renewals.
- **Billing & Payments:** Automated invoicing, taxes, discounts, and payment tracking.
- **Analytics:** MRR, ARR, churn rate, and revenue reporting about the data.

## Tech Stack
- **Frontend:** React, Vite
- **Backend:** FastAPI, Python, SQLAlchemy
- **Database:** PostgreSQL

## Quick Start

**1. Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**2. Frontend**
```bash
cd frontend
npm install
npm run dev
```

**3. Environment Variables**
- `backend/.env`: `DATABASE_URL=postgresql://user:pass@localhost:5432/sub_db` and `SECRET_KEY=your_secret`
- `frontend/.env`: `VITE_API_BASE_URL=http://localhost:8000`

## API Docs
Once the backend is running, visit `http://localhost:8000/docs` for Swagger UI.
