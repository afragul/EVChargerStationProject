from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
import models, schemas
from database import get_db
from routers.auth import get_current_user
from typing import List, Optional

try:
    from config import DEFAULT_PROVISION_AMOUNT
except ImportError:
    DEFAULT_PROVISION_AMOUNT = 100.0

router = APIRouter(prefix="/reservations", tags=["Reservations"])


@router.post("/", response_model=schemas.ReservationResponse)
def create_reservation(
        req: schemas.ReservationCreate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can make reservations.")

    now = datetime.now()
    start_datetime = datetime.combine(req.date, req.start_time)
    end_datetime = datetime.combine(req.date, req.end_time)

    if start_datetime < now:
        raise HTTPException(status_code=400, detail = "You cannot make reservations for a past date." )
    if end_datetime <= start_datetime:
        raise HTTPException(status_code=400, detail="The end time must be after the start time.")
    
    duration = end_datetime - start_datetime
    if duration > timedelta(hours=2):
        raise HTTPException(status_code=400, detail="You can reserve a device for a maximum of 2 hours (120 minutes) at a time.")
    
    
    driver = db.query(models.Driver).filter(models.Driver.driver_id == current_user.user_id).first()

    vehicle = db.query(models.Vehicle).filter(
        models.Vehicle.vehicle_id == req.vehicle_id,
        models.Vehicle.owner_id == driver.driver_id
    ).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="The vehicle was not found or it does not belong to you.")

    charger = db.query(models.Charger).filter(models.Charger.charger_id == req.charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found.")

    if charger.status.value == "offline":
        raise HTTPException(status_code=400, detail="The selected device is currently faulty/out of service.")

    if vehicle.connector_type != charger.connector_type:
        raise HTTPException(
            status_code=400,
            detail=f"Incompatible socket! Your vehicle supports {vehicle.connector_type}, but your device supports {charger.connector_type}."
        )

    overlapping_reservation = db.query(models.Reservation).filter(
        models.Reservation.charger_id == req.charger_id,
        models.Reservation.date == req.date,
        models.Reservation.status.in_(["active", "charging"]),
        req.start_time < models.Reservation.end_time,
        req.end_time > models.Reservation.start_time
    ).first()

    if overlapping_reservation:
        raise HTTPException(status_code=400,
                            detail="The selected date and time zone conflict with another reservation on this device.")

    existing_user_reservation = db.query(models.Reservation).filter(
        models.Reservation.driver_id == driver.driver_id,
        models.Reservation.date == req.date,
        models.Reservation.status == "active"
    ).first()

    if existing_user_reservation:
        raise HTTPException(status_code=400,
                            detail="You already have an active reservation for this date. You must complete or cancel it before making a new one.")

    if driver.wallet_balance < DEFAULT_PROVISION_AMOUNT:
        raise HTTPException(status_code=402,
                            detail=f"Insufficient balance. {DEFAULT_PROVISION_AMOUNT} TL is required for the reservation.")

    driver.wallet_balance -= DEFAULT_PROVISION_AMOUNT

    new_reservation = models.Reservation(
        driver_id=driver.driver_id,
        charger_id=req.charger_id,
        date=req.date,
        start_time=req.start_time,
        end_time=req.end_time,
        status="active"
    )

    db.add(new_reservation)
    db.commit()
    db.refresh(new_reservation)

    return new_reservation


@router.get("/me", response_model=List[schemas.ReservationResponse])
def get_my_reservations(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can see this area.")
    return db.query(models.Reservation).filter(models.Reservation.driver_id == current_user.user_id).all()


@router.get("/", response_model=List[schemas.ReservationResponse])
def get_all_reservations(charger_id: Optional[int] = None, db: Session = Depends(get_db),
                         current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Unauthorized access.")
    query = db.query(models.Reservation)
    if charger_id:
        query = query.filter(models.Reservation.charger_id == charger_id)
    return query.all()


@router.get("/{reservation_id}", response_model=schemas.ReservationResponse)
def get_reservation(reservation_id: int, db: Session = Depends(get_db),
                    current_user: models.User = Depends(get_current_user)):
    reservation = db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found.")
    return reservation


@router.delete("/{reservation_id}")
def delete_reservation(reservation_id: int, db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    reservation = db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found.")

    if reservation.driver_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only cancel your own reservations.")

    if reservation.status != "active":
        raise HTTPException(status_code=400, detail="Only reservations that are in the 'active' status can be deleted.")

    driver = db.query(models.Driver).filter(models.Driver.driver_id == current_user.user_id).first()
    if driver:
        driver.wallet_balance += DEFAULT_PROVISION_AMOUNT

    db.delete(reservation)
    db.commit()
    return {"message": "The reservation has been completely deleted from the database and a refund has been issued."}


@router.patch("/{reservation_id}/start")
def start_charging(reservation_id: int, db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    reservation = db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()
    if not reservation or reservation.driver_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="No valid reservation found.")

    if reservation.status != "active":
        raise HTTPException(status_code=400, detail="Only reservations that are in the 'active' status can be initiated.")

    now = datetime.now()
    today = now.date()
    current_time = now.time()

    if reservation.date != today:
        raise HTTPException(status_code=400, detail=f"Your reservation date is  ({reservation.date}) , not today!")

    if current_time < reservation.start_time:
        raise HTTPException(status_code=400,
                            detail=f"The reservation can be started at  {reservation.start_time.strftime('%H:%M')} o'clock.")

    if current_time > reservation.end_time:
        raise HTTPException(status_code=400,
                            detail="Reservation can be ended at.")

    reservation.status = "charging"
    reservation.actual_start_time = datetime.now()

    charger = db.query(models.Charger).filter(models.Charger.charger_id == reservation.charger_id).first()
    if charger:
        charger.status = "occupied"
    db.commit()
    return {"message": "Charging has begun! Power is being transferred..."}


@router.patch("/{reservation_id}/complete")
def complete_charging(reservation_id: int, db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_current_user)):
    reservation = db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()
    if not reservation or reservation.driver_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="No valid reservation was found.")

    if reservation.status != "charging":
        raise HTTPException(status_code=400, detail="Only operations in the 'charging' state can be completed.")

    driver = db.query(models.Driver).filter(models.Driver.driver_id == current_user.user_id).first()
    charger = db.query(models.Charger).filter(models.Charger.charger_id == reservation.charger_id).first()

    actual_start = getattr(reservation, "actual_start_time", None)

    # 🚀 1. DÜZELTME: Saniye ve Dakikayı doğru ayıralım
    if actual_start:
        time_diff = datetime.now() - actual_start
        duration_sec = max(1, int(time_diff.total_seconds()))
    else:
        duration_sec = 1

    duration_min = max(1, duration_sec // 60)  # Sadece veritabanına bilgi (log) olarak kaydetmek için dakika

    # 🚀 2. DÜZELTME: Faturayı hesaplarken saniyeyi 3600'e (1 saate) bölerek Frontend ile birebir aynı hesabı yapalım
    simulated_kwh = round((charger.power_kW * (duration_sec / 3600)) * 0.8, 4)
    price_per_kwh = charger.price_per_kWh if charger.price_per_kWh else 7.5
    total_cost = round(simulated_kwh * price_per_kwh, 2)

    potential_balance = driver.wallet_balance + DEFAULT_PROVISION_AMOUNT

    auto_stopped = False  # bakiyet kontrolu icin
    if potential_balance < total_cost:
        # Bakiyeyi sıfıra çekiyoruz (borca girmesin)
        total_cost = potential_balance
        auto_stopped = True

    # Önce provizyonu (100 TL) iade et, sonra tam faturayı kes
    driver.wallet_balance += DEFAULT_PROVISION_AMOUNT
    driver.wallet_balance -= total_cost

    new_payment = models.Payment(
        driver_id=driver.driver_id,
        reservation_id=reservation.reservation_id,
        amount=total_cost,
        type="Charge"
    )
    db.add(new_payment)

    new_session = models.ChargingSession(
        reservation_id=reservation.reservation_id,
        kwh_consumed=simulated_kwh,
        total_cost=total_cost,
        duration_min=duration_min
    )
    db.add(new_session)

    reservation.status = "completed"
    if charger:
        charger.status = "available"
        # 🚀 YENİ EKLENEN: Veritabanına Bildirim (Notification) Kaydetme
        notif_msg = f"✅ Charging session completed. Cost: {total_cost} TL, Energy: {simulated_kwh} kWh."
        if auto_stopped:
            notif_msg = f"⚠️ Charging auto-stopped due to low balance. Cost: {total_cost} TL."

        new_notif = models.Notification(
            user_id=current_user.user_id,
            message=notif_msg,
            created_at=datetime.utcnow()
        )
        db.add(new_notif)
    db.commit()

    return {
        "message": "Charging is completed.",
        "kwh": simulated_kwh,
        "cost": total_cost,
        "duration": duration_min,
        "auto_stopped": auto_stopped
    }

@router.get("/charger/{charger_id}/schedule")
def get_charger_schedule(charger_id: int, target_date: date, db: Session = Depends(get_db),
                         current_user: models.User = Depends(get_current_user)):
    reservations = db.query(models.Reservation).filter(
        models.Reservation.charger_id == charger_id,
        models.Reservation.date == target_date,
        models.Reservation.status.in_(["active", "charging"])
    ).all()
    return [{"start_time": res.start_time.strftime("%H:%M"), "end_time": res.end_time.strftime("%H:%M")} for res in
            reservations]