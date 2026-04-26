from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db
from routers.auth import get_current_user

router = APIRouter(prefix="/operators", tags=["Operators"])


def verify_operator_access(db: Session, user: models.User, station_id: int):
    """Operatörün bu istasyondan sorumlu olup olmadığını kontrol eder (REQ-005)"""
    if user.role != "operator":
        raise HTTPException(status_code=403, detail="Erişim reddedildi. Operatör rolü gerekli.")

    station = db.query(models.Station).filter(
        models.Station.station_id == station_id,
        models.Station.operator_id == user.user_id
    ).first()

    if not station:
        raise HTTPException(status_code=403, detail="Bu istasyonu yönetme yetkiniz yok.")
    return station


@router.get("/my-stations", response_model=List[schemas.StationResponse])
def get_my_stations(
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "operator":
        raise HTTPException(status_code=403, detail="Erişim reddedildi.")
    return db.query(models.Station).filter(models.Station.operator_id == current_user.user_id).all()


@router.put("/chargers/{charger_id}/status")
def update_charger_status(
        charger_id: int,
        status: schemas.ChargerStatus,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Cihaz bulunamadı.")

    # Yetki kontrolü
    verify_operator_access(db, current_user, charger.station_id)

    charger.status = status

    # Cihaz arızalıya (offline) çekiliyorsa etkilenen rezervasyonları iptal et (Use Case 4)
    if status == schemas.ChargerStatus.offline:
        active_reservations = db.query(models.Reservation).filter(
            models.Reservation.charger_id == charger_id,
            models.Reservation.status == "active"
        ).all()

        for res in active_reservations:
            res.status = "cancelled"
            # Burada normalde kullanıcıya mail atılır veya para iadesi yapılır.

    db.commit()
    return {"message": f"Cihaz durumu '{status}' olarak güncellendi."}