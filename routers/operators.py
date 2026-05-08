from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas
from database import get_db
from routers.auth import get_current_user
from datetime import datetime, date

router = APIRouter(prefix="/operators", tags=["Operators"])


def verify_operator_access(db: Session, user: models.User, station_id: int):
    """Operatörün bu istasyondan sorumlu olup olmadığını kontrol eder (REQ-O05)"""
    if user.role != "operator":
        raise HTTPException(status_code=403, detail="Access denied. Operator role required.")

    station = db.query(models.Station).filter(
        models.Station.station_id == station_id,
        models.Station.operator_id == user.user_id
    ).first()

    if not station:
        raise HTTPException(status_code=403, detail="You do not have the authority to manage this station.")
    return station


@router.get("/my-stations", response_model=List[schemas.StationResponse])
def get_my_stations(
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    if current_user.role != "operator":
        raise HTTPException(status_code=403, detail="Access denied.")
    return db.query(models.Station).filter(models.Station.operator_id == current_user.user_id).all()


@router.put("/chargers/{charger_id}/status")
def update_charger_status(
        charger_id: int,
        status_data: schemas.ChargerStatusUpdate,  # Body'den gelmesi için şema kullanıldı
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    charger = db.query(models.Charger).filter(models.Charger.charger_id == charger_id).first()
    if not charger:
        raise HTTPException(status_code=404, detail="Device not found.")

    # Yetki kontrolü
    verify_operator_access(db, current_user, charger.station_id)

    charger.status = status_data.status

    # Cihaz arızalıya (offline) çekiliyorsa etkilenen rezervasyonları iptal et ve para iadesi yap (Use Case 4)
    if status_data.status == schemas.ChargerStatus.offline:
        active_reservations = db.query(models.Reservation).filter(
            models.Reservation.charger_id == charger_id,
            models.Reservation.status == "active"
        ).all()

        for res in active_reservations:
            res.status = "cancelled"
            # Sürücüye parasını iade et (Örnek: 100 TL standart provizyon iadesi)
            driver = db.query(models.Driver).filter(models.Driver.driver_id == res.driver_id).first()
            if driver:
                driver.wallet_balance += 100.0

            new_notif = models.Notification(
                user_id=res.driver_id,
                message=f" Charger #{charger_id} went offline. Your reservation on {res.date} is cancelled and 100 TL is refunded.",
                created_at=datetime.utcnow()
            )
            db.add(new_notif)

    db.commit()
    return {"message": f"Device status updated to '{status_data.status}'."}


# ==========================================
# YENİ EKLENEN: Operatörün Haritadan Kendine İstasyon Alması (Claim)
# ==========================================
@router.patch("/stations/{station_id}/claim")
def claim_station(station_id: int, db: Session = Depends(get_db),
                  current_user: models.User = Depends(get_current_user)):
    if current_user.role != "operator":
        raise HTTPException(status_code=403, detail="Only operators can acquire stations..")

    station = db.query(models.Station).filter(models.Station.station_id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found.")

    # Eğer istasyon zaten başkasına aitse hata ver
    if station.operator_id is not None and station.operator_id != current_user.user_id:
        raise HTTPException(status_code=400, detail="This station is already managed by another operator..")

    if station.requested_operator_id is not None:
        raise HTTPException(status_code=400, detail="This station has a pending claim from someone else.")

    # İstasyonu talep et
    station.requested_operator_id = current_user.user_id
    db.commit()
    return {"message": "Claim request sent to admin for approval."}

# ==========================================
# Arıza Bildirimi Yönetimi
# ==========================================

@router.get("/issues", response_model=List[schemas.IssueReportResponse])
def get_operator_issues(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "operator":
        raise HTTPException(status_code=403, detail="unauthorized access.")

    # Operatörün sadece kendi istasyonlarındaki cihazlara ait arıza raporlarını getir
    issues = db.query(models.IssueReport).join(models.Charger).join(models.Station).filter(
        models.Station.operator_id == current_user.user_id
    ).all()

    return issues


@router.patch("/issues/{issue_id}/resolve")
def resolve_issue(issue_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "operator":
        raise HTTPException(status_code=403, detail="Unauthorized access.")

    # Sadece kendi istasyonuna ait bir sorunu mu çözüyor diye kontrol et
    issue = db.query(models.IssueReport).join(models.Charger).join(models.Station).filter(
        models.IssueReport.issue_id == issue_id,
        models.Station.operator_id == current_user.user_id
    ).first()

    if not issue:
        raise HTTPException(status_code=404, detail="No fault report was found, or you do not have the necessary authorization.")

    issue.status = "resolved"
    db.commit()
    return {"message": "The problem has been marked as successfully resolved."}


@router.get("/analytics")
def get_operator_analytics(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "operator":
        raise HTTPException(status_code=403, detail="Unauthorized access.")

    # 1. Sadece bu operatöre ait istasyonları ve cihazları bul
    my_stations = db.query(models.Station.station_id).filter(models.Station.operator_id == current_user.user_id).subquery()
    my_chargers = db.query(models.Charger.charger_id).filter(models.Charger.station_id.in_(my_stations)).subquery()

    # 2. Sadece bu cihazlardaki tamamlanmış işlemleri çek
    completed_reservations = db.query(models.Reservation).filter(
        models.Reservation.status == "completed",
        models.Reservation.charger_id.in_(my_chargers)
    ).all()

    total_revenue = 0.0
    total_kwh = 0.0
    station_stats = {}
    peak_hours = {f"{i:02d}": 0 for i in range(24)}
    unique_users = set()

    for res in completed_reservations:
        # Peak Hour Analizi
        if res.start_time:
            try:
                hour_str = str(res.start_time).split(':')[0]
                if hour_str in peak_hours:
                    peak_hours[hour_str] += 1
            except Exception:
                pass
        
        # Benzersiz Müşteri Sayısı
        unique_users.add(res.driver_id)

        # Ciro ve İstasyon Utilizasyon Analizi
        session = db.query(models.ChargingSession).filter(
            models.ChargingSession.reservation_id == res.reservation_id).first()
        if session:
            cost = float(session.total_cost or 0.0)
            kwh = float(session.kwh_consumed or 0.0)

            total_revenue += cost
            total_kwh += kwh

            charger = db.query(models.Charger).filter(models.Charger.charger_id == res.charger_id).first()
            if charger:
                station = db.query(models.Station).filter(models.Station.station_id == charger.station_id).first()
                if station:
                    s_name = station.name
                    if s_name not in station_stats:
                        station_stats[s_name] = {"revenue": 0.0, "sessions": 0, "kwh": 0.0}

                    station_stats[s_name]["revenue"] += cost
                    station_stats[s_name]["sessions"] += 1
                    station_stats[s_name]["kwh"] += kwh

    # User Activity Summary (Operatöre Özel)
    user_activity = {
        "unique_drivers_served": len(unique_users),
        "completed_sessions": len(completed_reservations)
    }

    return {
        "total_revenue": total_revenue,
        "total_kwh": total_kwh,
        "station_usage": [{"station": k, **v} for k, v in station_stats.items()],
        "peak_hours": [{"hour": k, "count": v} for k, v in peak_hours.items()],
        "user_activity": user_activity
    }