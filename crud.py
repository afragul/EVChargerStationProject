from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import date, time
from passlib.context import CryptContext

import models
import schemas

# Şifreleme bağlamı
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """Verilen düz şifreyi bcrypt ile hashler."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Düz şifre ile hashlenmiş şifreyi karşılaştırır."""
    return pwd_context.verify(plain_password, hashed_password)


# ============================================
# 1. USER İŞLEMLERİ
# ============================================

def get_user_by_email(db: Session, email: str) -> models.User | None:
    return db.query(models.User).filter(models.User.email == email).first()


def get_user_by_id(db: Session, user_id: int) -> models.User | None:
    return db.query(models.User).filter(models.User.user_id == user_id).first()


def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    # Aynı email ile kayıtlı kullanıcı var mı kontrol et
    existing = get_user_by_email(db, user.email)
    if existing:
        raise ValueError("Email already registered")

    hashed_pwd = get_password_hash(user.password)
    db_user = models.User(
        name=user.name,
        email=user.email,
        phone=user.phone,
        role=user.role,  # Enum doğrudan atanabilir
        hashed_password=hashed_pwd
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user_id: int, updates: schemas.UserUpdate) -> models.User | None:
    user = get_user_by_id(db, user_id)
    if not user:
        return None
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> models.User | None:
    """Kullanıcı girişi için doğrulama yapar."""
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


# ============================================
# 2. DRIVER İŞLEMLERİ
# ============================================

def get_driver_by_id(db: Session, driver_id: int) -> models.Driver | None:
    return db.query(models.Driver).filter(models.Driver.driver_id == driver_id).first()


def create_driver(db: Session, driver: schemas.DriverCreate) -> models.Driver:
    # Kullanıcı var mı ve rolü driver mı kontrol et
    user = get_user_by_id(db, driver.user_id)
    if not user:
        raise ValueError("User not found")
    if user.role != models.UserRole.driver:
        raise ValueError("User role is not 'driver'")

    # Zaten driver profili var mı?
    existing = get_driver_by_id(db, driver.user_id)
    if existing:
        raise ValueError("Driver profile already exists for this user")

    db_driver = models.Driver(
        driver_id=driver.user_id,
        wallet_balance=driver.wallet_balance
    )
    db.add(db_driver)
    db.commit()
    db.refresh(db_driver)
    return db_driver


def update_wallet_balance(db: Session, driver_id: int, amount: float) -> models.Driver | None:
    """Bakiye güncelleme (top-up için)."""
    driver = db.query(models.Driver).filter(
        models.Driver.driver_id == driver_id
    ).with_for_update().first()
    if not driver:
        return None
    driver.wallet_balance += amount
    db.commit()
    db.refresh(driver)
    return driver


# ============================================
# 3. OPERATOR & ADMIN İŞLEMLERİ
# ============================================

def create_operator(db: Session, operator: schemas.OperatorCreate) -> models.Operator:
    user = get_user_by_id(db, operator.user_id)
    if not user:
        raise ValueError("User not found")
    if user.role != models.UserRole.operator:
        raise ValueError("User role is not 'operator'")

    existing = db.query(models.Operator).filter(
        models.Operator.operator_id == operator.user_id
    ).first()
    if existing:
        raise ValueError("Operator profile already exists")

    db_operator = models.Operator(operator_id=operator.user_id)
    db.add(db_operator)
    db.commit()
    db.refresh(db_operator)
    return db_operator


def create_admin(db: Session, admin: schemas.AdminCreate) -> models.Admin:
    user = get_user_by_id(db, admin.user_id)
    if not user:
        raise ValueError("User not found")
    if user.role != models.UserRole.admin:
        raise ValueError("User role is not 'admin'")

    existing = db.query(models.Admin).filter(
        models.Admin.admin_id == admin.user_id
    ).first()
    if existing:
        raise ValueError("Admin profile already exists")

    db_admin = models.Admin(admin_id=admin.user_id)
    db.add(db_admin)
    db.commit()
    db.refresh(db_admin)
    return db_admin


