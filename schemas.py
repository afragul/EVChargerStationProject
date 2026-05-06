from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import date as Date, time as Time, datetime as DateTime
from enum import Enum



class ChargerStatus(str, Enum):
    available = "available"
    occupied = "occupied"
    offline = "offline"


class PaymentType(str, Enum):
    topup = "TopUp"
    charge = "Charge"
    refund = "Refund"


class ReportStatus(str, Enum):
    open = "open"
    resolved = "resolved"


## Vehicle şemaları
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


##user şemaları
class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: str


class UserCreate(UserBase):
    password: str  # Kayıt anında ham şifre alınır


class UserResponse(UserBase):
    user_id: int

    # Şifre asla dışarı verilmez

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None


## driver şemaları

class DriverBase(BaseModel):
    wallet_balance: float = 0.0


class DriverCreate(DriverBase):
    user_id: int


class DriverResponse(DriverBase):
    driver_id: int
    user: UserResponse
    vehicles: List[VehicleResponse] = []
    reservations: List["ReservationResponse"] = []

    class Config:
        from_attributes = True


## operator admin şemaları

class OperatorResponse(BaseModel):
    operator_id: int
    user: UserResponse

    class Config:
        from_attributes = True


class AdminResponse(BaseModel):
    admin_id: int
    user: UserResponse

    class Config:
        from_attributes = True


# charger şemaları
class ChargerBase(BaseModel):
    type: str  # AC veya DC
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
    type: Optional[str] = None
    power_kW: Optional[int] = None
    connector_type: Optional[str] = None
    price_per_kWh: Optional[float] = None
    status: Optional[ChargerStatus] = None

class ChargerStatusUpdate(BaseModel):
    status: ChargerStatus


## station şemaları
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
    requested_operator_id: Optional[int] = None
    chargers: List[ChargerResponse] = []

    class Config:
        from_attributes = True


class StationUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    operating_hours: Optional[str] = None
    operator_id: Optional[int] = None


# charging session şema
class ChargingSessionBase(BaseModel):
    # ÇÖZÜM BURADA: Boş (null) gelebilecek değerleri Optional yaptık
    start_soc: Optional[float] = None
    end_soc: Optional[float] = None
    kwh_consumed: float = 0.0
    total_cost: float = 0.0
    duration_min: int = 0


class ChargingSessionCreate(ChargingSessionBase):
    reservation_id: int


class ChargingSessionResponse(ChargingSessionBase):
    charging_session_id: int
    reservation_id: int

    class Config:
        from_attributes = True


# payment şema
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
    timestamp: DateTime

    class Config:
        from_attributes = True


# issue report şema
class IssueReportBase(BaseModel):
    description: str


class IssueReportCreate(IssueReportBase):
    charger_id: int


class IssueReportResponse(IssueReportBase):
    issue_id: int
    charger_id: int
    reported_at: DateTime
    status: ReportStatus

    class Config:
        from_attributes = True


class IssueReportUpdate(BaseModel):
    status: Optional[ReportStatus] = None
    description: Optional[str] = None


# reservation şemaları
class ReservationBase(BaseModel):
    date: Date
    start_time: Time
    end_time: Time


class ReservationCreate(ReservationBase):
    charger_id: int
    vehicle_id: int  # Soket uyumluluğu kontrolü için eklendi


class ReservationResponse(ReservationBase):
    reservation_id: int
    driver_id: int
    charger_id: int
    status: str
    payment: Optional[PaymentResponse] = None
    charging_session: Optional[ChargingSessionResponse] = None

    class Config:
        from_attributes = True


class ReservationUpdate(BaseModel):
    date: Optional[Date] = None
    start_time: Optional[Time] = None
    end_time: Optional[Time] = None
    status: Optional[str] = None  # "active", "completed", "cancelled"


DriverResponse.model_rebuild()