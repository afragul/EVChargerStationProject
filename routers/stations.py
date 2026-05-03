from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Annotated
from database import SessionLocal
import crud, schemas
from routers.auth import get_current_user, oauth2_bearer

router = APIRouter(prefix="/stations", tags=["Stations"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
token_dependency = Annotated[str, Depends(oauth2_bearer)]

# Tum istasyonlar
@router.get("/", response_model=list[schemas.StationResponse])
def get_all_stations(token: token_dependency, db: db_dependency, skip: int = 0, limit: int = 100):
    get_current_user(db, token)
    return crud.get_all_stations(db, skip=skip, limit=limit)

# Operatorun kendi istasyonlari
@router.get("/my/stations", response_model=list[schemas.StationResponse])
def get_my_stations(token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    if current_user.role != "operator":
        raise HTTPException(status_code=403, detail="Only operators can access this list")
    operator = crud.get_operator(db, current_user.user_id)
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")
    return crud.get_stations_by_operator(db, operator.operator_id)

# ---------- FAVORİ İSTASYON ENDPOINTLERİ ----------

@router.get("/favorites/me", response_model=list[schemas.StationResponse])
def get_my_favorite_stations(token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can have favorite stations")
    return crud.get_favorite_stations(db, current_user.user_id)

@router.post("/{station_id}/favorite", status_code=201)
def add_station_to_favorites(station_id: int, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can add favorite stations")
    station = crud.get_station(db, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    success = crud.add_favorite_station(db, current_user.user_id, station_id)
    if not success:
        raise HTTPException(status_code=400, detail="Action failed")
    return {"message": "Added to favorites"}

@router.delete("/{station_id}/favorite", status_code=204)
def remove_station_from_favorites(station_id: int, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Only drivers can modify favorites")
    crud.remove_favorite_station(db, current_user.user_id, station_id)
    return None

# ---------- DİĞER İSTASYON İŞLEMLERİ ----------

@router.get("/{station_id}", response_model=schemas.StationResponse)
def get_station(station_id: int, token: token_dependency, db: db_dependency):
    get_current_user(db, token)
    station = crud.get_station(db, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return station

@router.post("/", response_model=schemas.StationResponse, status_code=201)
def create_station(station_data: schemas.StationCreate, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can add stations")
    return crud.create_station(db, station_data)

@router.delete("/{station_id}", status_code=204)
def delete_station(station_id: int, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete stations")
    crud.delete_station(db, station_id)
    return None