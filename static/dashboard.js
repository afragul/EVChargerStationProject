let map;
let directionsService;
let directionsRenderer;
let userLocation = null;
let userVehicles = [];
let favoriteStations = [];
let selectedChargerId = null;

// --- CUSTOM ALERT LOGIC FOR MAP ---
window.showCustomAlert = function(message, title = "Notification") {
    document.getElementById("customAlertTitle").innerText = title;
    document.getElementById("customAlertMessage").innerText = message;
    document.getElementById("customAlertModal").style.display = "flex";
};

window.closeCustomAlert = function() {
    document.getElementById("customAlertModal").style.display = "none";
};

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

    console.log("Google Maps Loaded Successfully!");
    initDashboard();
}

async function initDashboard() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "/login";
        return;
    }
    await fetchUserVehicles(token);
    await fetchFavoriteStations(token);
    loadStations();
    getUserLocation();
}

async function fetchUserVehicles(token) {
    try {
        const response = await fetch('/vehicles/me', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            userVehicles = await response.json();
        }
    } catch (error) {
        console.error("Error loading vehicles:", error);
    }
}

async function fetchFavoriteStations(token) {
    try {
        const response = await fetch('/stations/favorites/me', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            favoriteStations = data.map(s => s.station_id);
        }
    } catch (error) {
        console.error("Error loading favorite stations:", error);
    }
}

async function loadStations() {
    try {
        const token = localStorage.getItem('token');

        // 1. Yol tarifi kilidi için kullanıcının aktif rezervasyonlarını çek
        const resResponse = await fetch('/reservations/me', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const myReservations = resResponse.ok ? await resResponse.json() : [];

        // 2. İstasyonları çek
        const response = await fetch('/stations/', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) return;
        const stations = await response.json();

        stations.forEach(station => {
            let isStationCompatible = false;

            // Kullanıcının bu istasyonda aktif bir rezervasyonu var mı?
            const hasActiveBooking = myReservations.some(res =>
                station.chargers.some(c => c.charger_id === res.charger_id) &&
                (res.status === "active" || res.status === "confirmed")
            );

            let chargersHtml = "";
            station.chargers.forEach(c => {
                const isCompatible = userVehicles.some(v => v.connector_type === c.connector_type);
                if (isCompatible) isStationCompatible = true;

                let actionHtml = "";
                if (c.status === "available" && isCompatible) {
                    actionHtml = `<button onclick="window.openReservationModal(${c.charger_id}, '${c.connector_type}')" style="background:#28a745; color:white; border:none; padding:4px 8px; cursor:pointer; border-radius: 4px; font-size: 11px; font-weight:bold;">Reserve</button>`;
                } else if (!isCompatible) {
                    actionHtml = `<span style="color:#e74c3c; font-size:11px; font-weight:bold;">Incompatible</span>`;
                } else {
                    actionHtml = `<span style="color:#888; font-size:11px; font-weight:bold;">Occupied</span>`;
                }

                chargersHtml += `
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center; border-bottom:1px solid #eee; padding-bottom:4px; color: #2c3e50 !important;">
                        <span style="font-size:12px;">${c.power_kW}kW <b>${c.connector_type}</b></span> 
                        ${actionHtml}
                    </div>`;
            });

            // --- YOL TARİFİ BUTONU MANTIĞI ---
            let directionsBtnHtml = "";
            if (!hasActiveBooking) {
                directionsBtnHtml = `<button onclick="window.showCustomAlert('You must have an active reservation at this station to get directions.', 'Reservation Required')" style="background:#95a5a6; color:white; border:none; padding:12px; width:100%; cursor:not-allowed; border-radius: 8px; font-weight:bold; font-size:13px;">🔒 Reserve to Get Directions</button>`;
            } else {
                directionsBtnHtml = `<button onclick="window.getDirections(${station.latitude}, ${station.longitude})" style="background:#3498db; color:white; border:none; padding:12px; width:100%; cursor:pointer; border-radius: 8px; font-weight:bold; font-size:13px;">📍 Get Directions</button>`;
            }

            const isFavorite = favoriteStations.includes(station.station_id);
            const heartColor = isFavorite ? "#e74c3c" : "#bdc3c7";

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="width:240px; padding:5px; color: #2c3e50 !important; font-family: 'Segoe UI', sans-serif;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <b style="font-size:15px; color: #2c3e50 !important;">${station.name}</b>
                            <i id="h-${station.station_id}" class="fas fa-heart" onclick="window.toggleFavorite(${station.station_id})" style="color:${heartColor}; cursor:pointer; font-size:18px;"></i>
                        </div>
                        <p style="margin: 0 0 10px 0; font-size: 11px; color: #555 !important;">${station.address}</p>
                        
                        <div style="margin-bottom:12px; background:#f8f9fa; padding:10px; border-radius:8px; border: 1px solid #eee;">
                            <label style="font-size:10px; color:#95a5a6; font-weight:bold; display:block; margin-bottom:5px;">CHARGERS</label>
                            ${chargersHtml}
                        </div>
                        ${directionsBtnHtml}
                    </div>`
            });

            const marker = new google.maps.Marker({
                position: { lat: station.latitude, lng: station.longitude },
                map: map,
                icon: "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
            });

            marker.addListener("click", () => {
                infoWindow.open(map, marker);
            });
        });

    } catch (err) {
        console.error("Network error while loading stations:", err);
    }
}

window.toggleFavorite = async function(stationId) {
    const token = localStorage.getItem("token");
    const isFav = favoriteStations.includes(stationId);

    try {
        const response = await fetch(`/stations/${stationId}/favorite`, {
            method: isFav ? "DELETE" : "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            if (isFav) {
                favoriteStations = favoriteStations.filter(id => id !== stationId);
            } else {
                favoriteStations.push(stationId);
            }
            const heart = document.getElementById(`h-${stationId}`);
            if (heart) heart.style.color = isFav ? "#bdc3c7" : "#e74c3c";
        } else {
            const err = await response.json();
            showCustomAlert(err.detail || "Action failed.", "Error");
        }
    } catch (e) {
        console.error("Favorite toggle error:", e);
    }
};

function getUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
            new google.maps.Marker({
                position: userLocation,
                map: map,
                icon: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                title: "Your Location"
            });
            map.setCenter(userLocation);
        });
    }
}

window.getDirections = function(destLat, destLng) {
    if (!userLocation) {
        showCustomAlert("Please allow location access first.", "Location Error");
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
            showCustomAlert("Directions failed: " + status, "Routing Error");
        }
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
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("resDate").value = today;
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
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            window.closeReservationModal();
            window.showCustomAlert("Reservation created successfully!", "Success", () => window.location.reload());
        } else {
            const data = await response.json();
            window.showCustomAlert(data.detail || "Reservation failed.", "Error");
        }
    } catch (err) {
        window.showCustomAlert("Connection error.", "Error");
    }
};

window.logout = function() {
    localStorage.removeItem('token');
    window.location.href = "/login";
};