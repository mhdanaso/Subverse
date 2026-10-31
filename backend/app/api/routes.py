import calendar
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.dependencies import get_current_user, get_db
from app.models import (
    Customer,
    Discount,
    Invoice,
    InvoiceItem,
    Payment,
    Plan,
    Product,
    Subscription,
)
from app.schemas import (
    CustomerCreate,
    CustomerRead,
    CustomerUpdate,
    DiscountCreate,
    DiscountRead,
    DiscountUpdate,
    InvoiceCreate,
    InvoiceRead,
    PaymentCreate,
    PaymentRead,
    PlanCreate,
    PlanRead,
    PlanUpdate,
    ProductCreate,
    ProductRead,
    ProductUpdate,
    SubscriptionCreate,
    SubscriptionRead,
)


router = APIRouter(
    prefix="/api",
    tags=["Subverse"],
    dependencies=[Depends(get_current_user)],
)
CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def add_billing_period(start: datetime, interval: str, count: int) -> datetime:
    if interval == "day":
        return start + timedelta(days=count)
    if interval == "week":
        return start + timedelta(weeks=count)
    if interval == "month":
        month_index = start.year * 12 + (start.month - 1) + count
        year, month_index = divmod(month_index, 12)
        month = month_index + 1
        day = min(start.day, calendar.monthrange(year, month)[1])
        return start.replace(year=year, month=month, day=day)
    year = start.year + count
    day = min(start.day, calendar.monthrange(year, start.month)[1])
    return start.replace(year=year, day=day)


