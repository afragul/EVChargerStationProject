let map;
let directionsService;
let directionsRenderer;
let userLocation = null;

async function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 38.4237, lng: 27.1428 },
        zoom: 12,
        styles: [
            {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }]
            }
        ]
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer();
    directionsRenderer.setMap(map);

    console.log("Google Maps Başarıyla Yüklendi!");
    initDashboard();
}

async function initDashboard() {
    loadStations();
    getUserLocation();
}

async function loadStations() {
    try {
        const token = localStorage.getItem('token');
        console.log("Sunucuya gönderilecek Token:", token); // Bunu konsolda görmeliyiz

        // Token ile beraber Backend'den verileri çekiyoruz
        const response = await fetch('/stations/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status === 401) {
            console.error("Yetkisiz erişim! Lütfen giriş yaptığınızdan emin olun.");
            alert("Oturum süreniz dolmuş veya giriş yapmamışsınız. Lütfen tekrar giriş yapın.");
            return;
        }

        if (!response.ok) {
            console.error("İstasyonlar sunucudan çekilemedi. Hata kodu:", response.status);
            return;
        }

        const stations = await response.json();

        stations.forEach(station => {
            let stationStatus = "offline";
            let hasAvailable = false;
            let hasOccupied = false;

            if (station.chargers && station.chargers.length > 0) {
                station.chargers.forEach(charger => {
                    if (charger.status === "available") hasAvailable = true;
                    if (charger.status === "occupied") hasOccupied = true;
                });

                if (hasAvailable) {
                    stationStatus = "available";
                } else if (hasOccupied) {
                    stationStatus = "occupied";
                }
            } else {
                stationStatus = station.status || "available";
            }

            let markerColor = "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
            if (stationStatus === "occupied") markerColor = "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
            if (stationStatus === "offline") markerColor = "http://maps.google.com/mapfiles/ms/icons/red-dot.png";

            const marker = new google.maps.Marker({
                position: { lat: station.latitude, lng: station.longitude },
                map: map,
                title: station.name,
                icon: markerColor
            });

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="color: #333; padding: 10px; width: 200px;">
                        <b style="font-size: 14px;">${station.name}</b><br>
                        <p style="margin: 5px 0;">${station.address}</p>
                        <p style="margin: 5px 0;"><b>Durum:</b> ${stationStatus === 'available' ? 'Müsait' : (stationStatus === 'occupied' ? 'Dolu' : 'Çevrimdışı')}</p>
                        <button onclick="window.getDirections(${station.latitude}, ${station.longitude})" style="background:#007bff; color:white; border:none; padding:8px; margin-bottom:5px; width:100%; cursor:pointer; border-radius: 4px;">📍 Yol Tarifi Çiz</button>
                        <button onclick="alert('Rezervasyon Sistemi Yapım Aşamasında!')" style="background:#28a745; color:white; border:none; padding:8px; width:100%; cursor:pointer; border-radius: 4px;">⚡ Hemen Rezerve Et</button>
                    </div>
                `
            });

            marker.addListener("click", () => {
                infoWindow.open(map, marker);
            });
        });

        console.log(`${stations.length} adet istasyon başarıyla haritaya yüklendi!`);

    } catch (err) {
        console.error("İstasyon verileri yüklenirken ağ hatası oluştu:", err);
    }
}

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
            };

            new google.maps.Marker({
                position: userLocation,
                map: map,
                icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                title: "Konumunuz"
            });
            map.setCenter(userLocation);
        });
    }
}

window.getDirections = function(destLat, destLng) {
    if (!userLocation) {
        alert("Lütfen önce konum erişimine izin verin.");
        return;
    }

    const request = {
        origin: userLocation,
        destination: { lat: destLat, lng: destLng },
        travelMode: 'DRIVING'
    };

    directionsService.route(request, function(result, status) {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
        } else {
            alert("Rota hesaplanamadı. Hata: " + status);
        }
    });
};

window.logout = function() {
    localStorage.removeItem('token');
    window.location.href = "/login";
};