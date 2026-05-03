from database import SessionLocal
from models import Station, Charger


def seed_stations():
    db = SessionLocal()

    # Eğer daha önce eklenmiş test verileri varsa çakışmaması için kontrol edilebilir
    if db.query(Station).count() > 0:
        print("Veri tabanında zaten istasyonlar var. İşlem iptal edildi.")
        return

    stations_data = [
        {
            "name": "Ege Üniversitesi Kampüs Şarj Noktası",
            "address": "Ege Üniversitesi Kütüphane Otoparkı, Bornova/İzmir",
            "latitude": 38.4552,
            "longitude": 27.2154,
            "operating_hours": "24/7",
            "chargers": [
                {"type": "AC", "power_kW": 22, "connector_type": "Type 2", "price_per_kWh": 7.5, "status": "available"},
                {"type": "DC", "power_kW": 50, "connector_type": "CCS", "price_per_kWh": 10.0, "status": "occupied"}
            ]
        },
        {
            "name": "Forum Bornova AVM",
            "address": "Kazımdirik, 372. Sk., 35100 Bornova/İzmir",
            "latitude": 38.4475,
            "longitude": 27.2100,
            "operating_hours": "10:00 - 22:00",
            "chargers": [
                {"type": "DC", "power_kW": 150, "connector_type": "CCS", "price_per_kWh": 12.5, "status": "available"},
                {"type": "DC", "power_kW": 50, "connector_type": "CHAdeMO", "price_per_kWh": 10.0, "status": "offline"}
            ]
        },
        {
            "name": "Alsancak Gar Otopark",
            "address": "Alsancak, Atatürk Cd., 35220 Konak/İzmir",
            "latitude": 38.4380,
            "longitude": 27.1450,
            "operating_hours": "24/7",
            "chargers": [
                {"type": "AC", "power_kW": 22, "connector_type": "Type 2", "price_per_kWh": 7.5, "status": "occupied"},
                {"type": "DC", "power_kW": 120, "connector_type": "CCS", "price_per_kWh": 11.5, "status": "available"},
                {"type": "DC", "power_kW": 120, "connector_type": "CCS", "price_per_kWh": 11.5, "status": "available"}
            ]
        },
        {
            "name": "Bostanlı Sahil Şarj",
            "address": "Bostanlı, Hasan Ali Yücel Blv., 35590 Karşıyaka/İzmir",
            "latitude": 38.4555,
            "longitude": 27.0950,
            "operating_hours": "24/7",
            "chargers": [
                {"type": "AC", "power_kW": 22, "connector_type": "Type 2", "price_per_kWh": 7.5, "status": "available"},
                {"type": "DC", "power_kW": 50, "connector_type": "CHAdeMO", "price_per_kWh": 10.0,
                 "status": "available"}
            ]
        },
        {
            "name": "İstinyePark Balçova",
            "address": "Bahçelerarası, Şehit Binbaşı Ali Resmi Tufan Cd., 35330 Balçova/İzmir",
            "latitude": 38.3900,
            "longitude": 27.0300,
            "operating_hours": "10:00 - 22:00",
            "chargers": [
                {"type": "DC", "power_kW": 150, "connector_type": "CCS", "price_per_kWh": 12.5, "status": "occupied"},
                {"type": "AC", "power_kW": 22, "connector_type": "Type 2", "price_per_kWh": 7.5, "status": "available"}
            ]
        },
        {
            "name": "Folkart Towers Bayraklı",
            "address": "Adalet, Manas Blv., 35530 Bayraklı/İzmir",
            "latitude": 38.4520,
            "longitude": 27.1750,
            "operating_hours": "24/7",
            "chargers": [
                {"type": "DC", "power_kW": 120, "connector_type": "CCS", "price_per_kWh": 11.5, "status": "offline"},
                {"type": "AC", "power_kW": 22, "connector_type": "Type 2", "price_per_kWh": 8.0, "status": "occupied"}
            ]
        },
        {
            "name": "Optimum AVM Gaziemir",
            "address": "Binbaşı Reşatbey, Akçay Cd., 35410 Gaziemir/İzmir",
            "latitude": 38.3300,
            "longitude": 27.1400,
            "operating_hours": "10:00 - 22:00",
            "chargers": [
                {"type": "DC", "power_kW": 50, "connector_type": "CCS", "price_per_kWh": 10.0, "status": "available"},
                {"type": "DC", "power_kW": 50, "connector_type": "CHAdeMO", "price_per_kWh": 10.0,
                 "status": "available"}
            ]
        },
        {
            "name": "Şirinyer İzban Otoparkı",
            "address": "İnkılap, Aydın Hatboyu Cd., 35380 Buca/İzmir",
            "latitude": 38.3800,
            "longitude": 27.1450,
            "operating_hours": "24/7",
            "chargers": [
                {"type": "AC", "power_kW": 22, "connector_type": "Type 2", "price_per_kWh": 7.0, "status": "available"},
                {"type": "AC", "power_kW": 22, "connector_type": "Type 2", "price_per_kWh": 7.0, "status": "occupied"}
            ]
        }
    ]

    for s_data in stations_data:
        # İstasyonu ekle
        new_station = Station(
            name=s_data["name"],
            address=s_data["address"],
            latitude=s_data["latitude"],
            longitude=s_data["longitude"],
            operating_hours=s_data["operating_hours"]
        )
        db.add(new_station)
        db.commit()
        db.refresh(new_station)  # station_id'sini almak için refresh yapıyoruz

        # İstasyona ait şarj cihazlarını ekle
        for c_data in s_data["chargers"]:
            new_charger = Charger(
                station_id=new_station.station_id,
                type=c_data["type"],
                power_kW=c_data["power_kW"],
                connector_type=c_data["connector_type"],
                price_per_kWh=c_data["price_per_kWh"],
                status=c_data["status"]
            )
            db.add(new_charger)

        db.commit()

    print("✅ 8 Adet İstasyon ve 17 Adet Şarj Ünitesi başarıyla veri tabanına eklendi!")
    db.close()


if __name__ == "__main__":
    seed_stations()