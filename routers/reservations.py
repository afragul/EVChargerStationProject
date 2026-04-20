from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, time
import models, schemas
from database import get_db
from auth import get_current_user 

router = APIRouter(prefix="/reservations", tags=["Reservations"])

PROVISION_AMOUNT = 100.0  # Sistemin rezervasyon için istediği minimum cüzdan provizyonu. Buna reqlerden bakılacak. 

@router.post("/", response_model=schemas.ReservationResponse)
def create_reservation(
    req: schemas.ReservationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    #rol kontrolü
    if current_user.role != "driver":
        raise HTTPException(status_code= 403, detail= "Sadece sürücüler rezervasyon yapabilir.")
    
    driver = db.query(models.Driver).filter(models.Driver.driver_id == current_user.user_id).first()

    #araç kontrolü
    vehicle = db.query(models.Vehicle).filter(
        models.Vehicle.vehicle_id == req.vehicle_id,
        models.Vehicle.owner_id == driver.driver_id
    ).first()
    if not vehicle:
        raise HTTPException(status_code= 404, detail = "Araç bulunamadı veya size ait değil")
    
    #cihaz durum kontrolü
    charger = db.query(models.Charger).filter(models.Charger.charger_id == req.charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Şarj cihazı bulunamadı.")
        
    if charger.status.value == "offline": # REQ-O01 ve Exception kuralı
        raise HTTPException(status_code=400, detail="Seçili cihaz şu anda arızalı / hizmet dışıdır.")
    

    # 4. Uyumluluk Kontrolü (REQ-D04 & Use Case 1 Exception: Incompatible Connector)
    if vehicle.connector_type != charger.connector_type:
        raise HTTPException(
            status_code=400,
            detail=f"Uyumsuz Soket! Aracınız {vehicle.connector_type}, ancak cihaz {charger.connector_type} destekliyor."
        )
    

    # 5. Zaman Çakışması Algoritması (Use Case 1 Exception: Time Conflict)
    # Kesişim formülü: Yeni_Başlangıç < Mevcut_Bitiş VE Yeni_Bitiş > Mevcut_Başlangıç
    overlapping_reservation = db.query(models.Reservation).filter(
        models.Reservation.charger_id == req.charger_id,
        models.Reservation.date == req.date,
        models.Reservation.status == "active",
        req.start_time < models.Reservation.end_time,
        req.end_time > models.Reservation.start_time
    ).first()

    if overlapping_reservation:
        raise HTTPException(
            status_code=400, 
            detail="Seçilen tarih ve saat dilimi, bu cihazdaki başka bir rezervasyon ile çakışıyor."
        )
    
    #bakiye kontrolü
    if driver.wallet_balance < PROVISION_AMOUNT:
        raise HTTPException(
            status_code=402, # Payment Required
            detail=f"Yetersiz bakiye. Rezervasyon için en az {PROVISION_AMOUNT} TL cüzdan bakiyesi gereklidir. Lütfen bakiye yükleyin."
        )
    
    #reservasyon oluşturma
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