from sqlalchemy import Column, Integer, String, Float, ForeignKey, Enum, Date, Time, DateTime, Table
from sqlalchemy.orm import relationship
import enum
from database import Base
from datetime import datetime
from sqlalchemy import Boolean


class ChargerStatus(str, enum.Enum):
    available = "available"
    occupied = "occupied"
    offline = "offline"


# ---------- FAVORİ İSTASYONLAR ARA TABLOSU ----------
driver_favorite_stations = Table(
    "driver_favorite_stations",
    Base.metadata,
    Column("driver_id", Integer, ForeignKey("drivers.driver_id"), primary_key=True),
    Column("station_id", Integer, ForeignKey("stations.station_id"), primary_key=True)
)


# ----------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String)
    hashed_password = Column(String, nullable=False)

    role = Column(String, nullable=False)
    driver_profile = relationship("Driver", back_populates="user", uselist=False)
    operator_profile = relationship("Operator", back_populates="user", uselist=False)
    admin_profile = relationship("Admin", back_populates="user", uselist=False)


class Driver(Base):
    __tablename__ = "drivers"
    driver_id = Column(Integer, ForeignKey("users.user_id"), primary_key=True, index=True)
    wallet_balance = Column(Float, default=0.0)

    user = relationship("User", back_populates="driver_profile")
    vehicles = relationship("Vehicle", back_populates="owner")
    reservations = relationship("Reservation", back_populates="driver")
    payments = relationship("Payment", back_populates="driver")

    favorite_stations = relationship(
        "Station",
        secondary=driver_favorite_stations,
        back_populates="favorited_by"
    )


class Operator(Base):
    __tablename__ = "operators"
    operator_id = Column(Integer, ForeignKey("users.user_id"), primary_key=True)
    is_approved = Column(Boolean, default=False)  # adminden onay bekliyor
    user = relationship("User", back_populates="operator_profile")
    managed_stations = relationship("Station", back_populates="manager", foreign_keys="[Station.operator_id]")


class Admin(Base):
    __tablename__ = "admins"
    admin_id = Column(Integer, ForeignKey("users.user_id"), primary_key=True)

    user = relationship("User", back_populates="admin_profile")


class Station(Base):
    __tablename__ = "stations"
    station_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)
    operating_hours = Column(String)

    operator_id = Column(Integer, ForeignKey("operators.operator_id"), nullable=True)
    requested_operator_id = Column(Integer, ForeignKey("operators.operator_id"), nullable=True)
    manager = relationship("Operator", back_populates="managed_stations", foreign_keys=[operator_id])
    chargers = relationship("Charger", back_populates="station")

    favorited_by = relationship(
        "Driver",
        secondary=driver_favorite_stations,
        back_populates="favorite_stations"
    )


class Charger(Base):
    __tablename__ = "chargers"
    charger_id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.station_id"))

    type = Column(String)
    power_kW = Column(Integer)
    connector_type = Column(String)
    price_per_kWh = Column(Float)
    status = Column(Enum(ChargerStatus), default=ChargerStatus.available)

    station = relationship("Station", back_populates="chargers")
    reports = relationship("IssueReport", back_populates="charger")


class Vehicle(Base):
    __tablename__ = "vehicles"
    vehicle_id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("drivers.driver_id"))
    brand = Column(String)
    model = Column(String)
    battery_kWh = Column(Float)
    connector_type = Column(String)
    plate_number = Column(String, unique=True)

    owner = relationship("Driver", back_populates="vehicles")


class Reservation(Base):
    __tablename__ = "reservations"
    reservation_id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.driver_id"))
    charger_id = Column(Integer, ForeignKey("chargers.charger_id"))

    date = Column(Date)
    start_time = Column(Time)
    end_time = Column(Time)
    status = Column(String, default="active")

    # YENİ: Şarjın tam olarak başladığı saniyeyi tutacak sütun
    actual_start_time = Column(DateTime, nullable=True)

    driver = relationship("Driver", back_populates="reservations")
    charger = relationship("Charger")
    payment = relationship("Payment", back_populates="reservation", uselist=False)
    charging_session = relationship("ChargingSession", back_populates="reservation", uselist=False)


class PaymentType(str, enum.Enum):
    topup = "TopUp"
    charge = "Charge"
    refund = "Refund"


class Payment(Base):
    __tablename__ = "payments"
    payment_id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.driver_id"))
    reservation_id = Column(Integer, ForeignKey("reservations.reservation_id"))
    amount = Column(Float)
    type = Column(Enum(PaymentType))
    timestamp = Column(DateTime, default=datetime.utcnow)

    driver = relationship("Driver", back_populates="payments")
    reservation = relationship("Reservation", back_populates="payment")


class ReportStatus(str, enum.Enum):
    open = "open"
    resolved = "resolved"


class IssueReport(Base):
    __tablename__ = "issue_reports"
    issue_id = Column(Integer, primary_key=True, index=True)

    charger_id = Column(Integer, ForeignKey("chargers.charger_id"))
    description = Column(String)
    reported_at = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(ReportStatus), default=ReportStatus.open)

    charger = relationship("Charger", back_populates="reports")


class ChargingSession(Base):
    __tablename__ = "charging_sessions"
    charging_session_id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.reservation_id"), unique=True)

    start_soc = Column(Float)
    end_soc = Column(Float)
    kwh_consumed = Column(Float)
    total_cost = Column(Float)
    duration_min = Column(Integer)

    reservation = relationship("Reservation", back_populates="charging_session")


class Notification(Base):
    __tablename__ = "notifications"
    notification_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    message = Column(String)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")