from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def normalize_currency(value: str) -> str:
    normalized = value.strip().upper()
    if len(normalized) != 3 or not normalized.isalpha():
        raise ValueError("Currency must be a 3-letter code such as USD")
    return normalized


class ReadModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=50)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Customer name cannot be empty")
        return normalized


class CustomerRead(CustomerCreate, ReadModel):
    id: UUID
    created_at: datetime


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=50)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("Customer name cannot be empty")
        return normalized


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Product name cannot be empty")
        return normalized


class ProductRead(ProductCreate, ReadModel):
    id: UUID
    created_at: datetime


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("Product name cannot be empty")
        return normalized


class PlanCreate(BaseModel):
    product_id: UUID
    name: str = Field(min_length=1, max_length=200)
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    billing_interval: Literal["day", "week", "month", "year"]
    interval_count: int = Field(default=1, ge=1, le=365)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Plan name cannot be empty")
        return normalized

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return normalize_currency(value)


class PlanRead(PlanCreate, ReadModel):
    id: UUID
    created_at: datetime


class PlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    billing_interval: Literal["day", "week", "month", "year"] | None = None
    interval_count: int | None = Field(default=None, ge=1, le=365)
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("Plan name cannot be empty")
        return normalized

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        return normalize_currency(value) if value is not None else None


class SubscriptionCreate(BaseModel):
    customer_id: UUID
    plan_id: UUID
    status: Literal["trialing", "active"] = "active"


class SubscriptionRead(SubscriptionCreate, ReadModel):
    id: UUID
    current_period_start: datetime | None
    current_period_end: datetime | None
    cancel_at_period_end: bool
    created_at: datetime


class DiscountCreate(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    discount_type: Literal["percent", "fixed"]
    value: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    is_active: bool = True
    starts_at: datetime | None = None
    expires_at: datetime | None = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized:
            raise ValueError("Discount code cannot be empty")
        return normalized


class DiscountRead(DiscountCreate, ReadModel):
    id: UUID
    created_at: datetime


class DiscountUpdate(BaseModel):
    value: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    is_active: bool | None = None
    starts_at: datetime | None = None
    expires_at: datetime | None = None


class InvoiceItemCreate(BaseModel):
    product_id: UUID | None = None
    description: str = Field(min_length=1, max_length=500)
    quantity: Decimal = Field(default=Decimal("1"), gt=0, max_digits=10, decimal_places=2)
    unit_amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Invoice item description cannot be empty")
        return normalized


class InvoiceItemRead(InvoiceItemCreate, ReadModel):
    id: UUID
    invoice_id: UUID
    line_total: Decimal


class InvoiceCreate(BaseModel):
    customer_id: UUID
    subscription_id: UUID | None = None
    discount_id: UUID | None = None
    currency: str = Field(default="USD", min_length=3, max_length=3)
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    due_at: datetime | None = None
    items: list[InvoiceItemCreate] = Field(min_length=1, max_length=100)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return normalize_currency(value)


class InvoiceRead(ReadModel):
    id: UUID
    invoice_number: str
    customer_id: UUID
    subscription_id: UUID | None
    discount_id: UUID | None
    status: str
    currency: str
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    issued_at: datetime | None
    due_at: datetime | None
    paid_at: datetime | None
    created_at: datetime
    items: list[InvoiceItemRead] = Field(default_factory=list)


class PaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    status: Literal["pending", "succeeded", "failed"] = "pending"
    provider: str = Field(default="manual", max_length=80)
    provider_reference: str | None = Field(default=None, max_length=200)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return normalize_currency(value)


class PaymentRead(PaymentCreate, ReadModel):
    id: UUID
    invoice_id: UUID
    paid_at: datetime | None
    created_at: datetime
