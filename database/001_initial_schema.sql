create table if not exists public.customers (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text,
    phone text,
    created_at timestamptz not null default now()
);

create table if not exists public.products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.plans (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references public.products(id) on delete restrict,
    name text not null,
    amount numeric(12, 2) not null check (amount >= 0),
    currency char(3) not null default 'USD',
    billing_interval text not null
        check (billing_interval in ('day', 'week', 'month', 'year')),
    interval_count integer not null default 1 check (interval_count > 0),
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references public.customers(id) on delete restrict,
    plan_id uuid not null references public.plans(id) on delete restrict,
    status text not null default 'active'
        check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired')),
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean not null default false,
    created_at timestamptz not null default now(),
    check (
        current_period_end is null
        or current_period_start is null
        or current_period_end > current_period_start
    )
);

create table if not exists public.discounts (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    discount_type text not null check (discount_type in ('percent', 'fixed')),
    value numeric(12, 2) not null check (value > 0),
    is_active boolean not null default true,
    starts_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    check (discount_type <> 'percent' or value <= 100),
    check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table if not exists public.invoices (
    id uuid primary key default gen_random_uuid(),
    invoice_number text not null unique,
    customer_id uuid not null references public.customers(id) on delete restrict,
    subscription_id uuid references public.subscriptions(id) on delete set null,
    discount_id uuid references public.discounts(id) on delete set null,
    status text not null default 'draft'
        check (status in ('draft', 'open', 'paid', 'void', 'overdue')),
    currency char(3) not null default 'USD',
    subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
    tax_amount numeric(12, 2) not null default 0 check (tax_amount >= 0),
    discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
    total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
    issued_at timestamptz,
    due_at timestamptz,
    paid_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references public.invoices(id) on delete cascade,
    product_id uuid references public.products(id) on delete set null,
    description text not null,
    quantity numeric(10, 2) not null default 1 check (quantity > 0),
    unit_amount numeric(12, 2) not null check (unit_amount >= 0),
    line_total numeric(12, 2) not null check (line_total >= 0)
);

create table if not exists public.payments (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references public.invoices(id) on delete restrict,
    amount numeric(12, 2) not null check (amount > 0),
    currency char(3) not null default 'USD',
    status text not null default 'pending'
        check (status in ('pending', 'succeeded', 'failed', 'refunded')),
    provider text,
    provider_reference text unique,
    paid_at timestamptz,
    created_at timestamptz not null default now()
);
