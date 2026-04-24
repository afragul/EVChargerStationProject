from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Annotated
from pydantic import BaseModel
from database import SessionLocal
import crud, models, os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY=os.getenv("SECRET_KEY")
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


router = APIRouter(prefix="/auth", tags=["Auth"])

# --- Dependency ve Context'ler ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]
oauth2_bearer = OAuth2PasswordBearer(tokenUrl="/auth/login")

class Token(BaseModel):
    access_token: str
    token_type: str


#token üretildi
def create_access_token(user_id: int, role: str) -> str: #yardimci fonk
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(db: Annotated[Session, Depends(get_db)], token: Annotated[str, Depends(oauth2_bearer)]):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        role=payload.get("role")
        if user_id is None:
            raise HTTPException(status_code=404, detail="User not found")
    except JWTError:
        raise HTTPException(status_code=404, detail="Invalid token")

    user= crud.get_user(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

user_dep=Annotated[models.User, Depends(get_current_user)]

#rol kontrolleri

def require_admin(current_user: models.User):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return current_user

def require_operator(current_user: models.User):
    if current_user.role != "operator":
        raise HTTPException(status_code=403, detail="Forbidden")
    return current_user

def require_driver(current_user: models.User):
    if current_user.role != "driver":
        raise HTTPException(status_code=403, detail="Forbidden")
    return current_user


#endpointler

@router.post("/login" , response_model=Token)
def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: db_dependency):
    user = crud.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail="Email veya şifre hatalı")

    token = create_access_token(user.user_id, user.role)
    return {"access_token": token, "token_type": "bearer"}
