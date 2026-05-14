# EV Charging Station Management System 

A backend API project developed with **FastAPI** for managing electric vehicle charging stations, chargers, reservations, operators, and users.
The system is built using **PostgreSQL**, **SQLAlchemy**, and **Alembic** with a modular RESTful architecture.

---

## 📌 Project Overview

This project provides APIs for:

* 👤 User management
* 🔐 Authentication & authorization
* ⚡ Charger management
* 🏢 Operator management
* 📍 Charging station management
* 📅 Reservation handling

The application is designed to simulate a real-world EV charging station management platform.

---

## 🚀 Technologies Used

### Backend

* Python
* FastAPI
* Uvicorn
* Jinja2

### Database & ORM

* PostgreSQL
* SQLAlchemy
* Alembic
* Neon Tech

### Authentication & Security

* JWT Authentication
* Bcrypt
* Python-JOSE

### Validation & Configuration

* Pydantic
* python-dotenv

---

## 📂 Project Structure

```bash id="h0m4rr"
EVChargerStationProject/
├── main.py
├── database.py
├── crud.py
├── models.py
├── schemas.py
├── seed_data.py
├── requirements.txt
├── alembic/
├── alembic.ini
├── routers/
│   ├── auth.py
│   ├── admin.py
│   ├── chargers.py
│   ├── charging_sessions.py
│   ├── issue_reports.py
│   ├── operators.py
│   ├── payments.py
│   ├── reservations.py
│   ├── stations.py
│   ├── users.py
│   └── vehicles.py
├── templates/
│   ├── index.html
│   ├── login.html
│   ├── profile.html
│   ├── register.html
│   └── operator_apply.html
├── static/
│   ├── auth.js
│   ├── dashboard.js
│   ├── script.js
│   └── style.css
└── venv/
```

---

## ✨ Features

* JWT-based authentication
* Secure password hashing with Bcrypt
* User registration and login
* Charging station management
* Charger management
* Operator management
* Reservation system
* PostgreSQL database integration
* Database migration support with Alembic
* Automatic API documentation with Swagger UI

---

## ⚙️ Installation

### 1️⃣ Clone the repository

```bash id="j6f9zt"
git clone https://github.com/afragul/EVChargerStationProject.git
```

### 2️⃣ Navigate to the project directory

```bash id="1lmvkg"
cd EVChargerStationProject
```

---

### 3️⃣ Create a virtual environment

#### Windows

```bash id="5v5b1i"
python -m venv venv
venv\Scripts\activate
```

#### macOS / Linux

```bash id="mn1vst"
python3 -m venv venv
source venv/bin/activate
```

---

### 4️⃣ Install dependencies

```bash id="dh1v7d"
pip install -r requirements.txt
```

---

### 5️⃣ Configure environment variables

Create a `.env` file:

```env id="9l29rz"
DATABASE_URL=your_neon_database_url
SECRET_KEY=your_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

---

## ▶️ Running the Project

Run the FastAPI server:

```bash id="m2k3oh"
uvicorn app.main:app --reload
```

The application will run at:

```bash id="0xumlk"
http://127.0.0.1:8000
```

---

## 📖 API Documentation

### Swagger UI

```bash id="8br90w"
http://127.0.0.1:8000/docs
```

### ReDoc

```bash id="e7vbjlwm"
http://127.0.0.1:8000/redoc
```

---

## 🗄️ Database Migration

### Create migration

```bash id="07g9a4"
alembic revision --autogenerate -m "Initial migration"
```

### Apply migrations

```bash id="j5b8a4"
alembic upgrade head
```

---

## 🔒 Security Features

* JWT token authentication
* Password hashing with Bcrypt
* Protected API endpoints
* Environment variable configuration

---

## 👩‍💻 Developers

Developed as a course project by:

* [Afragül Tığ](https://github.com/afragul)
* [Sinem Ezgi Kurnaz](https://github.com/sinezgi)
* [Emine Sude Afacan](https://github.com/sudeafacan)
* [Ülkü Bakışkan](https://github.com/ulkubakiskan)

---

## ⭐ Repository

[EV Charging Station Project Repository](https://github.com/afragul/EVChargerStationProject)
