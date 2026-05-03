from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime , date
import models, schemas
from database import get_db
from routers.auth import get_current_user
from typing import List, Optional


try:
    from config import DEFAULT_PROVISION_AMOUNT
except ImportError:
    DEFAULT_PROVISION_AMOUNT = 100.0

router = APIRouter(prefix="/reservations", tags=["Reservations"])


# 1. REZERVASYON OLUŞTURMA (POST)
@router.post("/", response_model=schemas.ReservationResponse)
def create_reservation(
    req: schemas.ReservationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "driver":
        raise HTTPException(status_code= 403, detail= "Sadece sürücüler rezervasyon yapabilir.")
    
    driver = db.query(models.Driver).filter(models.Driver.driver_id == current_user.user_id).first()

    vehicle = db.query(models.Vehicle).filter(
        models.Vehicle.vehicle_id == req.vehicle_id,
        models.Vehicle.owner_id == driver.driver_id
    ).first()
    if not vehicle:
        raise HTTPException(status_code= 404, detail = "Araç bulunamadı veya size ait değil")
    
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
        models.Reservation.status == "active",
        req.start_time < models.Reservation.end_time,
        req.end_time > models.Reservation.start_time
    ).first()

    if overlapping_reservation:
        raise HTTPException(
            status_code=400, 
            detail="Seçilen tarih ve saat dilimi, bu cihazdaki başka bir rezervasyon ile çakışıyor."
        )
    existing_user_reservation = db.query(models.Reservation).filter(
        models.Reservation.driver_id == driver.driver_id,
        models.Reservation.date == req.date,
        models.Reservation.status == "active"
    ).first()

    if existing_user_reservation:
        raise HTTPException(
            status_code=400,
            detail=f"Bu tarih için zaten {existing_user_reservation.start_time.strftime('%H:%M')} saatinde başlayan aktif bir rezervasyonunuz var. Yenisini yapmadan önce onu tamamlamalı veya iptal etmelisiniz."
        )
    
    # DÜZELTME: Bakiye kontrolü ve provizyonun kesilmesi
    if driver.wallet_balance < DEFAULT_PROVISION_AMOUNT:
        raise HTTPException(
            status_code=402, 
            detail=f"Yetersiz bakiye. Rezervasyon için {DEFAULT_PROVISION_AMOUNT} TL gereklidir."
        )
    
    # Parayı cüzdandan kesiyoruz ki iptal ettiğinde haksız kazanç sağlamasın
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


# 2. SÜRÜCÜNÜN KENDİ REZERVASYONLARI (GET)
@router.get("/me", response_model=List[schemas.ReservationResponse])
def get_my_reservations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Sadece sürücüler bu alanı görebilir.")

    return db.query(models.Reservation).filter(models.Reservation.driver_id == current_user.user_id).all()


# 3. YÖNETİM: TÜM REZERVASYONLARI LİSTELEME (GET)
@router.get("/", response_model=List[schemas.ReservationResponse])
def get_all_reservations(
    charger_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Yetkisiz erişim.")
    
    query = db.query(models.Reservation)
    if charger_id:
        query = query.filter(models.Reservation.charger_id == charger_id)
        
    return query.all()


# 4. TEKİL REZERVASYON DETAYI (GET)
@router.get("/{reservation_id}", response_model=schemas.ReservationResponse)
def get_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    reservation = db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Rezervasyon bulunamadı.")
    return reservation


# 5. İPTAL İŞLEMİ (PATCH)
@router.patch("/{reservation_id}/cancel")
def cancel_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    reservation = db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Rezervasyon bulunamadı.")

    if reservation.driver_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Sadece kendi rezervasyonlarınızı iptal edebilirsiniz.")

    if reservation.status != "active":
        raise HTTPException(status_code=400, detail=f"Bu rezervasyon iptal edilemez. Durum: {reservation.status}")

    reservation.status = "cancelled"
    
    # Oluştururken kestiğimiz provizyonu şimdi güvenle iade edebiliriz
    driver = db.query(models.Driver).filter(models.Driver.driver_id == current_user.user_id).first()
    if driver:
        driver.wallet_balance += DEFAULT_PROVISION_AMOUNT

    db.commit()
    return {"message": "Rezervasyon iptal edildi ve ücret iade edildi."}


# 6. YENİ: ŞARJI BAŞLATMA (PATCH) - Use Case 3
@router.patch("/{reservation_id}/start")
def start_charging(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    reservation = db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()
    if not reservation or reservation.driver_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="Geçerli bir rezervasyon bulunamadı.")

    if reservation.status != "active":
        raise HTTPException(status_code=400, detail="Sadece 'active' durumdaki rezervasyonlar başlatılabilir.")

    # Rezervasyon durumunu ve cihaz durumunu güncelle
    reservation.status = "charging"
    
    charger = db.query(models.Charger).filter(models.Charger.charger_id == reservation.charger_id).first()
    if charger:
        charger.status = "occupied" # Cihaz meşgul konumuna geçer

    db.commit()
    return {"message": "Şarj işlemi başarıyla başlatıldı."}


# 7. YENİ: ŞARJI BİTİRME (PATCH) - Use Case 3
@router.patch("/{reservation_id}/complete")
def complete_charging(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    reservation = db.query(models.Reservation).filter(models.Reservation.reservation_id == reservation_id).first()
    if not reservation or reservation.driver_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="Geçerli bir rezervasyon bulunamadı.")

    if reservation.status != "charging":
        raise HTTPException(status_code=400, detail="Sadece 'charging' durumundaki işlemler tamamlanabilir.")

    reservation.status = "completed"
    
    charger = db.query(models.Charger).filter(models.Charger.charger_id == reservation.charger_id).first()
    if charger:
        charger.status = "available" # Cihaz tekrar boşa çıkar

    # Not: Gerçek senaryoda burada tüketilen kWh hesaplanıp Payment tablosuna fatura kesilir.
    # Provizyondan arta kalan tutar iade edilir veya eksikse cüzdandan çekilir.

    db.commit()
    return {"message": "Şarj işlemi tamamlandı. Cihaz ayrıldı."}

# 8. YENİ: BELİRLİ BİR CİHAZIN GÜNLÜK DOLU SAATLERİNİ GETİRME (GET)
@router.get("/charger/{charger_id}/schedule")
def get_charger_schedule(
    charger_id: int,
    target_date: date,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Sadece aktif olan ve o günkü rezervasyonları çek
    reservations = db.query(models.Reservation).filter(
        models.Reservation.charger_id == charger_id,
        models.Reservation.date == target_date,
        models.Reservation.status.in_(["active", "charging"]) # İptal olanları dahil etme
    ).all()

    # Frontend'in sadece saatleri bilmesi yeterli, kimin rezerve ettiğini gizliyoruz (Güvenlik)
    return [{"start_time": res.start_time.strftime("%H:%M"), "end_time": res.end_time.strftime("%H:%M")} for res in reservations]