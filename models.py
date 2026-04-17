from sqlalchemy import Column, Integer, String, Float, ForeignKey, Enum, Date, Time, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func  # Otomatik zaman damgası için eklendi
import enum
from database import Base

# ============================================
# ENUM TANIMLAMALARI (İyileştirilmiş)
# ============================================

class UserRole(str, enum.Enum):
    """Kullanıcı rolleri için Enum. models.py içinde tanımlanması önerilir."""
    driver = "driver"
    operator = "operator"
    admin = "admin"

class ChargerStatus(str, enum.Enum):
    available = "available"
    occupied = "occupied"
    offline = "offline"

class ChargerType(str, enum.Enum):
    """Şarj cihazı tipi (AC/DC) için Enum."""
    AC = "AC"
    DC = "DC"

class PaymentType(str, enum.Enum):
    topup = "TopUp"
    charge = "Charge"
    refund = "Refund"

class ReportStatus(str, enum.Enum):
    open = "open"
    resolved = "resolved"

# ============================================
# TABLO MODELLERİ
# ============================================

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String)
    hashed_password = Column(String, nullable=False)

    # String yerine Enum kullanıldı
    role = Column(Enum(UserRole), nullable=False)

    # İlişkiler
    driver_profile = relationship("Driver", back_populates="user", uselist=False, cascade="all, delete-orphan")
    operator_profile = relationship("Operator", back_populates="user", uselist=False, cascade="all, delete-orphan")
    admin_profile = relationship("Admin", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Driver(Base):
    __tablename__ = "drivers"
    # ForeignKey'e ondelete="CASCADE" eklendi (User silinince Driver da silinir)
    driver_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True, index=True)
    wallet_balance = Column(Float, default=0.0, nullable=False)

    # İlişkiler
    user = relationship("User", back_populates="driver_profile")
    vehicles = relationship("Vehicle", back_populates="owner", cascade="all, delete-orphan")
    reservations = relationship("Reservation", back_populates="driver")
    payments = relationship("Payment", back_populates="driver")


class Operator(Base):
    __tablename__ = "operators"
    operator_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)

    user = relationship("User", back_populates="operator_profile")
    managed_stations = relationship("Station", back_populates="manager")


class Admin(Base):
    __tablename__ = "admins"
    admin_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), primary_key=True)

    user = relationship("User", back_populates="admin_profile")


class Station(Base):
    __tablename__ = "stations"
    station_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    address = Column(String, nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)
    operating_hours = Column(String)

    operator_id = Column(Integer, ForeignKey("operators.operator_id", ondelete="SET NULL"), nullable=True)
    manager = relationship("Operator", back_populates="managed_stations")
    chargers = relationship("Charger", back_populates="station", cascade="all, delete-orphan")


class Charger(Base):
    __tablename__ = "chargers"
    charger_id = Column(Integer, primary_key=True, index=True)

    station_id = Column(Integer, ForeignKey("stations.station_id", ondelete="CASCADE"), nullable=False)

    # type alanı Enum olarak değiştirildi
    type = Column(Enum(ChargerType), nullable=False)
    power_kW = Column(Integer, nullable=False)
    connector_type = Column(String, nullable=False)
    price_per_kWh = Column(Float, nullable=False)
    status = Column(Enum(ChargerStatus), default=ChargerStatus.available, nullable=False)

    # İlişkiler
    station = relationship("Station", back_populates="chargers")
    reports = relationship("IssueReport", back_populates="charger")
    reservations = relationship("Reservation", back_populates="charger")  # EKSİK İLİŞKİ EKLENDİ


class Vehicle(Base):
    __tablename__ = "vehicles"
    vehicle_id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("drivers.driver_id", ondelete="CASCADE"), nullable=False)
    brand = Column(String, nullable=False)
    model = Column(String, nullable=False)
    battery_kWh = Column(Float, nullable=False)
    connector_type = Column(String, nullable=False)
    plate_number = Column(String, unique=True, nullable=False)

    owner = relationship("Driver", back_populates="vehicles")


class Reservation(Base):
    __tablename__ = "reservations"
    reservation_id = Column(Integer, primary_key=True, index=True)

    driver_id = Column(Integer, ForeignKey("drivers.driver_id", ondelete="CASCADE"), nullable=False)
    charger_id = Column(Integer, ForeignKey("chargers.charger_id", ondelete="CASCADE"), nullable=False)

    date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)

    status = Column(String, default="active", nullable=False)  # "active", "completed", "cancelled"

    # İlişkiler
    driver = relationship("Driver", back_populates="reservations")
    charger = relationship("Charger", back_populates="reservations")  # back_populates düzeltildi
    payment = relationship("Payment", back_populates="reservation", uselist=False)
    charging_session = relationship("ChargingSession", back_populates="reservation", uselist=False)


class Payment(Base):
    __tablename__ = "payments"
    payment_id = Column(Integer, primary_key=True, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.driver_id", ondelete="CASCADE"), nullable=False)
    reservation_id = Column(Integer, ForeignKey("reservations.reservation_id", ondelete="SET NULL"), nullable=True)
    amount = Column(Float, nullable=False)
    type = Column(Enum(PaymentType), nullable=False)
    # default değer func.now() olarak düzeltildi (otomatik zaman damgası)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    driver = relationship("Driver", back_populates="payments")
    reservation = relationship("Reservation", back_populates="payment")


class IssueReport(Base):
    __tablename__ = "issue_reports"
    issue_id = Column(Integer, primary_key=True, index=True)

    charger_id = Column(Integer, ForeignKey("chargers.charger_id", ondelete="CASCADE"), nullable=False)
    description = Column(String, nullable=False)
    reported_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(Enum(ReportStatus), default=ReportStatus.open, nullable=False)

    charger = relationship("Charger", back_populates="reports")


class ChargingSession(Base):
    __tablename__ = "charging_sessions"
    charging_session_id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.reservation_id", ondelete="CASCADE"), unique=True, nullable=False)

    start_soc = Column(Float, nullable=False)
    end_soc = Column(Float, nullable=False)
    kwh_consumed = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    duration_min = Column(Integer, nullable=False)

    reservation = relationship("Reservation", back_populates="charging_session")