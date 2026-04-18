# main.py
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, date, time
import os
import httpx
from dotenv import load_dotenv

import crud
import schemas
from database import get_db

load_dotenv()

GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

app = FastAPI(title="EV Charging Station Network Management System")

# ---------- USER & AUTH ----------
@app.post("/register/", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = crud.get_user_by_email(db, user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db, user)

@app.post("/login/")
def login(email: str, password: str, db: Session = Depends(get_db)):
    user = crud.authenticate_user(db, email, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"user_id": user.user_id, "role": user.role, "message": "Login successful"}

# ---------- DRIVER & VEHICLE ----------
@app.post("/drivers/", response_model=schemas.DriverResponse)
def create_driver(driver: schemas.DriverCreate, db: Session = Depends(get_db)):
    user = crud.get_user(db, driver.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "driver":
        raise HTTPException(status_code=400, detail="User is not a driver")
    existing = crud.get_driver(db, driver.user_id)
    if existing:
        raise HTTPException(status_code=400, detail="Driver already exists")
    return crud.create_driver(db, driver)

@app.get("/drivers/{driver_id}", response_model=schemas.DriverResponse)
def read_driver(driver_id: int, db: Session = Depends(get_db)):
    driver = crud.get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver

@app.post("/vehicles/", response_model=schemas.VehicleResponse)
def create_vehicle(vehicle: schemas.VehicleCreate, db: Session = Depends(get_db)):
    driver = crud.get_driver(db, vehicle.owner_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return crud.create_vehicle(db, vehicle)

@app.get("/vehicles/driver/{driver_id}", response_model=List[schemas.VehicleResponse])
def list_driver_vehicles(driver_id: int, db: Session = Depends(get_db)):
    return crud.get_vehicles_by_driver(db, driver_id)

# ---------- STATIONS & CHARGERS ----------
@app.post("/stations/", response_model=schemas.StationResponse)
def create_station(station: schemas.StationCreate, db: Session = Depends(get_db)):
    return crud.create_station(db, station)

@app.get("/stations/", response_model=List[schemas.StationResponse])
def list_stations(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_all_stations(db, skip=skip, limit=limit)

@app.get("/stations/{station_id}", response_model=schemas.StationResponse)
def get_station(station_id: int, db: Session = Depends(get_db)):
    station = crud.get_station(db, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return station

@app.post("/chargers/", response_model=schemas.ChargerResponse)
def create_charger(charger: schemas.ChargerCreate, db: Session = Depends(get_db)):
    station = crud.get_station(db, charger.station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return crud.create_charger(db, charger)

@app.get("/chargers/", response_model=List[schemas.ChargerResponse])
def list_chargers(station_id: int = None, db: Session = Depends(get_db)):
    if station_id:
        return crud.get_chargers_by_station(db, station_id)
    return crud.get_available_chargers(db)  # or all chargers - adjust as needed

@app.get("/chargers/available/", response_model=List[schemas.ChargerResponse])
def list_available_chargers(station_id: int = None, db: Session = Depends(get_db)):
    return crud.get_available_chargers(db, station_id=station_id)

# ---------- RESERVATIONS (with compatibility check) ----------
def check_vehicle_charger_compatibility(db: Session, driver_id: int, charger_id: int) -> bool:
    vehicles = crud.get_vehicles_by_driver(db, driver_id)
    if not vehicles:
        return False
    charger = crud.get_charger(db, charger_id)
    if not charger:
        return False
    # Use the first vehicle for simplicity; frontend could select which vehicle.
    return vehicles[0].connector_type == charger.connector_type

@app.post("/reservations/", response_model=schemas.ReservationResponse)
def create_reservation(res: schemas.ReservationCreate, db: Session = Depends(get_db)):
    driver = crud.get_driver(db, res.driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    charger = crud.get_charger(db, res.charger_id)
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    if not check_vehicle_charger_compatibility(db, res.driver_id, res.charger_id):
        raise HTTPException(status_code=400, detail="Vehicle connector type not compatible with this charger")
    if not crud.is_charger_available(db, res.charger_id, res.date, res.start_time, res.end_time):
        raise HTTPException(status_code=409, detail="Time slot already reserved")
    return crud.create_reservation(db, res)

@app.get("/reservations/driver/{driver_id}", response_model=List[schemas.ReservationResponse])
def list_driver_reservations(driver_id: int, db: Session = Depends(get_db)):
    return crud.get_reservations_by_driver(db, driver_id)

@app.delete("/reservations/{reservation_id}")
def cancel_reservation_endpoint(reservation_id: int, db: Session = Depends(get_db)):
    res = crud.cancel_reservation(db, reservation_id)
    if not res:
        raise HTTPException(status_code=404, detail="Reservation not found")
    return {"message": "Reservation cancelled", "reservation_id": reservation_id}

# ---------- WALLET & PAYMENTS ----------
@app.post("/wallet/topup/")
def topup_wallet(driver_id: int, amount: float, db: Session = Depends(get_db)):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    driver = crud.update_wallet(db, driver_id, amount)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    payment = schemas.PaymentCreate(
        amount=amount,
        type=schemas.PaymentType.topup,
        driver_id=driver_id,
        reservation_id=None
    )
    crud.create_payment(db, payment)
    return {"message": f"Added {amount} TL", "new_balance": driver.wallet_balance}

@app.get("/wallet/{driver_id}")
def get_wallet_balance(driver_id: int, db: Session = Depends(get_db)):
    driver = crud.get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return {"driver_id": driver_id, "balance": driver.wallet_balance}

# ---------- CHARGING SESSION & COST CALCULATION ----------
@app.post("/charging_sessions/start/")
def start_charging_session(reservation_id: int, db: Session = Depends(get_db)):
    reservation = crud.get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    if reservation.status != "active":
        raise HTTPException(status_code=400, detail="Reservation is not active")
    existing = crud.get_charging_session_by_reservation(db, reservation_id)
    if existing:
        raise HTTPException(status_code=400, detail="Charging session already started")
    return {"message": "Charging started. Use /charging_sessions/end/ to finish."}

@app.post("/charging_sessions/end/")
def end_charging_session(
    reservation_id: int,
    start_soc: float,
    end_soc: float,
    kwh_consumed: float,
    duration_min: int,
    db: Session = Depends(get_db)
):
    reservation = crud.get_reservation(db, reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    charger = crud.get_charger(db, reservation.charger_id)
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    total_cost = kwh_consumed * charger.price_per_kWh
    driver = crud.update_wallet(db, reservation.driver_id, -total_cost)
    if driver is None:
        raise HTTPException(status_code=404, detail="Driver not found")
    if driver.wallet_balance < 0:
        crud.update_wallet(db, reservation.driver_id, total_cost)
        raise HTTPException(status_code=402, detail="Insufficient wallet balance")
    session_data = schemas.ChargingSessionCreate(
        start_soc=start_soc,
        end_soc=end_soc,
        kwh_consumed=kwh_consumed,
        total_cost=total_cost,
        duration_min=duration_min,
        reservation_id=reservation_id
    )
    db_session = crud.create_charging_session(db, session_data)
    payment = schemas.PaymentCreate(
        amount=total_cost,
        type=schemas.PaymentType.charge,
        driver_id=reservation.driver_id,
        reservation_id=reservation_id
    )
    crud.create_payment(db, payment)
    crud.complete_reservation(db, reservation_id)
    crud.update_charger(db, charger.charger_id, schemas.ChargerUpdate(status=schemas.ChargerStatus.available))
    return {
        "message": "Session ended",
        "total_cost": total_cost,
        "new_balance": driver.wallet_balance,
        "session_id": db_session.charging_session_id
    }

# ---------- ISSUE REPORTS ----------
@app.post("/issue_reports/", response_model=schemas.IssueReportResponse)
def report_issue(report: schemas.IssueReportCreate, db: Session = Depends(get_db)):
    charger = crud.get_charger(db, report.charger_id)
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    return crud.create_issue_report(db, report)

@app.get("/issue_reports/open/", response_model=List[schemas.IssueReportResponse])
def list_open_reports(db: Session = Depends(get_db)):
    return crud.get_open_reports(db)

@app.put("/issue_reports/{issue_id}/resolve")
def resolve_issue(issue_id: int, db: Session = Depends(get_db)):
    update = schemas.IssueReportUpdate(status=schemas.ReportStatus.resolved)
    report = crud.update_issue_report(db, issue_id, update)
    if not report:
        raise HTTPException(status_code=404, detail="Issue report not found")
    return {"message": "Issue marked as resolved"}

# ---------- OPERATOR ACTIONS ----------
@app.put("/chargers/{charger_id}/maintenance")
def mark_charger_out_of_service(charger_id: int, db: Session = Depends(get_db)):
    charger = crud.update_charger(db, charger_id, schemas.ChargerUpdate(status=schemas.ChargerStatus.offline))
    if not charger:
        raise HTTPException(status_code=404, detail="Charger not found")
    now = datetime.now()
    active_res = crud.get_active_reservations_by_charger(db, charger_id, now)
    for res in active_res:
        crud.cancel_reservation(db, res.reservation_id)
    return {"message": f"Charger {charger_id} marked offline. {len(active_res)} reservations cancelled."}

# ---------- GOOGLE MAPS PROXY ENDPOINT ----------
@app.get("/api/directions")
async def get_directions(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float):
    """Proxy to Google Directions API (hides your API key)"""
    url = "https://maps.googleapis.com/maps/api/directions/json"
    params = {
        "origin": f"{origin_lat},{origin_lng}",
        "destination": f"{dest_lat},{dest_lng}",
        "key": GOOGLE_MAPS_API_KEY
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params=params)
        return resp.json()

# ---------- SERVE STATIC FILES (Frontend) ----------
app.mount("/static", StaticFiles(directory="static"), name="static")