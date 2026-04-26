from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Modüllerimizi import ediyoruz
import models
from database import engine
from routers import (
    auth,
    admin,
    chargers,
    charging_sessions,
    issue_reports,
    operators,
    payments,
    reservations,
    stations,
    users,
    vehicles
)

models.Base.metadata.create_all(bind=engine) # Veritabanı tablolarını oluşturur

app=FastAPI(
    title="EV Charging Station Network Management System",
    description="Fundamentals of Software Engineering (Group 22) - EV Şarj İstasyonu Yönetim Sistemi API'si",
    version="1.0.0"
)

app.add_middleware( # front ile baglamak icin cors ayarlari
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(chargers.router)
app.include_router(charging_sessions.router)
app.include_router(issue_reports.router)
app.include_router(operators.router)
app.include_router(payments.router)
app.include_router(reservations.router)
app.include_router(stations.router)
app.include_router(users.router)
app.include_router(vehicles.router)

@app.get("/", tags=["Root"])
def root():
    return {
        "message": "EV Charging Station API'sine Hoş Geldiniz!",
        "docs_url": "/docs",
        "project_team": "Group 22"
    }