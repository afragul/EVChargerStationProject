let map;
let directionsService;
let directionsRenderer;
let userLocation = null;
let userVehicles = [];
let favoriteStations = [];
let selectedChargerId = null;

// GİRİŞ YAPAN KULLANICININ BİLGİLERİ (Sürücü mü, Operatör mü?)
let currentUserRole = "driver";
let currentUserId = null;

// --- CUSTOM ALERT LOGIC FOR MAP ---
let alertCallback = null; // Alert kapandıktan sonra tetiklenecek fonksiyon

window.showCustomAlert = function(message, title = "Notification", cb = null) {
    document.getElementById("customAlertTitle").innerText = title;
    document.getElementById("customAlertMessage").innerText = message;
    document.getElementById("customAlertModal").style.display = "flex";
    alertCallback = cb; // Fonksiyonu kaydet
};

window.closeCustomAlert = function() {
    document.getElementById("customAlertModal").style.display = "none";
    if(alertCallback) {
        alertCallback(); // Modal kapanırken fonksiyonu çalıştır (Örn: sayfayı yenile)
        alertCallback = null;
    }
};

async function initMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: { lat: 38.4237, lng: 27.1428 }, // İzmir Merkez
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

    console.log("Google Maps Loaded Successfully!");
    initDashboard();
}

async function initDashboard() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "/login";
        return;
    }

    // 1. Önce giriş yapan kullanıcının kim olduğunu (Rolünü) bulalım
    try {
        const userRes = await fetch('/users/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (userRes.ok) {
            const user = await userRes.json();
            currentUserRole = user.role;
            currentUserId = user.user_id;
            // Welcome mesajını isme göre güncelle
            const welcomeTag = document.getElementById("welcomeMessage");
            if(welcomeTag) welcomeTag.innerText = `Welcome, ${user.name} (${user.role.toUpperCase()})`;
        }
    } catch (error) { console.error("User information could not be retrieved.:", error); }

    // 2. Sadece rolü 'driver' olanlar için araç ve favorileri çekelim (403 Hatalarını Önler)
    if (currentUserRole === 'driver') {
        await fetchUserVehicles(token);
        await fetchFavoriteStations(token);
    }

    loadStations();
    getUserLocation();
}

async function fetchUserVehicles(token) {
    try {
        const response = await fetch('/vehicles/me', { method: 'GET', headers: { 'Authorization': `Bearer ${token}` }});
        if (response.ok) userVehicles = await response.json();
    } catch (error) { console.error(error); }
}

async function fetchFavoriteStations(token) {
    try {
        const response = await fetch('/stations/favorites/me', { method: 'GET', headers: { 'Authorization': `Bearer ${token}` }});
        if (response.ok) favoriteStations = (await response.json()).map(s => s.station_id);
    } catch (error) { console.error(error); }
}

