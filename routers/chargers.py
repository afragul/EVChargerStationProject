from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/chargers", tags=["Chargers"])

# İstasyona ait cihazları listeleme
@router.get("/station/{station_id}", response_model= List[schemas.ChargerResponse])
def get_chargers_by_station(station_id: int, db: Session = Depends(get_db)):
    chargers = db.query(models.Charger).filter(models.Charger.station_id == station_id).all()
    if not chargers:
        raise HTTPException(status_code=404, detail="Bu istasyona ait şarj cihazı bulunamadı.")
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
        raise HTTPException(status_code=403, detail="Bu işlem için yetkiniz bulunmamaktadır.")

    # b. Cihazı veritabanından bul
    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Şarj cihazı bulunamadı.")

    # c. REQ-O05 KONTROLÜ: Operatör yetki sınırı!
    if current_user.role == "operator":
        # Veritabanındaki ilişkileri (relationships) kullanarak operatörün istasyonlarını çekiyoruz
        operator_profile = db.query(models.Operator).filter(models.Operator.operator_id == current_user.user_id).first()
        
        # Operatörün yönettiği istasyonların ID'lerini bir listeye alıyoruz
        managed_station_ids = [station.station_id for station in operator_profile.managed_stations]
        
        if charger.station_id not in managed_station_ids:
            raise HTTPException(
                status_code=403, 
                detail="Sadece sorumlu olduğunuz istasyonlardaki cihazları yönetebilirsiniz."
            )

    # Geçerli bir status gönderildiğinden emin ol
    try:
        new_enum_status = models.ChargerStatus(payload.status)
    except ValueError:
         raise HTTPException(status_code=400, detail="Geçersiz durum (status) değeri. 'available', 'occupied' veya 'offline' olmalıdır.")

    # d. Durumu güncelle ve kaydet
    charger.status = new_enum_status
    db.commit()
    db.refresh(charger)

    # TODO (Ekstra İşlem): Eğer cihaz "offline" yapıldıysa ve aktif rezervasyonu varsa,
    # REQ-O02 gereği burada rezervasyonları iptal eden bir fonksiyon çağrılmalıdır.

    return {"message": "Cihaz durumu başarıyla güncellendi.", "charger_id": charger.charger_id, "new_status": charger.status}