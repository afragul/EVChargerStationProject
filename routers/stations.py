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

#tum istasyonlar
@router.get("/", response_model=list[schemas.StationResponse])
def get_all_stations(token: token_dependency, db: db_dependency, skip: int = 0, limit: int = 100):
    get_current_user(db, token)  # sadece login olmuş herkes görebilir
    return crud.get_all_stations(db, skip=skip, limit=limit)

#id ye gore istasyon
@router.get("/{station_id}", response_model=schemas.StationResponse)
def get_station(station_id: int, token: token_dependency, db: db_dependency):
    get_current_user(db, token)

    station = crud.get_station(db, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return station

#operator icin kendi istasyonlarimi listele
@router.get("/my/stations", response_model=list[schemas.StationResponse])
def get_my_stations(token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    if current_user.role != "operator":
        raise HTTPException(status_code=403, detail="Only operators can acces this list")

    operator = crud.get_operator(db, current_user.user_id)
    if not operator:
        raise HTTPException(status_code=404, detail="Operator not found")

    return crud.get_stations_by_operator(db, operator.operator_id)

#admin icin istasyon ekle
@router.post("/", response_model=schemas.StationResponse, status_code=201)
def create_station(station_data: schemas.StationCreate, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can add stations")

    return crud.create_station(db, station_data)


#admin ya da sorumlu operator icin istasyon guncelle
@router.put("/{station_id}", response_model=schemas.StationResponse)
def update_station(station_id: int, station_update: schemas.StationUpdate, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)

    station = crud.get_station(db, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    # Admin her istasyonu güncelleyebilir, operator sadece kendi istasyonunu
    if current_user.role == "operator":
        if station.operator_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="You do not have permission")
    elif current_user.role != "admin":
        raise HTTPException(status_code=403, detail=" You do not have permission")

    return crud.update_station(db, station_id, station_update)

#admin istasyon silebilir
@router.delete("/{station_id}", status_code=204)
def delete_station(station_id: int, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete stations")

    station = crud.get_station(db, station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    crud.delete_station(db, station_id)