def get_or_404(db: Session, model, record_id: uuid.UUID, label: str):
    record = db.get(model, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    return record


@router.get("/overview")
def get_overview(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    customer_count = db.query(func.count(Customer.id)).scalar() or 0
    active_subscriptions = (
        db.query(func.count(Subscription.id))
        .filter(Subscription.status == "active")
        .scalar()
        or 0
    )
    open_invoice_count = (
        db.query(func.count(Invoice.id))
        .filter(Invoice.status.in_(["open", "overdue"]))
        .scalar()
        or 0
    )

    revenue_rows = (
        db.query(Payment.currency, func.sum(Payment.amount))
        .filter(
            Payment.status == "succeeded",
            Payment.paid_at >= month_start,
        )
        .group_by(Payment.currency)
        .all()
    )
    successful_payments = (
        db.query(
            Payment.invoice_id.label("invoice_id"),
            func.sum(Payment.amount).label("paid_amount"),
        )
        .filter(Payment.status == "succeeded")
        .group_by(Payment.invoice_id)
        .subquery()
    )
    outstanding_rows = (
        db.query(
            Invoice.currency,
            func.sum(
                Invoice.total_amount
                - func.coalesce(successful_payments.c.paid_amount, Decimal("0"))
            ),
        )
        .outerjoin(successful_payments, successful_payments.c.invoice_id == Invoice.id)
        .filter(Invoice.status.in_(["open", "overdue"]))
        .group_by(Invoice.currency)
        .all()
    )

    mrr_rows = (
        db.query(Plan.currency, Plan.amount, Plan.billing_interval, Plan.interval_count)
        .join(Subscription, Subscription.plan_id == Plan.id)
        .filter(Subscription.status == "active")
        .all()
    )
    mrr_by_currency: dict[str, Decimal] = {}
    for currency, amount, interval, interval_count in mrr_rows:
        count = Decimal(interval_count)
        if interval == "day":
            monthly_amount = amount * Decimal(365) / Decimal(12) / count
        elif interval == "week":
            monthly_amount = amount * Decimal(52) / Decimal(12) / count
        elif interval == "year":
            monthly_amount = amount / Decimal(12) / count
        else:
            monthly_amount = amount / count
        mrr_by_currency[currency.strip()] = (
            mrr_by_currency.get(currency.strip(), Decimal(0)) + monthly_amount
        )

    return {
        "customer_count": customer_count,
        "active_subscriptions": active_subscriptions,
        "open_invoice_count": open_invoice_count,
        "monthly_revenue": [
            {"currency": currency.strip(), "amount": money(amount or Decimal(0))}
            for currency, amount in revenue_rows
        ],
        "outstanding_invoices": [
            {"currency": currency.strip(), "amount": money(amount or Decimal(0))}
            for currency, amount in outstanding_rows
        ],
        "monthly_recurring_revenue": [
            {"currency": currency, "amount": money(amount)}
            for currency, amount in sorted(mrr_by_currency.items())
        ],
    }


@router.get("/customers", response_model=list[CustomerRead])
def list_customers(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return db.query(Customer).order_by(Customer.created_at.desc()).offset(offset).limit(limit).all()


@router.post("/customers", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    customer = Customer(**payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.patch("/customers/{customer_id}", response_model=CustomerRead)
def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
):
    customer = get_or_404(db, Customer, customer_id, "Customer")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Provide at least one field to update")
    if "name" in changes and changes["name"] is None:
        raise HTTPException(status_code=422, detail="Customer name cannot be empty")
    for key, value in changes.items():
        setattr(customer, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/products", response_model=list[ProductRead])
def list_products(
    active_only: bool = False,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Product)
    if active_only:
        query = query.filter(Product.is_active.is_(True))
    return query.order_by(Product.created_at.desc()).offset(offset).limit(limit).all()


@router.post("/products", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.patch("/products/{product_id}", response_model=ProductRead)
def update_product(product_id: uuid.UUID, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = get_or_404(db, Product, product_id, "Product")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Provide at least one field to update")
    if "name" in changes and changes["name"] is None:
        raise HTTPException(status_code=422, detail="Product name cannot be empty")
    for key, value in changes.items():
        setattr(product, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(product)
    return product


@router.get("/plans", response_model=list[PlanRead])
def list_plans(
    active_only: bool = False,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Plan)
    if active_only:
        query = query.filter(Plan.is_active.is_(True))
    return query.order_by(Plan.created_at.desc()).offset(offset).limit(limit).all()


@router.post("/plans", response_model=PlanRead, status_code=status.HTTP_201_CREATED)
def create_plan(payload: PlanCreate, db: Session = Depends(get_db)):
    get_or_404(db, Product, payload.product_id, "Product")
    plan = Plan(**payload.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.patch("/plans/{plan_id}", response_model=PlanRead)
def update_plan(plan_id: uuid.UUID, payload: PlanUpdate, db: Session = Depends(get_db)):
    plan = get_or_404(db, Plan, plan_id, "Plan")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Provide at least one field to update")
    for key, value in changes.items():
        if isinstance(value, str):
            value = value.strip()
        setattr(plan, key, value)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/subscriptions", response_model=list[SubscriptionRead])
def list_subscriptions(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return (
        db.query(Subscription)
        .order_by(Subscription.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.post(
    "/subscriptions",
    response_model=SubscriptionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_subscription(payload: SubscriptionCreate, db: Session = Depends(get_db)):
    get_or_404(db, Customer, payload.customer_id, "Customer")
    plan = get_or_404(db, Plan, payload.plan_id, "Plan")
    if not plan.is_active:
        raise HTTPException(status_code=409, detail="An inactive plan cannot be subscribed to")

    start = datetime.now(timezone.utc)
    subscription = Subscription(
        customer_id=payload.customer_id,
        plan_id=payload.plan_id,
        status=payload.status,
        current_period_start=start,
        current_period_end=add_billing_period(start, plan.billing_interval, plan.interval_count),
        cancel_at_period_end=False,
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


@router.post("/subscriptions/{subscription_id}/cancel", response_model=SubscriptionRead)
def cancel_subscription(
    subscription_id: uuid.UUID,
    at_period_end: bool = True,
    db: Session = Depends(get_db),
):
    subscription = get_or_404(db, Subscription, subscription_id, "Subscription")
    if subscription.status == "canceled":
        raise HTTPException(status_code=409, detail="Subscription is already canceled")

    if at_period_end:
        subscription.cancel_at_period_end = True
    else:
        subscription.status = "canceled"
        subscription.cancel_at_period_end = False
        subscription.current_period_end = datetime.now(timezone.utc)

    db.commit()
    db.refresh(subscription)
    return subscription


@router.get("/discounts", response_model=list[DiscountRead])
def list_discounts(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return db.query(Discount).order_by(Discount.created_at.desc()).offset(offset).limit(limit).all()


@router.post("/discounts", response_model=DiscountRead, status_code=status.HTTP_201_CREATED)
def create_discount(payload: DiscountCreate, db: Session = Depends(get_db)):
    if payload.discount_type == "percent" and payload.value > 100:
        raise HTTPException(status_code=422, detail="Percentage discount cannot exceed 100")
    if payload.starts_at and payload.expires_at and payload.expires_at <= payload.starts_at:
        raise HTTPException(status_code=422, detail="Discount expiry must be after its start")

    discount = Discount(**payload.model_dump())
    db.add(discount)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="That discount code already exists") from exc
    db.refresh(discount)
    return discount


@router.patch("/discounts/{discount_id}", response_model=DiscountRead)
def update_discount(
    discount_id: uuid.UUID,
    payload: DiscountUpdate,
    db: Session = Depends(get_db),
):
    discount = get_or_404(db, Discount, discount_id, "Discount")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Provide at least one field to update")
    new_type = changes.get("discount_type", discount.discount_type)
    new_value = changes.get("value", discount.value)
    if new_type == "percent" and new_value is not None and new_value > 100:
        raise HTTPException(status_code=422, detail="Percentage discount cannot exceed 100")
    new_start = changes.get("starts_at", discount.starts_at)
    new_expiry = changes.get("expires_at", discount.expires_at)
    if new_start and new_expiry and new_expiry <= new_start:
        raise HTTPException(status_code=422, detail="Discount expiry must be after its start")
    for key, value in changes.items():
        setattr(discount, key, value.strip().upper() if isinstance(value, str) else value)
    db.commit()
    db.refresh(discount)
    return discount


@router.get("/invoices", response_model=list[InvoiceRead])
def list_invoices(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return (
        db.query(Invoice)
        .options(selectinload(Invoice.items))
        .order_by(Invoice.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.post("/invoices", response_model=InvoiceRead, status_code=status.HTTP_201_CREATED)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)):
    get_or_404(db, Customer, payload.customer_id, "Customer")
    if payload.subscription_id:
        subscription = get_or_404(db, Subscription, payload.subscription_id, "Subscription")
        if subscription.customer_id != payload.customer_id:
            raise HTTPException(
                status_code=422,
                detail="Subscription does not belong to the selected customer",
            )

    discount = None
    if payload.discount_id:
        discount = get_or_404(db, Discount, payload.discount_id, "Discount")
        now = datetime.now(timezone.utc)
        if not discount.is_active:
            raise HTTPException(status_code=422, detail="Discount is inactive")
        if discount.starts_at and discount.starts_at > now:
            raise HTTPException(status_code=422, detail="Discount is not active yet")
        if discount.expires_at and discount.expires_at <= now:
            raise HTTPException(status_code=422, detail="Discount has expired")

    line_items: list[InvoiceItem] = []
    subtotal = Decimal("0")
    for item in payload.items:
        if item.product_id:
            get_or_404(db, Product, item.product_id, "Product")
        line_total = money(item.quantity * item.unit_amount)
        subtotal += line_total
        line_items.append(
            InvoiceItem(
                product_id=item.product_id,
                description=item.description.strip(),
                quantity=item.quantity,
                unit_amount=item.unit_amount,
                line_total=line_total,
            )
        )
    subtotal = money(subtotal)

    discount_amount = Decimal("0")
    if discount:
        if discount.discount_type == "percent":
            discount_amount = money(subtotal * discount.value / Decimal("100"))
        else:
            discount_amount = min(subtotal, discount.value)

    total_amount = max(Decimal("0"), money(subtotal + payload.tax_amount - discount_amount))
    now = datetime.now(timezone.utc)
    invoice = Invoice(
        invoice_number=f"INV-{now:%Y%m%d}-{uuid.uuid4().hex[:8].upper()}",
        customer_id=payload.customer_id,
        subscription_id=payload.subscription_id,
        discount_id=payload.discount_id,
        status="open",
        currency=payload.currency,
        subtotal=subtotal,
        tax_amount=payload.tax_amount,
        discount_amount=discount_amount,
        total_amount=total_amount,
        issued_at=now,
        due_at=payload.due_at,
        items=line_items,
    )
    try:
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
    except Exception:
        db.rollback()
        raise
    return invoice


@router.get("/invoices/{invoice_id}/payments", response_model=list[PaymentRead])
def list_payments(invoice_id: uuid.UUID, db: Session = Depends(get_db)):
    get_or_404(db, Invoice, invoice_id, "Invoice")
    return (
        db.query(Payment)
        .filter(Payment.invoice_id == invoice_id)
        .order_by(Payment.created_at.desc())
        .all()
    )


@router.post(
    "/invoices/{invoice_id}/payments",
    response_model=PaymentRead,
    status_code=status.HTTP_201_CREATED,
)
def record_payment(invoice_id: uuid.UUID, payload: PaymentCreate, db: Session = Depends(get_db)):
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == invoice_id)
        .with_for_update()
        .first()
    )
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status in {"void", "paid"}:
        raise HTTPException(status_code=409, detail="This invoice cannot accept payments")
    if payload.currency != invoice.currency.strip():
        raise HTTPException(status_code=422, detail="Payment and invoice currencies must match")

    if payload.status == "succeeded":
        already_paid = (
            db.query(func.coalesce(func.sum(Payment.amount), 0))
            .filter(Payment.invoice_id == invoice.id, Payment.status == "succeeded")
            .scalar()
        )
        if already_paid + payload.amount > invoice.total_amount:
            raise HTTPException(status_code=422, detail="Payment exceeds the remaining invoice balance")

    payment = Payment(
        invoice_id=invoice.id,
        amount=payload.amount,
        currency=payload.currency,
        status=payload.status,
        provider=payload.provider,
        provider_reference=payload.provider_reference,
        paid_at=datetime.now(timezone.utc) if payload.status == "succeeded" else None,
    )
    try:
        db.add(payment)
        db.flush()
        if payload.status == "succeeded":
            paid_total = (
                db.query(func.coalesce(func.sum(Payment.amount), 0))
                .filter(Payment.invoice_id == invoice.id, Payment.status == "succeeded")
                .scalar()
            )
            if paid_total >= invoice.total_amount:
                invoice.status = "paid"
                invoice.paid_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(payment)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="That payment reference has already been recorded",
        ) from exc
    except Exception:
        db.rollback()
        raise
    return payment
