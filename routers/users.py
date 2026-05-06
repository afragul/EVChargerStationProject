from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Annotated

from starlette import status

from database import SessionLocal
import crud, models, schemas
from routers.auth import get_current_user, require_admin, oauth2_bearer


router = APIRouter(prefix="/users", tags=["Users"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
token_dependency = Annotated[str, Depends(oauth2_bearer)]

#register islemleri
@router.post("/register" , response_model=schemas.UserResponse , status_code=status.HTTP_201_CREATED)
def register(user_data: schemas.UserCreate, db:db_dependency):
    #email zaten var mi
    existing=crud.get_user_by_email(db,user_data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if user_data.role not in ["driver", "operator", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    user=crud.create_user(db,user_data)

    # Role göre alt tablo olustur
    if user_data.role == "driver":
        crud.create_driver(db, schemas.DriverCreate(user_id=user.user_id, wallet_balance=0.0))
    elif user_data.role == "operator":
        crud.create_operator(db, user.user_id)
    elif user_data.role == "admin":
        crud.create_admin(db, user.user_id)

    return user

#curretn user dondur - profil
@router.get("/me" , response_model=schemas.UserResponse)
def get_me(token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    return current_user

#get user by id ama sadece admin icin
@router.get("/{user_id}", response_model=schemas.UserResponse)
def get_user(user_id: int, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    require_admin(current_user)

    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User is not found")
    return user

#bilgilerini update et
@router.put("/me", response_model=schemas.UserResponse)
def update_me(user_update: schemas.UserUpdate, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    updated = crud.update_user(db, current_user.user_id, user_update)
    if not updated:
        raise HTTPException(status_code=404, detail="User is not found")
    return updated

#sadece admin icin kullanici silme
@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    require_admin(current_user)

    success = crud.delete_user(db, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User is not found")

#wallet top up
@router.post("/me/wallet/topup")
def topup_wallet(amount: float, token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    driver = crud.get_driver_by_user_id(db, current_user.user_id)
    driver = crud.update_wallet(db, driver.driver_id, amount)
    crud.create_payment(db, schemas.PaymentCreate(
        driver_id=driver.driver_id,
        amount=amount,
        type="TopUp"
    ))
    return {"wallet_balance": driver.wallet_balance}

#driver ozelliklerini listele
@router.get("/me/driver", response_model=schemas.DriverResponse)
def get_my_driver_profile(token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Only driver can access ")

    driver = crud.get_driver_by_user_id(db, current_user.user_id)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver is not found")

    return driver


# routers/users.py dosyasının en altına ekle:

@router.get("/me/notifications")
def get_my_notifications(token: token_dependency, db: db_dependency):
    current_user = get_current_user(db, token)

    # Kullanıcının en son 10 bildirimini çek
    notifs = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.user_id
    ).order_by(models.Notification.created_at.desc()).limit(10).all()

    return [{"id": n.notification_id, "message": n.message, "time": n.created_at.strftime("%H:%M")} for n in notifs]