async function loadStations() {
    try {
        const token = localStorage.getItem('token');

        // Sadece Sürücü ise rezervasyonlarını çek (Yol tarifi kilidi için)
        let myReservations = [];
        if (currentUserRole === 'driver') {
            const resResponse = await fetch('/reservations/me', { method: 'GET', headers: { 'Authorization': `Bearer ${token}` }});
            if (resResponse.ok) myReservations = await resResponse.json();
        }

        // İstasyonları çek
        const response = await fetch('/stations/', { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
        if (!response.ok) return;
        const stations = await response.json();

        stations.forEach(station => {
            let isStationCompatible = false;

            // Sürücünün aktif rezervasyonu var mı kontrolü
            const hasActiveBooking = myReservations.some(res =>
                station.chargers.some(c => c.charger_id === res.charger_id) &&
                (res.status === "active" || res.status === "confirmed")
            );

            // Cihazlar Listesi
            let chargersHtml = "";
            // dashboard.js içindeki chargersHtml döngüsü (yaklaşık 120. satır)
// dashboard.js içindeki chargersHtml döngüsü
stations.forEach(station => {
            let isStationCompatible = false;

            // Sürücünün aktif rezervasyonu var mı kontrolü
            const hasActiveBooking = myReservations.some(res =>
                station.chargers.some(c => c.charger_id === res.charger_id) &&
                (res.status === "active" || res.status === "confirmed")
            );

            // Cihazlar Listesi
            let chargersHtml = "";
            station.chargers.forEach(c => {
                const isCompatible = currentUserRole === 'driver' ? userVehicles.some(v => v.connector_type === c.connector_type) : false;
                if (isCompatible) isStationCompatible = true;

                let actionHtml = "";
                if (currentUserRole === 'driver') {
                    // Rapor Simgesi
                    const reportIcon = `<i class="fas fa-exclamation-triangle" 
                                           onclick="window.openIssueModal('${c.charger_id}')" 
                                           style="color:#f39c12; cursor:pointer; margin-right:12px; font-size:16px; position:relative; z-index:9999;"></i>`;

                    if (!isCompatible) {
                        // 1. Araç ile cihaz UYUMSUZ
                        actionHtml = `<div style="display:flex; align-items:center;">${reportIcon}<span style="color:#e74c3c; font-size:11px; font-weight:bold;">Incompatible</span></div>`;
                    } else if (c.status === "available") {
                        // 2. Cihaz BOŞ ve UYUMLU (Rezervasyon Yapılabilir)
                        actionHtml = `<div style="display:flex; align-items:center;">${reportIcon}<button onclick="window.openReservationModal(${c.charger_id}, '${c.connector_type}')" style="background:#28a745; color:white; border:none; padding:4px 8px; cursor:pointer; border-radius: 4px; font-size: 11px; font-weight:bold;">Reserve</button></div>`;
                    } else if (c.status === "offline") {
                        // 3. Cihaz ARIZALI veya DEVRE DIŞI
                        actionHtml = `<div style="display:flex; align-items:center;">${reportIcon}<span style="color:#c0392b; font-size:11px; font-weight:bold;">🔴 Offline</span></div>`;
                    } else {
                        // 4. Cihaz DOLU (Occupied)
                        actionHtml = `<div style="display:flex; align-items:center;">${reportIcon}<span style="color:#f39c12; font-size:11px; font-weight:bold;">🟡 Occupied</span></div>`;
                    }
                } else {
                    const statColor = c.status === 'available' ? '#2ecc71' : (c.status === 'occupied' ? '#f39c12' : '#e74c3c');
                    actionHtml = `<span style="color:${statColor}; font-size:11px; font-weight:bold;">${c.status.toUpperCase()}</span>`;
                }

                chargersHtml += `
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center; border-bottom:1px solid #eee; padding-bottom:4px; color: #2c3e50 !important;">
                        <span style="font-size:12px;">${c.power_kW}kW <b>${c.connector_type}</b></span> 
                        ${actionHtml}
                    </div>`;
            });

            // Alt Kısım Butonları (Rol'e Göre Değişir)
            let actionSectionHtml = "";
            let heartHtml = "";

            if (currentUserRole === "operator") {
                // OPERATÖR GÖRÜNÜMÜ: İstasyon Talep Etme Mantığı (YENİ)
                if (!station.operator_id && !station.requested_operator_id) {
                    // Tamamen boşta
                    actionSectionHtml = `
                        <button onclick="window.claimStation(${station.station_id})" style="background:#f39c12; color:white; border:none; padding:12px; width:100%; cursor:pointer; border-radius: 8px; font-weight:bold; font-size:13px; margin-top:5px; transition:0.3s; box-shadow: 0 4px 6px rgba(243, 156, 18, 0.3);">
                            ⚡ Request Station Claim
                        </button>`;
                } else if (station.operator_id === currentUserId) {
                    // Admin onaylamış, istasyon operatöre geçmiş
                    actionSectionHtml = `<div style="margin-top:10px; text-align:center; font-size:12px; color:#2ecc71; font-weight:bold; padding:8px; background:rgba(46, 204, 113, 0.1); border-radius:8px;">✅ Managed by You</div>`;
                } else if (station.requested_operator_id === currentUserId) {
                    // Operatör talep etmiş, admin onayı bekliyor
                    actionSectionHtml = `<div style="margin-top:10px; text-align:center; font-size:12px; color:#f39c12; font-weight:bold; padding:8px; background:rgba(243, 156, 18, 0.1); border-radius:8px;">⏳ Claim Request Pending</div>`;
                } else {
                    // Başkasına ait veya başkası talep etmiş
                    actionSectionHtml = `<div style="margin-top:10px; text-align:center; font-size:12px; color:#e74c3c; font-weight:bold; padding:8px; background:rgba(231, 76, 60, 0.1); border-radius:8px;">🔒 Unavailable</div>`;
                }
            } else if (currentUserRole === "driver") {
                // SÜRÜCÜ GÖRÜNÜMÜ: Yol Tarifi ve Favori Ekleme Mantığı (AYNI KALIYOR)
                const isFavorite = favoriteStations.includes(station.station_id);
                const heartColor = isFavorite ? "#e74c3c" : "#bdc3c7";
                heartHtml = `<i id="h-${station.station_id}" class="fas fa-heart" onclick="window.toggleFavorite(${station.station_id})" style="color:${heartColor}; cursor:pointer; font-size:18px;"></i>`;

                if (!hasActiveBooking) {
                    actionSectionHtml = `<button onclick="window.showCustomAlert('You must have an active reservation at this station to get directions.', 'Reservation Required')" style="background:#95a5a6; color:white; border:none; padding:12px; width:100%; cursor:not-allowed; border-radius: 8px; font-weight:bold; font-size:13px;">🔒 Reserve to Get Directions</button>`;
                } else {
                    actionSectionHtml = `<button onclick="window.getDirections(${station.latitude}, ${station.longitude})" style="background:#3498db; color:white; border:none; padding:12px; width:100%; cursor:pointer; border-radius: 8px; font-weight:bold; font-size:13px;">📍 Get Directions</button>`;
                }
            }

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="width:240px; padding:5px; color: #2c3e50 !important; font-family: 'Segoe UI', sans-serif;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <b style="font-size:15px; color: #2c3e50 !important;">${station.name}</b>
                            ${heartHtml}
                        </div>
                        <p style="margin: 0 0 10px 0; font-size: 11px; color: #555 !important;">${station.address}</p>
                        
                        <div style="margin-bottom:12px; background:#f8f9fa; padding:10px; border-radius:8px; border: 1px solid #eee;">
                            <label style="font-size:10px; color:#95a5a6; font-weight:bold; display:block; margin-bottom:5px;">CHARGERS</label>
                            ${chargersHtml}
                        </div>
                        ${actionSectionHtml}
                    </div>`
            });

            // Marker Renkleri (Sarı: Tamamen boş istasyon)
            let iconUrl = "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
            if (currentUserRole === 'operator' && !station.operator_id && !station.requested_operator_id) {
                iconUrl = "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
            } else if (currentUserRole === 'operator' && station.operator_id === currentUserId) {
                iconUrl = "http://maps.google.com/mapfiles/ms/icons/blue-dot.png";
            } else if (currentUserRole === 'operator' && station.requested_operator_id === currentUserId) {
                iconUrl = "http://maps.google.com/mapfiles/ms/icons/orange-dot.png"; // Onay bekleyen istasyon turuncu görünür
            }

            const marker = new google.maps.Marker({
                position: { lat: station.latitude, lng: station.longitude },
                map: map,
                icon: iconUrl
            });

            marker.addListener("click", () => infoWindow.open(map, marker));
        });
            // Alt Kısım Butonları (Rol'e Göre Değişir)
            let actionSectionHtml = "";
            let heartHtml = "";

            if (currentUserRole === "operator") {
                // OPERATÖR GÖRÜNÜMÜ: İstasyon Alma Mantığı
                if (!station.operator_id) {
                    actionSectionHtml = `
                        <button onclick="window.claimStation(${station.station_id})" style="background:#f39c12; color:white; border:none; padding:12px; width:100%; cursor:pointer; border-radius: 8px; font-weight:bold; font-size:13px; margin-top:5px; transition:0.3s; box-shadow: 0 4px 6px rgba(243, 156, 18, 0.3);">
                            ⚡ Claim Station
                        </button>`;
                } else if (station.operator_id === currentUserId) {
                    actionSectionHtml = `<div style="margin-top:10px; text-align:center; font-size:12px; color:#2ecc71; font-weight:bold; padding:8px; background:rgba(46, 204, 113, 0.1); border-radius:8px;">✅ Managed by You</div>`;
                } else {
                    actionSectionHtml = `<div style="margin-top:10px; text-align:center; font-size:12px; color:#e74c3c; font-weight:bold; padding:8px; background:rgba(231, 76, 60, 0.1); border-radius:8px;">🔒 Managed by another operator</div>`;
                }
            } else if (currentUserRole === "driver") {
                // SÜRÜCÜ GÖRÜNÜMÜ: Yol Tarifi ve Favori Ekleme Mantığı
                const isFavorite = favoriteStations.includes(station.station_id);
                const heartColor = isFavorite ? "#e74c3c" : "#bdc3c7";
                heartHtml = `<i id="h-${station.station_id}" class="fas fa-heart" onclick="window.toggleFavorite(${station.station_id})" style="color:${heartColor}; cursor:pointer; font-size:18px;"></i>`;

                if (!hasActiveBooking) {
                    actionSectionHtml = `<button onclick="window.showCustomAlert('You must have an active reservation at this station to get directions.', 'Reservation Required')" style="background:#95a5a6; color:white; border:none; padding:12px; width:100%; cursor:not-allowed; border-radius: 8px; font-weight:bold; font-size:13px;">🔒 Reserve to Get Directions</button>`;
                } else {
                    actionSectionHtml = `<button onclick="window.getDirections(${station.latitude}, ${station.longitude})" style="background:#3498db; color:white; border:none; padding:12px; width:100%; cursor:pointer; border-radius: 8px; font-weight:bold; font-size:13px;">📍 Get Directions</button>`;
                }
            }

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="width:240px; padding:5px; color: #2c3e50 !important; font-family: 'Segoe UI', sans-serif;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <b style="font-size:15px; color: #2c3e50 !important;">${station.name}</b>
                            ${heartHtml}
                        </div>
                        <p style="margin: 0 0 10px 0; font-size: 11px; color: #555 !important;">${station.address}</p>
                        
                        <div style="margin-bottom:12px; background:#f8f9fa; padding:10px; border-radius:8px; border: 1px solid #eee;">
                            <label style="font-size:10px; color:#95a5a6; font-weight:bold; display:block; margin-bottom:5px;">CHARGERS</label>
                            ${chargersHtml}
                        </div>
                        ${actionSectionHtml}
                    </div>`
            });

            // Marker Renkleri (Sarı: Operatör için boş İstasyon)
            let iconUrl = "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
            if (currentUserRole === 'operator' && !station.operator_id) {
                iconUrl = "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
            } else if (currentUserRole === 'operator' && station.operator_id === currentUserId) {
                iconUrl = "http://maps.google.com/mapfiles/ms/icons/blue-dot.png";
            }

            const marker = new google.maps.Marker({
                position: { lat: station.latitude, lng: station.longitude },
                map: map,
                icon: iconUrl
            });

            marker.addListener("click", () => infoWindow.open(map, marker));
        });

    } catch (err) {
        console.error("Network error while loading stations:", err);
    }
}

// YENİ: OPERATÖR İÇİN İSTASYONU ÜZERİNE ALMA FONKSİYONU
window.claimStation = async function(stationId) {
    const token = localStorage.getItem("token");
    try {
        const response = await fetch(`/operators/stations/${stationId}/claim`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            window.showCustomAlert("This station has been successfully added to your management panel!", "Station Claimed ⚡", () => window.location.reload());
        } else {
            const data = await response.json();
            window.showCustomAlert(data.detail || "Failed to claim station.", "Error");
        }
    } catch (e) {
        window.showCustomAlert("Connection error.", "Error");
    }
};

window.toggleFavorite = async function(stationId) {
    const token = localStorage.getItem("token");
    const isFav = favoriteStations.includes(stationId);
    try {
        const response = await fetch(`/stations/${stationId}/favorite`, {
            method: isFav ? "DELETE" : "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
            if (isFav) favoriteStations = favoriteStations.filter(id => id !== stationId);
            else favoriteStations.push(stationId);

            const heart = document.getElementById(`h-${stationId}`);
            if (heart) heart.style.color = isFav ? "#bdc3c7" : "#e74c3c";
        }
    } catch (e) { console.error(e); }
};

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
            new google.maps.Marker({
                position: userLocation, map: map,
                icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png", title: "Your Location"
            });
            map.setCenter(userLocation);
        });
    }
}