# ============================================
# 4. VEHICLE İŞLEMLERİ
# ============================================

def get_vehicle_by_plate(db: Session, plate_number: str) -> models.Vehicle | None:
    return db.query(models.Vehicle).filter(models.Vehicle.plate_number == plate_number).first()


def create_vehicle(db: Session, vehicle: schemas.VehicleCreate) -> models.Vehicle:
    # Plaka benzersiz olmalı
    existing = get_vehicle_by_plate(db, vehicle.plate_number)
    if existing:
        raise ValueError("Plate number already registered")

    # Sahip driver var mı kontrol et
    driver = get_driver_by_id(db, vehicle.owner_id)
    if not driver:
        raise ValueError("Owner driver not found")

    db_vehicle = models.Vehicle(
        owner_id=vehicle.owner_id,
        brand=vehicle.brand,
        model=vehicle.model,
        battery_kWh=vehicle.battery_kWh,
        connector_type=vehicle.connector_type,
        plate_number=vehicle.plate_number
    )
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle


def get_vehicles_by_owner(db: Session, owner_id: int) -> list[models.Vehicle]:
    return db.query(models.Vehicle).filter(models.Vehicle.owner_id == owner_id).all()


def update_vehicle(db: Session, vehicle_id: int, updates: schemas.VehicleUpdate) -> models.Vehicle | None:
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.vehicle_id == vehicle_id).first()
    if not vehicle:
        return None
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(vehicle, field, value)
    db.commit()
    db.refresh(vehicle)
    return vehicle


# ============================================
# 5. STATION & CHARGER İŞLEMLERİ
# ============================================

def get_all_stations(db: Session) -> list[models.Station]:
    return db.query(models.Station).all()


def get_station_by_id(db: Session, station_id: int) -> models.Station | None:
    return db.query(models.Station).filter(models.Station.station_id == station_id).first()


def create_station(db: Session, station: schemas.StationCreate) -> models.Station:
    # Operator belirtilmişse varlığını kontrol et
    if station.operator_id:
        operator = db.query(models.Operator).filter(
            models.Operator.operator_id == station.operator_id
        ).first()
        if not operator:
            raise ValueError("Operator not found")

    db_station = models.Station(
        name=station.name,
        address=station.address,
        latitude=station.latitude,
        longitude=station.longitude,
        operating_hours=station.operating_hours,
        operator_id=station.operator_id
    )
    db.add(db_station)
    db.commit()
    db.refresh(db_station)
    return db_station


def update_station(db: Session, station_id: int, updates: schemas.StationUpdate) -> models.Station | None:
    station = get_station_by_id(db, station_id)
    if not station:
        return None
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(station, field, value)
    db.commit()
    db.refresh(station)
    return station


def get_chargers_by_station(db: Session, station_id: int) -> list[models.Charger]:
    return db.query(models.Charger).filter(models.Charger.station_id == station_id).all()


def get_charger_by_id(db: Session, charger_id: int) -> models.Charger | None:
    return db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()


def create_charger(db: Session, charger: schemas.ChargerCreate) -> models.Charger:
    # İstasyon var mı kontrol et
    station = get_station_by_id(db, charger.station_id)
    if not station:
        raise ValueError("Station not found")

    db_charger = models.Charger(
        station_id=charger.station_id,
        type=charger.type,
        power_kW=charger.power_kW,
        connector_type=charger.connector_type,
        price_per_kWh=charger.price_per_kWh,
        status=charger.status
    )
    db.add(db_charger)
    db.commit()
    db.refresh(db_charger)
    return db_charger


def update_charger(db: Session, charger_id: int, updates: schemas.ChargerUpdate) -> models.Charger | None:
    charger = get_charger_by_id(db, charger_id)
    if not charger:
        return None
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(charger, field, value)
    db.commit()
    db.refresh(charger)
    return charger


