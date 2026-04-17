from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import date, time, datetime
from enum import Enum

# ============================================
# ENUM TANIMLAMALARI (models.py ile aynı)
# ============================================

class UserRole(str, Enum):
    driver = "driver"
    operator = "operator"
    admin = "admin"

class ChargerStatus(str, Enum):
    available = "available"
    occupied = "occupied"
    offline = "offline"

class ChargerType(str, Enum):
    AC = "AC"
    DC = "DC"

class PaymentType(str, Enum):
    topup = "TopUp"
    charge = "Charge"
    refund = "Refund"

class ReportStatus(str, Enum):
    open = "open"
    resolved = "resolved"

class ReservationStatus(str, Enum):
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


# ============================================
# USER ŞEMALARI
# ============================================

class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: UserRole


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)

    @field_validator('password')
    def validate_password(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        return v


class UserResponse(UserBase):
    user_id: int

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None


# ============================================
# DRIVER ŞEMALARI
# ============================================

class DriverBase(BaseModel):
    wallet_balance: float = 0.0


class DriverCreate(DriverBase):
    user_id: int


class DriverResponse(DriverBase):
    driver_id: int
    user: UserResponse
    vehicles: List["VehicleResponse"] = []
    reservations: List["ReservationResponse"] = []

    class Config:
        from_attributes = True


# ============================================
# OPERATOR & ADMIN ŞEMALARI
# ============================================

class OperatorBase(BaseModel):
    pass  # Şimdilik ek alan yok


class OperatorCreate(OperatorBase):
    user_id: int


class OperatorResponse(OperatorBase):
    operator_id: int
    user: UserResponse

    class Config:
        from_attributes = True


class OperatorUpdate(BaseModel):
    pass  # Güncellenecek alan yoksa boş bırakılabilir


class AdminBase(BaseModel):
    pass


class AdminCreate(AdminBase):
    user_id: int


class AdminResponse(AdminBase):
    admin_id: int
    user: UserResponse

    class Config:
        from_attributes = True


class AdminUpdate(BaseModel):
    pass


# ============================================
# VEHICLE ŞEMALARI
# ============================================

class VehicleBase(BaseModel):
    brand: str
    model: str
    battery_kWh: float
    connector_type: str
    plate_number: str


class VehicleCreate(VehicleBase):
    owner_id: int


class VehicleResponse(VehicleBase):
    vehicle_id: int
    owner_id: int

    class Config:
        from_attributes = True


class VehicleUpdate(BaseModel):
    brand: Optional[str] = None
    model: Optional[str] = None
    battery_kWh: Optional[float] = None
    connector_type: Optional[str] = None
    plate_number: Optional[str] = None


# ============================================
# STATION ŞEMALARI
# ============================================

class StationBase(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    operating_hours: str


class StationCreate(StationBase):
    operator_id: Optional[int] = None


class StationResponse(StationBase):
    station_id: int
    operator_id: Optional[int] = None
    chargers: List["ChargerResponse"] = []

    class Config:
        from_attributes = True


class StationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    operating_hours: Optional[str] = None
    operator_id: Optional[int] = None


# ============================================
# CHARGER ŞEMALARI
# ============================================

class ChargerBase(BaseModel):
    type: ChargerType
    power_kW: int
    connector_type: str
    price_per_kWh: float
    status: ChargerStatus = ChargerStatus.available


class ChargerCreate(ChargerBase):
    station_id: int


class ChargerResponse(ChargerBase):
    charger_id: int
    station_id: int

    class Config:
        from_attributes = True


class ChargerUpdate(BaseModel):
    type: Optional[ChargerType] = None
    power_kW: Optional[int] = None
    connector_type: Optional[str] = None
    price_per_kWh: Optional[float] = None
    status: Optional[ChargerStatus] = None


# ============================================
# RESERVATION ŞEMALARI
# ============================================

class ReservationBase(BaseModel):
    date: date
    start_time: time
    end_time: time


class ReservationCreate(ReservationBase):
    driver_id: int
    charger_id: int


class ReservationResponse(ReservationBase):
    reservation_id: int
    driver_id: int
    charger_id: int
    status: str  # 'active', 'completed', 'cancelled'
    payment: Optional["PaymentResponse"] = None
    charging_session: Optional["ChargingSessionResponse"] = None

    class Config:
        from_attributes = True


class ReservationUpdate(BaseModel):
    date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    status: Optional[ReservationStatus] = None


# ============================================
# CHARGING SESSION ŞEMALARI
# ============================================

class ChargingSessionBase(BaseModel):
    start_soc: float
    end_soc: float
    kwh_consumed: float
    total_cost: float
    duration_min: int


class ChargingSessionCreate(ChargingSessionBase):
    reservation_id: int


class ChargingSessionResponse(ChargingSessionBase):
    charging_session_id: int
    reservation_id: int

    class Config:
        from_attributes = True


# ============================================
# PAYMENT ŞEMALARI
# ============================================

class PaymentBase(BaseModel):
    amount: float
    type: PaymentType


class PaymentCreate(PaymentBase):
    driver_id: int
    reservation_id: Optional[int] = None


class PaymentResponse(PaymentBase):
    payment_id: int
    driver_id: int
    reservation_id: Optional[int] = None
    timestamp: datetime

    class Config:
        from_attributes = True


# ============================================
# ISSUE REPORT ŞEMALARI
# ============================================

class IssueReportBase(BaseModel):
    description: str


class IssueReportCreate(IssueReportBase):
    charger_id: int


class IssueReportResponse(IssueReportBase):
    issue_id: int
    charger_id: int
    reported_at: datetime
    status: ReportStatus

    class Config:
        from_attributes = True


class IssueReportUpdate(BaseModel):
    status: Optional[ReportStatus] = None
    description: Optional[str] = None


# ============================================
# İLERİ REFERANS ÇÖZÜMÜ
# ============================================

# DriverResponse içinde ReservationResponse listesi olduğu için model_rebuild gerekli
DriverResponse.model_rebuild()