window.getDirections = function(destLat, destLng) {
    if (!userLocation) { window.showCustomAlert("Please allow location access first.", "Location Error"); return; }
    const request = { origin: userLocation, destination: { lat: destLat, lng: destLng }, travelMode: 'DRIVING' };
    directionsService.route(request, function(result, status) {
        if (status === 'OK') directionsRenderer.setDirections(result);
        else window.showCustomAlert("Directions failed: " + status, "Routing Error");
    });
};

window.openReservationModal = function(chargerId, connectorType) {
    selectedChargerId = chargerId;
    const modal = document.getElementById("reservationModal");
    modal.style.display = "flex";

    const vehicleSelect = document.getElementById("resVehicle");
    vehicleSelect.innerHTML = "";
    const compatibleVehicles = userVehicles.filter(v => v.connector_type === connectorType);

    if (compatibleVehicles.length === 0) {
        vehicleSelect.innerHTML = "<option disabled selected>No compatible vehicle</option>";
    } else {
        compatibleVehicles.forEach(v => {
            const o = document.createElement("option");
            o.value = v.vehicle_id;
            o.text = `${v.brand} ${v.model} (${v.plate_number})`;
            vehicleSelect.appendChild(o);
        });
    }
    document.getElementById("resDate").value = new Date().toISOString().split('T')[0];
};

window.closeReservationModal = () => document.getElementById("reservationModal").style.display = "none";

window.submitReservation = async function(e) {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const payload = {
        charger_id: selectedChargerId,
        vehicle_id: parseInt(document.getElementById("resVehicle").value),
        date: document.getElementById("resDate").value,
        start_time: document.getElementById("resStartTime").value + ":00",
        end_time: document.getElementById("resEndTime").value + ":00"
    };

    try {
        const response = await fetch("/reservations/", {
            method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            window.closeReservationModal();
            window.showCustomAlert("Reservation created successfully!", "Success", () => window.location.reload());
        } else {
            const data = await response.json();
            window.showCustomAlert(data.detail || "Reservation failed.", "Error");
        }
    } catch (err) { window.showCustomAlert("Connection error.", "Error"); }
};

window.logout = function() {
    localStorage.removeItem('token');
    window.location.href = "/login";
};