def get_available_chargers(db: Session, station_id: int | None = None) -> list[models.Charger]:
    """Belirli bir istasyondaki (veya tüm) müsait şarj cihazlarını döndürür."""
    query = db.query(models.Charger).filter(models.Charger.status == models.ChargerStatus.available)
    if station_id:
        query = query.filter(models.Charger.station_id == station_id)
    return query.all()


# ============================================
# 6. RESERVATION İŞLEMLERİ
# ============================================

def check_reservation_conflict(
    db: Session,
    charger_id: int,
    res_date: date,
    start_time: time,
    end_time: time,
    exclude_reservation_id: int | None = None
) -> models.Reservation | None:
    """
    Belirtilen tarih ve saat aralığında çakışan aktif rezervasyon var mı kontrol eder.
    exclude_reservation_id verilirse o rezervasyonu kontrol dışı bırakır (güncelleme için).
    """
    query = db.query(models.Reservation).filter(
        models.Reservation.charger_id == charger_id,
        models.Reservation.date == res_date,
        models.Reservation.status == "active",
        and_(
            models.Reservation.start_time < end_time,
            models.Reservation.end_time > start_time
        )
    )
    if exclude_reservation_id:
        query = query.filter(models.Reservation.reservation_id != exclude_reservation_id)
    return query.first()


def create_reservation(db: Session, reservation: schemas.ReservationCreate) -> models.Reservation:
    # Sürücü ve cihaz varlığını kontrol et
    driver = get_driver_by_id(db, reservation.driver_id)
    if not driver:
        raise ValueError("Driver not found")

    charger = get_charger_by_id(db, reservation.charger_id)
    if not charger:
        raise ValueError("Charger not found")

    # Cihaz müsait mi? (opsiyonel, çakışma kontrolü zaten yapılıyor)
    if charger.status != models.ChargerStatus.available:
        raise ValueError("Charger is not available")

    # Çakışan rezervasyon var mı?
    conflict = check_reservation_conflict(
        db,
        charger_id=reservation.charger_id,
        res_date=reservation.date,
        start_time=reservation.start_time,
        end_time=reservation.end_time
    )
    if conflict:
        raise ValueError("Time slot is already reserved")

    # Bitiş saati başlangıçtan büyük olmalı
    if reservation.end_time <= reservation.start_time:
        raise ValueError("End time must be after start time")

    db_reservation = models.Reservation(
        driver_id=reservation.driver_id,
        charger_id=reservation.charger_id,
        date=reservation.date,
        start_time=reservation.start_time,
        end_time=reservation.end_time,
        status="active"
    )
    db.add(db_reservation)

    # Opsiyonel: Cihaz durumunu güncelle (isteğe bağlı)
    # charger.status = models.ChargerStatus.occupied
    # db.add(charger)

    db.commit()
    db.refresh(db_reservation)
    return db_reservation


def get_reservations_by_driver(db: Session, driver_id: int) -> list[models.Reservation]:
    return db.query(models.Reservation).filter(models.Reservation.driver_id == driver_id).all()


def get_reservation_by_id(db: Session, reservation_id: int) -> models.Reservation | None:
    return db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()


def update_reservation_status(
    db: Session,
    reservation_id: int,
    new_status: schemas.ReservationStatus
) -> models.Reservation | None:
    reservation = get_reservation_by_id(db, reservation_id)
    if not reservation:
        return None
    reservation.status = new_status.value
    db.commit()
    db.refresh(reservation)
    return reservation


def cancel_reservation(db: Session, reservation_id: int) -> models.Reservation | None:
    """Rezervasyonu iptal eder (soft delete)."""
    return update_reservation_status(db, reservation_id, schemas.ReservationStatus.cancelled)


# ============================================
# 7. CHARGING SESSION İŞLEMLERİ
# ============================================

