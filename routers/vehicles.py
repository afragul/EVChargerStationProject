from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Annotated
from database import SessionLocal
import crud, schemas
from routers.auth import get_current_user, oauth2_bearer


router = APIRouter(prefix="/vehicles", tags=["Vehicles"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
token_dependency = Annotated[str, Depends(oauth2_bearer)]

#arac ekle
@router.post("/", response_model=schemas.VehicleResponse, status_code=201)
def create_vehicle(vehicle_data: schemas.VehicleCreate, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Just drivers can added a vehicle.")

    driver = crud.get_driver_by_user_id(db, current_user.user_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver is not found")

    # owner_id'yi token'dan al
    vehicle_data.owner_id = driver.driver_id
    return crud.create_vehicle(db, vehicle_data)

#kendi araclarimi listele
@router.get("/me", response_model=list[schemas.VehicleResponse])
def get_my_vehicles(token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Drivers can listed a vehicles.")

    driver = crud.get_driver_by_user_id(db, current_user.user_id)
    return crud.get_vehicles_by_driver(db, driver.driver_id)

#arac getirme
@router.get("/{vehicle_id}", response_model=schemas.VehicleResponse)
def get_vehicle(vehicle_id: int, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)

    vehicle = crud.get_vehicle(db, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="vehicle not found")

    # Sadece kendi aracını görebilir
    if current_user.role == "driver":
        driver = crud.get_driver_by_user_id(db, current_user.user_id)
        if vehicle.owner_id != driver.driver_id:
            raise HTTPException(status_code=403, detail="Vehicle owner does not match driver owner")

    return vehicle

#arac bilgilerini guncelle
@router.put("/{vehicle_id}", response_model=schemas.VehicleResponse)
def update_vehicle(vehicle_id: int, vehicle_update: schemas.VehicleUpdate, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Drivers can listed a vehicles.")

    vehicle = crud.get_vehicle(db, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    driver = crud.get_driver_by_user_id(db, current_user.user_id)
    if vehicle.owner_id != driver.driver_id:
        raise HTTPException(status_code=403, detail="Vehicle owner does not match driver owner")

    return crud.update_vehicle(db, vehicle_id, vehicle_update)

#arac sil
@router.delete("/{vehicle_id}", status_code=204)
def delete_vehicle(vehicle_id: int, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Drivers can listed a vehicles.")

    vehicle = crud.get_vehicle(db, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    driver = crud.get_driver_by_user_id(db, current_user.user_id)
    if vehicle.owner_id != driver.driver_id:
        raise HTTPException(status_code=403, detail="Vehicle owner does not match driver owner")

    crud.delete_vehicle(db, vehicle_id)