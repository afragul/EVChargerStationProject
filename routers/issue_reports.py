from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

import schemas
import crud
import models
from database import get_db

router = APIRouter(prefix="/issue-reports", tags=["Issue Reports"])


@router.post("/", response_model=schemas.IssueReportResponse)
def create_issue_report(report_in: schemas.IssueReportCreate, db: Session = Depends(get_db)):
    """Yeni bir arıza bildirimi oluşturur ve cihazı devre dışı bırakır (Use Case 4)"""
    charger = crud.get_charger(db, report_in.charger_id)
    if not charger:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Charger not found")

    # 1. Arıza kaydını oluştur
    report = crud.create_issue_report(db, report_in)

    # 2. Cihaz durumunu "offline" (kırmızı) olarak güncelle (REQ-001)
    crud.update_charger(
        db,
        charger_id=report_in.charger_id,
        charger_update=schemas.ChargerUpdate(status=models.ChargerStatus.offline)
    )

    # 3. Bu cihaz için gelecekteki aktif rezervasyonları bul ve otomatik iptal et (REQ-002)
    current_time = datetime.utcnow()
    active_reservations = crud.get_active_reservations_by_charger(db, charger_id=report_in.charger_id,
                                                                  current_time=current_time)

    for res in active_reservations:
        crud.cancel_reservation(db, res.reservation_id)
        # Not: İptal edilen rezervasyonlar için Refund (iade) payment kaydı da buraya eklenebilir.
        for res in active_reservations:
            # Rezervasyonu iptal et
            crud.cancel_reservation(db, res.reservation_id)

            # --- REQUIREMENT BURADA SAĞLANIYOR ---
            # A) Sürücüye provizyon ücretini iade et
            driver = db.query(models.Driver).filter(models.Driver.driver_id == res.driver_id).first()
            if driver:
                driver.wallet_balance += 100.0

            # B) İlgili Kullanıcıyı Bilgilendir (Notification)
            new_notif = models.Notification(
                user_id=res.driver_id,
                message=f"🚨 Charger #{report_in.charger_id} has been reported broken. Your reservation on {res.date} is automatically cancelled and 100 TL has been refunded.",
                created_at=datetime.utcnow()
            )
            db.add(new_notif)

            # Bildirimlerin ve cüzdan iadesinin veritabanına yansıması için kaydet
        if active_reservations:
            db.commit()
    return report


@router.get("/open", response_model=List[schemas.IssueReportResponse])
def get_open_reports(db: Session = Depends(get_db)):
    """Çözülmemiş (açık) arıza kayıtlarını listeler"""
    return crud.get_open_reports(db)


@router.get("/charger/{charger_id}", response_model=List[schemas.IssueReportResponse])
def get_charger_reports(charger_id: int, db: Session = Depends(get_db)):
    """Belirli bir şarj ünitesine ait arıza geçmişini getirir"""
    return crud.get_reports_by_charger(db, charger_id)


@router.put("/{issue_id}/resolve", response_model=schemas.IssueReportResponse)
def resolve_issue_report(issue_id: int, db: Session = Depends(get_db)):
    """Arızayı çözüldü olarak işaretler ve cihazı tekrar aktifleştirir (REQ-004)"""
    report = crud.get_issue_report(db, issue_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue report not found")

    # 1. Rapor durumunu "resolved" yap
    updated_report = crud.update_issue_report(
        db,
        issue_id,
        schemas.IssueReportUpdate(status=models.ReportStatus.resolved)
    )

    # 2. Cihazın başka açık arızası kalmadıysa durumu tekrar "available" yap
    open_issues = [r for r in crud.get_reports_by_charger(db, report.charger_id) if
                   r.status == models.ReportStatus.open]
    if not open_issues:
        crud.update_charger(
            db,
            charger_id=report.charger_id,
            charger_update=schemas.ChargerUpdate(status=models.ChargerStatus.available)
        )

    return updated_report