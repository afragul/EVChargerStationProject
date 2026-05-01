from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from datetime import datetime, date, time, timedelta
from typing import Optional, List
import bcrypt

from passlib.context import CryptContext

import models
import schemas


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ---------- USER ----------
#Getting User id
def get_user(db: Session, user_id: int) -> models.User | None:
    return db.query(models.User).filter(models.User.user_id == user_id).first()

#Getting user email
def get_user_by_email(db: Session, email: str) -> models.User | None:
    return db.query(models.User).filter(models.User.email == email).first()

#Creating user
def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    hashed_pw = hash_password(user.password)
    db_user = models.User(
        name=user.name,
        email=user.email,
        phone=user.phone,
        hashed_password=hashed_pw,
        role=user.role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate) -> models.User | None:
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    update_data = user_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int) -> bool:
    db_user = get_user(db, user_id)
    if not db_user:
        return False
    db.delete(db_user)
    db.commit()
    return True

def authenticate_user(db: Session, email: str, password: str) -> models.User | None:
    user = get_user_by_email(db, email)
    if not user:
        return None
    if verify_password(password, user.hashed_password):
        return user
    return None


# ---------- DRIVER ----------
def get_driver(db: Session, driver_id: int) -> models.Driver | None:
    return db.query(models.Driver).filter(models.Driver.driver_id == driver_id).first()

def get_driver_by_user_id(db: Session, user_id: int) -> models.Driver | None:
    return db.query(models.Driver).filter(models.Driver.driver_id == user_id).first()

def create_driver(db: Session, driver: schemas.DriverCreate) -> models.Driver:
    db_driver = models.Driver(
        driver_id=driver.user_id,
        wallet_balance=driver.wallet_balance
    )
    db.add(db_driver)
    db.commit()
    db.refresh(db_driver)
    return db_driver

def update_wallet(db: Session, driver_id: int, amount_delta: float) -> models.Driver | None:
    driver = get_driver(db, driver_id)
    if not driver:
        return None
    driver.wallet_balance += amount_delta
    db.commit()
    db.refresh(driver)
    return driver


# ---------- OPERATOR ----------
def get_operator(db: Session, operator_id: int) -> models.Operator | None:
    return db.query(models.Operator).filter(models.Operator.operator_id == operator_id).first()

def create_operator(db: Session, user_id: int) -> models.Operator:
    db_operator = models.Operator(operator_id=user_id)
    db.add(db_operator)
    db.commit()
    db.refresh(db_operator)
    return db_operator


# ---------- ADMIN ----------
def get_admin(db: Session, admin_id: int) -> models.Admin | None:
    return db.query(models.Admin).filter(models.Admin.admin_id == admin_id).first()

def create_admin(db: Session, user_id: int) -> models.Admin:
    db_admin = models.Admin(admin_id=user_id)
    db.add(db_admin)
    db.commit()
    db.refresh(db_admin)
    return db_admin


# ---------- VEHICLE ----------
def get_vehicle(db: Session, vehicle_id: int) -> models.Vehicle | None:
    return db.query(models.Vehicle).filter(models.Vehicle.vehicle_id == vehicle_id).first()

def get_vehicles_by_driver(db: Session, driver_id: int) -> List[models.Vehicle]:
    return db.query(models.Vehicle).filter(models.Vehicle.owner_id == driver_id).all()

def create_vehicle(db: Session, vehicle: schemas.VehicleCreate) -> models.Vehicle:
    db_vehicle = models.Vehicle(**vehicle.dict())
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle

def update_vehicle(db: Session, vehicle_id: int, vehicle_update: schemas.VehicleUpdate) -> models.Vehicle | None:
    db_vehicle = get_vehicle(db, vehicle_id)
    if not db_vehicle:
        return None
    update_data = vehicle_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_vehicle, key, value)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle

def delete_vehicle(db: Session, vehicle_id: int) -> bool:
    db_vehicle = get_vehicle(db, vehicle_id)
    if not db_vehicle:
        return False
    db.delete(db_vehicle)
    db.commit()
    return True


# ---------- STATION ----------
def get_station(db: Session, station_id: int) -> models.Station | None:
    return db.query(models.Station).filter(models.Station.station_id == station_id).first()

def get_all_stations(db: Session, skip: int = 0, limit: int = 100) -> List[models.Station]:
    return db.query(models.Station).offset(skip).limit(limit).all()

def get_stations_by_operator(db: Session, operator_id: int) -> List[models.Station]:
    return db.query(models.Station).filter(models.Station.operator_id == operator_id).all()

def create_station(db: Session, station: schemas.StationCreate) -> models.Station:
    db_station = models.Station(**station.dict())
    db.add(db_station)
    db.commit()
    db.refresh(db_station)
    return db_station

def update_station(db: Session, station_id: int, station_update: schemas.StationUpdate) -> models.Station | None:
    db_station = get_station(db, station_id)
    if not db_station:
        return None
    update_data = station_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_station, key, value)
    db.commit()
    db.refresh(db_station)
    return db_station

def delete_station(db: Session, station_id: int) -> bool:
    db_station = get_station(db, station_id)
    if not db_station:
        return False
    db.delete(db_station)
    db.commit()
    return True


# ---------- CHARGER ----------
def get_charger(db: Session, charger_id: int) -> models.Charger | None:
    return db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()

def get_chargers_by_station(db: Session, station_id: int) -> List[models.Charger]:
    return db.query(models.Charger).filter(models.Charger.station_id == station_id).all()

def get_available_chargers(db: Session, station_id: int = None) -> List[models.Charger]:
    query = db.query(models.Charger).filter(models.Charger.status == models.ChargerStatus.available)
    if station_id:
        query = query.filter(models.Charger.station_id == station_id)
    return query.all()

