from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
import os
from dotenv import load_dotenv

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

load_dotenv()
models.Base.metadata.create_all(bind=engine) # Veritabanı tablolarını oluşturur

app=FastAPI(
    title="EV Charging Station Network Management System",
    description="Fundamentals of Software Engineering (Group 22) - EV Şarj İstasyonu Yönetim Sistemi API'si",
    version="1.0.0"
)

# Statik dosyaları (JS/CSS) sisteme tanıtma
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


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

@app.get("/welcome", tags=["Root"])
def root():
    return {
        "message": "EV Charging Station API'sine Hoş Geldiniz!",
        "docs_url": "/docs",
        "project_team": "Group 22"
    }


#Harita burada yüklenecek
@app.get("/")
async def read_root(request: Request):
    api_key=os.getenv("GOOGLE_API_KEY")
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"google_maps_api_key" : api_key}
    )

# login için
@app.get("/login")
async def get_login(request: Request):
    return templates.TemplateResponse(request=request, name="login.html")

#reg için
@app.get("/register")
async def get_register(request: Request):
    return templates.TemplateResponse(request=request, name="register.html")

#profil için
@app.get("/profile")
async def get_profile(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="profile.html",
        context={}
    )

#operator apply icin gerekli
@app.get("/operator-apply", response_class=HTMLResponse)
async def operator_apply_page(request: Request):
    return templates.TemplateResponse(request=request, name="operator_apply.html")