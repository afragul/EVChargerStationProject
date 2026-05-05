from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import models, schemas
from database import get_db
from routers.auth import get_current_user

router = APIRouter(prefix="/charging-sessions", tags=["Charging Sessions"])


@router.post("/start", response_model=schemas.ChargingSessionResponse)
def start_charging(
        reservation_id: int,
        start_soc: float,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can initiate charging.")

    reservation = db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()
    if not reservation or reservation.driver_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="No valid reservation was found.")

    if reservation.status != "active":
        raise HTTPException(status_code=400, detail="This reservation is inactive.")

    # Oturum oluştur
    new_session = models.ChargingSession(
        reservation_id=reservation_id,
        start_soc=start_soc,
        end_soc=0.0,
        kwh_consumed=0.0,
        total_cost=0.0,
        duration_min=0
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session


@router.post("/{session_id}/stop", response_model=schemas.ChargingSessionResponse)
def stop_charging(
        session_id: int,
        end_soc: float,
        kwh_consumed: float,
        duration_min: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    session = db.query(models.ChargingSession).filter(models.ChargingSession.charging_session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Charging session not found.")

    reservation = db.query(models.Reservation).filter(
        models.Reservation.reservation_id == session.reservation_id).first()
    charger = db.query(models.Charger).filter(models.Charger.charger_id == reservation.charger_id).first()
    driver = db.query(models.Driver).filter(models.Driver.driver_id == reservation.driver_id).first()

    # Maliyet hesapla (Tüketim * Birim Fiyat)
    total_cost = kwh_consumed * charger.price_per_kWh

    if driver.wallet_balance < total_cost:
        # Gerçek bir sistemde bakiye eksiye düşebilir veya işlem askıya alınır. Biz eksiye düşürüyoruz.
        pass

        # 1. Oturumu güncelle
    session.end_soc = end_soc
    session.kwh_consumed = kwh_consumed
    session.duration_min = duration_min
    session.total_cost = total_cost

    # 2. Cüzdandan parayı kes
    driver.wallet_balance -= total_cost

    # 3. Ödeme kaydı (Dijital Fiş) oluştur
    payment = models.Payment(
        driver_id=driver.driver_id,
        reservation_id=reservation.reservation_id,
        amount=total_cost,
        type=models.PaymentType.charge,
        timestamp=datetime.utcnow()
    )
    db.add(payment)

    # 4. Rezervasyonu tamamlandı olarak işaretle
    reservation.status = "completed"

    db.commit()
    db.refresh(session)
    return session