def create_charger(db: Session, charger: schemas.ChargerCreate) -> models.Charger:
    db_charger = models.Charger(**charger.dict())
    db.add(db_charger)
    db.commit()
    db.refresh(db_charger)
    return db_charger

def update_charger(db: Session, charger_id: int, charger_update: schemas.ChargerUpdate) -> models.Charger | None:
    db_charger = get_charger(db, charger_id)
    if not db_charger:
        return None
    update_data = charger_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_charger, key, value)
    db.commit()
    db.refresh(db_charger)
    return db_charger

def delete_charger(db: Session, charger_id: int) -> bool:
    db_charger = get_charger(db, charger_id)
    if not db_charger:
        return False
    db.delete(db_charger)
    db.commit()
    return True


# ---------- RESERVATION ----------
def get_reservation(db: Session, reservation_id: int) -> models.Reservation | None:
    return db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()

def get_reservations_by_driver(db: Session, driver_id: int) -> List[models.Reservation]:
    return db.query(models.Reservation).filter(models.Reservation.driver_id == driver_id).all()

def get_reservations_by_charger(db: Session, charger_id: int) -> List[models.Reservation]:
    return db.query(models.Reservation).filter(models.Reservation.charger_id == charger_id).all()

def get_active_reservations_by_charger(db: Session, charger_id: int, current_time: datetime) -> List[models.Reservation]:
    current_date = current_time.date()
    current_time_only = current_time.time()
    return db.query(models.Reservation).filter(
        models.Reservation.charger_id == charger_id,
        models.Reservation.status == "active",
        or_(
            models.Reservation.date > current_date,
            and_(models.Reservation.date == current_date, models.Reservation.end_time > current_time_only)
        )
    ).all()

def is_charger_available(db: Session, charger_id: int, reservation_date: date, start_time: time, end_time: time) -> bool:
    conflict = db.query(models.Reservation).filter(
        models.Reservation.charger_id == charger_id,
        models.Reservation.status == "active",
        models.Reservation.date == reservation_date,
        or_(
            and_(models.Reservation.start_time < end_time, models.Reservation.end_time > start_time)
        )
    ).first()
    return conflict is None


def create_reservation(db: Session, reservation: schemas.ReservationCreate, driver_id: int) -> models.Reservation:
    res_data = reservation.dict()
    res_data.pop("vehicle_id", None)
    db_reservation = models.Reservation(**res_data, driver_id=driver_id, status="active")
    db.add(db_reservation)
    db.commit()
    db.refresh(db_reservation)
    return db_reservation

def update_reservation(db: Session, reservation_id: int, reservation_update: schemas.ReservationUpdate) -> models.Reservation | None:
    db_reservation = get_reservation(db, reservation_id)
    if not db_reservation:
        return None
    update_data = reservation_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_reservation, key, value)
    db.commit()
    db.refresh(db_reservation)
    return db_reservation

def cancel_reservation(db: Session, reservation_id: int) -> models.Reservation | None:
    return update_reservation(db, reservation_id, schemas.ReservationUpdate(status="cancelled"))

def complete_reservation(db: Session, reservation_id: int) -> models.Reservation | None:
    return update_reservation(db, reservation_id, schemas.ReservationUpdate(status="completed"))


# ---------- PAYMENT ----------
def get_payment(db: Session, payment_id: int) -> models.Payment | None:
    return db.query(models.Payment).filter(models.Payment.payment_id == payment_id).first()

def get_payments_by_driver(db: Session, driver_id: int) -> List[models.Payment]:
    return db.query(models.Payment).filter(models.Payment.driver_id == driver_id).all()

def create_payment(db: Session, payment: schemas.PaymentCreate) -> models.Payment:
    db_payment = models.Payment(**payment.dict(), timestamp=datetime.utcnow())
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment


# ---------- CHARGING SESSION ----------
def get_charging_session(db: Session, session_id: int) -> models.ChargingSession | None:
    return db.query(models.ChargingSession).filter(models.ChargingSession.charging_session_id == session_id).first()

def get_charging_session_by_reservation(db: Session, reservation_id: int) -> models.ChargingSession | None:
    return db.query(models.ChargingSession).filter(models.ChargingSession.reservation_id == reservation_id).first()

def create_charging_session(db: Session, session_data: schemas.ChargingSessionCreate) -> models.ChargingSession:
    db_session = models.ChargingSession(**session_data.dict())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


# ---------- ISSUE REPORT ----------
def get_issue_report(db: Session, issue_id: int) -> models.IssueReport | None:
    return db.query(models.IssueReport).filter(models.IssueReport.issue_id == issue_id).first()

def get_reports_by_charger(db: Session, charger_id: int) -> List[models.IssueReport]:
    return db.query(models.IssueReport).filter(models.IssueReport.charger_id == charger_id).all()

def get_open_reports(db: Session) -> List[models.IssueReport]:
    return db.query(models.IssueReport).filter(models.IssueReport.status == models.ReportStatus.open).all()

def create_issue_report(db: Session, report: schemas.IssueReportCreate) -> models.IssueReport:
    db_report = models.IssueReport(**report.dict(), status=models.ReportStatus.open, reported_at=datetime.utcnow())
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report

def update_issue_report(db: Session, issue_id: int, report_update: schemas.IssueReportUpdate) -> models.IssueReport | None:
    db_report = get_issue_report(db, issue_id)
    if not db_report:
        return None
    update_data = report_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_report, key, value)
    db.commit()
    db.refresh(db_report)
    return db_report

