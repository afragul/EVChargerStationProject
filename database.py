import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("❌ DATABASE_URL environment variable is not set")

engine = create_engine(
    DATABASE_URL,
    pool_size=10,           # Normal yük için uygun bir havuz boyutu
    max_overflow=20,        # Havuz dolduğunda ek bağlantı limiti
    pool_pre_ping=True,     # Bağlantı geçerliliğini kontrol et (kopuk bağlantıları önler)
    echo=False              # SQL loglarını görmek için True yapılabilir (geliştirme ortamında)
)

# SessionLocal fabrikası: her istek için yeni bir veritabanı oturumu oluşturur
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Tüm ORM modellerinin miras alacağı temel sınıf
Base = declarative_base()

# FastAPI bağımlılığı (dependency) olarak kullanılacak veritabanı oturumu üretici
def get_db():
    """
    Her HTTP isteği için bir veritabanı oturumu oluşturur,
    istek bittiğinde oturumu otomatik olarak kapatır.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
