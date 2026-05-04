from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date
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
        raise HTTPException(status_code=403, detail="Sadece sürücüler rezervasyon yapabilir.")

    driver = db.query(models.Driver).filter(models.Driver.driver_id == current_user.user_id).first()

    vehicle = db.query(models.Vehicle).filter(
        models.Vehicle.vehicle_id == req.vehicle_id,
        models.Vehicle.owner_id == driver.driver_id
    ).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Araç bulunamadı veya size ait değil")

    charger = db.query(models.Charger).filter(models.Charger.charger_id == req.charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Şarj cihazı bulunamadı.")

    if charger.status.value == "offline":
        raise HTTPException(status_code=400, detail="Seçili cihaz şu anda arızalı / hizmet dışıdır.")

    if vehicle.connector_type != charger.connector_type:
        raise HTTPException(
            status_code=400,
            detail=f"Uyumsuz Soket! Aracınız {vehicle.connector_type}, ancak cihaz {charger.connector_type} destekliyor."
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
                            detail="Seçilen tarih ve saat dilimi, bu cihazdaki başka bir rezervasyon ile çakışıyor.")

    existing_user_reservation = db.query(models.Reservation).filter(
        models.Reservation.driver_id == driver.driver_id,
        models.Reservation.date == req.date,
        models.Reservation.status == "active"
    ).first()

    if existing_user_reservation:
        raise HTTPException(status_code=400,
                            detail="Bu tarih için zaten aktif bir rezervasyonunuz var. Yenisini yapmadan önce onu tamamlamalı veya iptal etmelisiniz.")

    if driver.wallet_balance < DEFAULT_PROVISION_AMOUNT:
        raise HTTPException(status_code=402,
                            detail=f"Yetersiz bakiye. Rezervasyon için {DEFAULT_PROVISION_AMOUNT} TL gereklidir.")

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
        raise HTTPException(status_code=403, detail="Sadece sürücüler bu alanı görebilir.")
    return db.query(models.Reservation).filter(models.Reservation.driver_id == current_user.user_id).all()


@router.get("/", response_model=List[schemas.ReservationResponse])
def get_all_reservations(charger_id: Optional[int] = None, db: Session = Depends(get_db),
                         current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Yetkisiz erişim.")
    query = db.query(models.Reservation)
    if charger_id:
        query = query.filter(models.Reservation.charger_id == charger_id)
    return query.all()


@router.get("/{reservation_id}", response_model=schemas.ReservationResponse)
def get_reservation(reservation_id: int, db: Session = Depends(get_db),
                    current_user: models.User = Depends(get_current_user)):
    reservation = db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Rezervasyon bulunamadı.")
    return reservation


@router.delete("/{reservation_id}")
def delete_reservation(reservation_id: int, db: Session = Depends(get_db),
                       current_user: models.User = Depends(get_current_user)):
    reservation = db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Rezervasyon bulunamadı.")

    if reservation.driver_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Sadece kendi rezervasyonlarınızı iptal edebilirsiniz.")

    if reservation.status != "active":
        raise HTTPException(status_code=400, detail="Sadece 'active' durumdaki rezervasyonlar silinebilir.")

    driver = db.query(models.Driver).filter(models.Driver.driver_id == current_user.user_id).first()
    if driver:
        driver.wallet_balance += DEFAULT_PROVISION_AMOUNT

    db.delete(reservation)
    db.commit()
    return {"message": "Rezervasyon veritabanından tamamen silindi ve ücret iade edildi."}


@router.patch("/{reservation_id}/start")
def start_charging(reservation_id: int, db: Session = Depends(get_db),
                   current_user: models.User = Depends(get_current_user)):
    reservation = db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()
    if not reservation or reservation.driver_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="Geçerli bir rezervasyon bulunamadı.")

    if reservation.status != "active":
        raise HTTPException(status_code=400, detail="Sadece 'active' durumdaki rezervasyonlar başlatılabilir.")

    reservation.status = "charging"
    # YENİ: Şarjın başlatıldığı tam zamanı kaydediyoruz
    reservation.actual_start_time = datetime.now()

    charger = db.query(models.Charger).filter(models.Charger.charger_id == reservation.charger_id).first()
    if charger:
        charger.status = "occupied"
    db.commit()
    return {"message": "Şarj işlemi başladı! Enerji aktarılıyor..."}


@router.patch("/{reservation_id}/complete")
def complete_charging(reservation_id: int, db: Session = Depends(get_db),
                      current_user: models.User = Depends(get_current_user)):
    reservation = db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()
    if not reservation or reservation.driver_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="Geçerli bir rezervasyon bulunamadı.")

    if reservation.status != "charging":
        raise HTTPException(status_code=400, detail="Sadece 'charging' durumundaki işlemler tamamlanabilir.")

    driver = db.query(models.Driver).filter(models.Driver.driver_id == current_user.user_id).first()
    charger = db.query(models.Charger).filter(models.Charger.charger_id == reservation.charger_id).first()

    # YENİ SİMÜLASYON: Gerçek saniyeyi dakikaymış gibi hesaplama
    if reservation.actual_start_time:
        time_difference = datetime.now() - reservation.actual_start_time
        actual_seconds = time_difference.total_seconds()
        simulated_duration_min = max(1, int(actual_seconds))  # 1 saniye = 1 dakika olarak kabul ediyoruz
    else:
        simulated_duration_min = 1

    simulated_kwh = round((charger.power_kW * (simulated_duration_min / 60)) * 0.8, 2)
    price_per_kwh = charger.price_per_kWh if charger.price_per_kWh else 7.5
    total_cost = round(simulated_kwh * price_per_kwh, 2)

    # Önce provizyonu iade et, sonra faturayı kes
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
        duration_min=simulated_duration_min
    )
    db.add(new_session)

    reservation.status = "completed"
    if charger:
        charger.status = "available"

    db.commit()

    return {
        "message": "Şarj tamamlandı.",
        "kwh": simulated_kwh,
        "cost": total_cost,
        "duration": simulated_duration_min
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