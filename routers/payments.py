from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import schemas
import crud
import models
from database import get_db

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("/topup", response_model=schemas.PaymentResponse)
def topup_wallet(payment_in: schemas.PaymentCreate, db: Session = Depends(get_db)):
    """Sürücünün cüzdanına bakiye yükler (TopUp)"""
    if payment_in.type != schemas.PaymentType.topup:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment type for TopUp")

    driver = crud.get_driver(db, payment_in.driver_id)
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")

    # Cüzdana bakiyeyi ekle
    crud.update_wallet(db, payment_in.driver_id, payment_in.amount)

    # İşlem kaydını (Payment) oluştur
    return crud.create_payment(db, payment_in)


@router.post("/process-charge", response_model=schemas.PaymentResponse)
def process_charging_payment(payment_in: schemas.PaymentCreate, db: Session = Depends(get_db)):
    """Şarj işlemi bittiğinde cüzdandan ücreti keser (Use Case 3)"""
    if payment_in.type != schemas.PaymentType.charge:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payment type for Charge")

    driver = crud.get_driver(db, payment_in.driver_id)
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")

    # Bakiye kontrolü
    if driver.wallet_balance < payment_in.amount:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient wallet balance")

    # Cüzdandan bakiyeyi düş
    crud.update_wallet(db, payment_in.driver_id, -payment_in.amount)

    return crud.create_payment(db, payment_in)


@router.get("/driver/{driver_id}", response_model=List[schemas.PaymentResponse])
def get_driver_payments(driver_id: int, db: Session = Depends(get_db)):
    """Sürücünün geçmiş ödeme/yükleme işlemlerini getirir (REQ-D08)"""
    driver = crud.get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Driver not found")

    return crud.get_payments_by_driver(db, driver_id)