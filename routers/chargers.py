from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import models, schemas
from database import get_db
from routers.auth import get_current_user
from datetime import datetime

router = APIRouter(prefix="/chargers", tags=["Chargers"])

def cancel_active_reservations_for_offline_charger(charger_id: int, db: Session):
    PREPAYMENT_AMOUNT = 100.0

    # 1. Bu cihaza ait "active" durumdaki tüm rezervasyonları bul
    active_reservations = db.query(models.Reservation).filter(
        models.Reservation.charger_id == charger_id,
        models.Reservation.status == "active"
    ).all()

    for res in active_reservations:
        #Rezervasyonu iptal et
        res.status = "cancelled"

        #Sürücüyü bul ve cüzdanına iade yap
        driver = db.query(models.Driver).filter(models.Driver.driver_id == res.driver_id).first()
        if driver:
            driver.wallet_balance += PREPAYMENT_AMOUNT

            # c. İadeyi Payment (Ödeme Geçmişi) tablosuna kaydet
            new_refund = models.Payment(
                driver_id=driver.driver_id,
                reservation_id=res.reservation_id,
                amount=PREPAYMENT_AMOUNT,
                type=models.PaymentType.refund, # Tipi "İade" olarak işaretliyoruz
                timestamp=datetime.utcnow()
            )
            db.add(new_refund)

    db.commit()

# İstasyona ait cihazları listeleme
@router.get("/station/{station_id}", response_model= List[schemas.ChargerResponse])
def get_chargers_by_station(station_id: int, db: Session = Depends(get_db)):
    chargers = db.query(models.Charger).filter(models.Charger.station_id == station_id).all()
    if not chargers:
        raise HTTPException(status_code=404, detail="No charger could be found for this station.")
    return chargers

# 2. Şarj Cihazı Durumunu Güncelleme offline / available
@router.patch("/{charger_id}/status")
def update_charger_status(
    charger_id: int, 
    payload: schemas.ChargerStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # Sadece giriş yapmış kullanıcılar
):
    # a. Rol kontrolü
    if current_user.role not in ["operator", "admin"]:
        raise HTTPException(status_code=403, detail="You do not have authorization to perform this action.")

    # b. Cihazı veritabanından bul
    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found.")

    # c. REQ-O05 KONTROLÜ: Operatör yetki sınırı!
    if current_user.role == "operator":
        # Veritabanındaki ilişkileri (relationships) kullanarak operatörün istasyonlarını çekiyoruz
        operator_profile = db.query(models.Operator).filter(models.Operator.operator_id == current_user.user_id).first()
        
        # Operatörün yönettiği istasyonların ID'lerini bir listeye alıyoruz
        managed_station_ids = [station.station_id for station in operator_profile.managed_stations]
        
        if charger.station_id not in managed_station_ids:
            raise HTTPException(
                status_code=403, 
                detail="You can only manage the equipment at the stations you are responsible for."
            )

    # Geçerli bir status gönderildiğinden emin ol
    try:
        new_enum_status = models.ChargerStatus(payload.status)
    except ValueError:
         raise HTTPException(status_code=400, detail="Invalid status value. Must be 'available', 'occupied', or 'offline'.")

    # d. Durumu güncelle ve kaydet
    charger.status = new_enum_status
    db.commit()
    db.refresh(charger)

    if new_enum_status.value == "offline":
        cancel_active_reservations_for_offline_charger(charger_id, db)


    return {"message": "Device status has been successfully updated.", "charger_id": charger.charger_id, "new_status": charger.status}

# Yeni Şarj Cihazı Oluşturma (POST)
@router.post("/", response_model=schemas.ChargerResponse)
def create_charger(req: schemas.ChargerCreate, db: Session = Depends(get_db)):
    # Önce böyle bir istasyon var mı diye kontrol edelim
    station = db.query(models.Station).filter(models.Station.station_id == req.station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="No station was found with the specified station_id.")

    new_charger = models.Charger(
        station_id=req.station_id,
        type=req.type,
        power_kW=req.power_kW,
        connector_type=req.connector_type,
        price_per_kWh=req.price_per_kWh,
        status="available" # Yeni eklenen cihaz varsayılan olarak boştur
    )
    db.add(new_charger)
    db.commit()
    db.refresh(new_charger)
    return new_charger


# 2.Tüm Şarj Cihazlarını Listeleme (Opsiyonel Station Filtreli)
@router.get("/", response_model=List[schemas.ChargerResponse])
def get_all_chargers(
    station_id: Optional[int] = None, 
    db: Session = Depends(get_db)
):
    query = db.query(models.Charger)
    if station_id:
        query = query.filter(models.Charger.station_id == station_id)
        
    return query.all()


# 4.Tek Bir Cihazın Detayını Getirme
@router.get("/{charger_id}", response_model=schemas.ChargerResponse)
def get_charger(
    charger_id: int, 
    db: Session = Depends(get_db)
):
    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found.")
    
    return charger


# 6. YENİ EKLENDİ: Cihazı Silme (DELETE)
@router.delete("/{charger_id}")
def delete_charger(
    charger_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # Güvenlik için yetki ekledik
):
    if current_user.role not in ["operator", "admin"]:
        raise HTTPException(status_code=403, detail="You do not have authorization to perform this action.")

    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found.")
    
    db.delete(charger)
    db.commit()
    
    return {"message": f"Charger with ID {charger_id} has been successfully deleted."}