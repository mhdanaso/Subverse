-- Business tables are accessed through the authenticated FastAPI backend.
-- Add narrower policies only after the workspace/ownership model is defined.
begin;

alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.discounts enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;

revoke all privileges on table
    public.customers,
    public.products,
    public.plans,
    public.subscriptions,
    public.discounts,
    public.invoices,
    public.invoice_items,
    public.payments
from anon, authenticated;

commit;