def create_charging_session(db: Session, session: schemas.ChargingSessionCreate) -> models.ChargingSession:
    # Rezervasyon var mı?
    reservation = get_reservation_by_id(db, session.reservation_id)
    if not reservation:
        raise ValueError("Reservation not found")

    # Bu rezervasyona ait zaten bir oturum var mı?
    existing = db.query(models.ChargingSession).filter(
        models.ChargingSession.reservation_id == session.reservation_id
    ).first()
    if existing:
        raise ValueError("Charging session already exists for this reservation")

    db_session = models.ChargingSession(
        reservation_id=session.reservation_id,
        start_soc=session.start_soc,
        end_soc=session.end_soc,
        kwh_consumed=session.kwh_consumed,
        total_cost=session.total_cost,
        duration_min=session.duration_min
    )
    db.add(db_session)

    # Rezervasyon durumunu tamamlandı olarak işaretle
    reservation.status = "completed"

    db.commit()
    db.refresh(db_session)
    return db_session


def get_charging_session_by_reservation(db: Session, reservation_id: int) -> models.ChargingSession | None:
    return db.query(models.ChargingSession).filter(
        models.ChargingSession.reservation_id == reservation_id
    ).first()


# ============================================
# 8. PAYMENT İŞLEMLERİ (Düzeltilmiş)
# ============================================

def create_payment(db: Session, payment: schemas.PaymentCreate) -> models.Payment:
    # Sürücü var mı?
    driver = db.query(models.Driver).filter(
        models.Driver.driver_id == payment.driver_id
    ).with_for_update().first()  # Race condition önlemi
    if not driver:
        raise ValueError("Driver not found")

    # Rezervasyon varsa kontrol et
    if payment.reservation_id:
        reservation = get_reservation_by_id(db, payment.reservation_id)
        if not reservation:
            raise ValueError("Reservation not found")
        # Ödeme tipi charge ise rezervasyon bu sürücüye ait olmalı
        if payment.type == schemas.PaymentType.charge and reservation.driver_id != payment.driver_id:
            raise ValueError("Reservation does not belong to this driver")

    # Bakiye işlemleri
    if payment.type == schemas.PaymentType.charge:
        if driver.wallet_balance < payment.amount:
            raise ValueError("Insufficient wallet balance")
        driver.wallet_balance -= payment.amount
    elif payment.type == schemas.PaymentType.topup:
        driver.wallet_balance += payment.amount
    elif payment.type == schemas.PaymentType.refund:
        driver.wallet_balance += payment.amount
    else:
        raise ValueError("Invalid payment type")

    db_payment = models.Payment(
        driver_id=payment.driver_id,
        reservation_id=payment.reservation_id,
        amount=payment.amount,
        type=payment.type
    )
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment


def get_payments_by_driver(db: Session, driver_id: int) -> list[models.Payment]:
    return db.query(models.Payment).filter(models.Payment.driver_id == driver_id).all()


# ============================================
# 9. ISSUE REPORT İŞLEMLERİ
# ============================================

def create_issue_report(db: Session, report: schemas.IssueReportCreate) -> models.IssueReport:
    charger = get_charger_by_id(db, report.charger_id)
    if not charger:
        raise ValueError("Charger not found")

    db_report = models.IssueReport(
        charger_id=report.charger_id,
        description=report.description,
        status=models.ReportStatus.open
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def get_reports_by_charger(db: Session, charger_id: int) -> list[models.IssueReport]:
    return db.query(models.IssueReport).filter(models.IssueReport.charger_id == charger_id).all()


def update_issue_report(
    db: Session,
    report_id: int,
    updates: schemas.IssueReportUpdate
) -> models.IssueReport | None:
    report = db.query(models.IssueReport).filter(models.IssueReport.issue_id == report_id).first()
    if not report:
        return None
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(report, field, value)
    db.commit()
    db.refresh(report)
    return report