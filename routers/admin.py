from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db
from routers.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["Admin"])


def require_admin(user: models.User):
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Erişim reddedildi. Admin yetkisi gerekli.")


@router.post("/stations", response_model=schemas.StationResponse)
def add_station(
        station_in: schemas.StationCreate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    require_admin(current_user)

    new_station = models.Station(**station_in.dict())
    db.add(new_station)
    db.commit()
    db.refresh(new_station)
    return new_station


@router.put("/stations/{station_id}/assign-operator")
def assign_operator(
        station_id: int,
        operator_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    require_admin(current_user)

    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="İstasyon bulunamadı.")

    operator = db.query(models.Operator).filter(models.Operator.operator_id == operator_id).first()
    if not operator:
        raise HTTPException(status_code=404, detail="Operatör bulunamadı.")

    station.operator_id = operator_id
    db.commit()
    return {"message": "Operatör başarıyla istasyona atandı."}


@router.put("/chargers/{charger_id}/price")
def set_charger_price(
        charger_id: int,
        price_per_kwh: float,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    require_admin(current_user)

    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Cihaz bulunamadı.")

    charger.price_per_kWh = price_per_kwh
    db.commit()
    return {"message": f"Cihazın yeni kWh fiyatı {price_per_kwh} TL olarak güncellendi."}


#opearot listele
@router.get("/operators")
def get_all_operators(
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    require_admin(current_user)

    # Operator tablosu ile User tablosunu eşleştirip (join) isimleri ve email'leri alıyoruz
    operators = db.query(models.Operator, models.User).join(
        models.User, models.Operator.operator_id == models.User.user_id
    ).all()

    result = []
    for op, user in operators:
        result.append({
            "operator_id": op.operator_id,
            "name": user.name,
            "email": user.email
        })
    return result



#operator onaylama
@router.get("/operators/pending")
def get_pending_operators(
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    require_admin(current_user)

    # Onay bekleyen (is_approved == False) operatörleri listele
    pending_ops = db.query(models.Operator, models.User).join(
        models.User, models.Operator.operator_id == models.User.user_id
    ).filter(models.Operator.is_approved == False).all()

    return [{"operator_id": op.operator_id, "name": user.name, "email": user.email} for op, user in pending_ops]


@router.patch("/operators/{operator_id}/approve")
def approve_operator(
        operator_id: int,
        station_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    require_admin(current_user)

    operator = db.query(models.Operator).filter(models.Operator.operator_id == operator_id).first()
    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()

    if not operator or not station or station.operator_id is not None:
        raise HTTPException(status_code=400, detail="Invalid transaction or station is already approved anyone .")

    operator.is_approved = True
    station.operator_id = operator.operator_id  # İSTASYONU ATA
    db.commit()
    return {"message": "The operator has been approved and assigned to the first station."}


@router.get("/station-claims/pending")
def get_pending_station_claims(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)

    claims = db.query(models.Station).filter(models.Station.requested_operator_id != None).all()

    result = []
    for s in claims:
        user = db.query(models.User).filter(models.User.user_id == s.requested_operator_id).first()
        if user:
            result.append({
                "station_id": s.station_id,
                "station_name": s.name,
                "operator_id": user.user_id,
                "operator_name": user.name
            })
    return result


@router.patch("/stations/{station_id}/approve-claim")
def approve_station_claim(station_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_admin(current_user)
    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()
    if not station or not station.requested_operator_id:
        raise HTTPException(status_code=404, detail="Could not find any valid transaction.")

    station.operator_id = station.requested_operator_id
    station.requested_operator_id = None
    db.commit()
    return {"message": "The station request has been approved and the assignment has been made."}