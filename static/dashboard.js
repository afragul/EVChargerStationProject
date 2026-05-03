let map;
let directionsService;
let directionsRenderer;
let userLocation = null;

let userVehicles = []; // Kullanıcının araçlarını tutacağımız liste

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
    // Token hiç yoksa direkt login'e at
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "/login";
        return; // Kodun devamını çalıştırma
    }
    await fetchUserVehicles(token); //önce araclari cek

    // Token varsa normal işleyişe devam et
    loadStations();
    getUserLocation();
}

// Araçları arka planda çeken fonksiyon
async function fetchUserVehicles(token) {
    try {
        const response = await fetch('/vehicles/me', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            userVehicles = await response.json();
            console.log("Kullanıcının araçları yüklendi:", userVehicles);
        }
    } catch (error) {
        console.error("Araçlar yüklenirken hata:", error);
    }
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
            console.warn("Oturum süresi dolmuş, çıkış yapılıyor...");
            localStorage.removeItem('token'); // O bozuk anahtarı çöpe at
            window.location.href = "/login";  // Login'e geri gönder
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

            // --- BİLGİ PENCERESİ İÇİN ŞARJ CİHAZLARI LİSTESİ OLUŞTURMA ---
            let chargersHtml = "";

            if (station.chargers && station.chargers.length > 0) {
                station.chargers.forEach(c => {
                    // Kullanıcının araçlarından herhangi birinin soketi bu cihazla uyuşuyor mu?
                    const isCompatible = userVehicles.some(v => v.connector_type === c.connector_type);

                    let actionHtml = "";

                    if (c.status === "available" && isCompatible) {
                        // Soket uyumlu ve cihaz boşsa Buton göster
                        actionHtml = `<button onclick="openReservationModal(${c.charger_id}, '${c.connector_type}')" style="background:#28a745; color:white; border:none; padding:4px 8px; cursor:pointer; border-radius: 4px; font-size: 12px;"> Rezerve Et</button>`;
                    } else if (c.status === "available" && !isCompatible) {
                        // Cihaz boş ama soket uymuyorsa Kırmızı uyarı ver
                        actionHtml = `<span style="color:#d9534f; font-size:12px; font-weight:bold;"> Uyumsuz Soket</span>`;
                    } else {
                        // Cihaz doluysa veya bozuksa durumunu yazdır
                        actionHtml = `<span style="color:#888; font-size:12px;">⏳ ${c.status.toUpperCase()}</span>`;
                    }

                    // Cihazın listeye eklenmesi
                    chargersHtml += `
                        <div style="border-bottom:1px solid #eee; padding:6px 0; display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:13px;"> ${c.power_kW}kW <b>${c.connector_type}</b></span>
                            ${actionHtml}
                        </div>
                    `;
                });
            } else {
                chargersHtml = "<p style='font-size:12px; color:#888;'>Bu istasyonda henüz cihaz yok.</p>";
            }

            // --- INFO WINDOW TASARIMI ---
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="color: #333; padding: 5px; width: 240px;">
                        <b style="font-size: 15px; color:#2c3e50;">${station.name}</b><br>
                        <p style="margin: 4px 0 10px 0; font-size: 12px; color: #7f8c8d;">${station.address}</p>
                        
                        <div style="background:#f8f9fa; padding:8px; border-radius:6px; margin-bottom:10px;">
                            <b style="font-size: 12px; color:#34495e;">ŞARJ CİHAZLARI</b>
                            <div style="margin-top:5px;">
                                ${chargersHtml}
                            </div>
                        </div>

                        <button onclick="window.getDirections(${station.latitude}, ${station.longitude})" style="background:#3498db; color:white; border:none; padding:8px; width:100%; cursor:pointer; border-radius: 4px; font-weight:bold;">📍 Yol Tarifi Çiz</button>
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

// Seçilen şarj cihazının ID'sini hafızada tutmak için global değişken
let selectedChargerId = null;

//  Modalı Açma Fonksiyonu
// Modalı Açma Fonksiyonu
window.openReservationModal = function(chargerId, connectorType) {
    selectedChargerId = chargerId;

    const modal = document.getElementById("reservationModal");
    modal.style.display = "flex";

    // Select kutusunu bul ve içini temizle
    const vehicleSelect = document.getElementById("resVehicle");
    vehicleSelect.innerHTML = "";

    // Uyuşan araçlarımızı filtrele
    const compatibleVehicles = userVehicles.filter(v => v.connector_type === connectorType);

    // Filtrelenen araçları açılır listeye (select) ekle
    compatibleVehicles.forEach(v => {
        const option = document.createElement("option");
        option.value = v.vehicle_id;
        option.text = `${v.brand} ${v.model} (${v.plate_number})`;
        vehicleSelect.appendChild(option);
    });

    const dateInput = document.getElementById("resDate"); // dateInput'u tanımladık!
    const today = new Date().toISOString().split('T')[0];

    dateInput.value = today; // Değeri atadık

    // Tarih değiştiğinde saatleri tekrar yükle
    dateInput.onchange = () => loadSchedule(chargerId, dateInput.value);

    // Modal açılır açılmaz bugünün saatlerini yükle
    loadSchedule(chargerId, today);
};

async function loadSchedule(chargerId, dateStr) {
    const token = localStorage.getItem("token");
    const scheduleBox = document.getElementById("scheduleBox");
    const timesList = document.getElementById("occupiedTimesList");

    try {
        const response = await fetch(`/reservations/charger/${chargerId}/schedule?target_date=${dateStr}`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const reservations = await response.json();
            scheduleBox.style.display = "block"; // Kutuyu görünür yap

            if (reservations.length > 0) {
                // Eğer dolu saat varsa, kutuyu kırmızı yap ve saatleri listele
                scheduleBox.style.background = "#fdf2f2";
                scheduleBox.style.borderColor = "#f5c6c6";
                timesList.innerHTML = reservations.map(r => `⏳ ${r.start_time} - ${r.end_time} arası DOLU`).join("<br>");
            } else {
                // Eğer o gün hiç rezervasyon yoksa, kutuyu yeşil yapıp müjdeyi ver
                scheduleBox.style.background = "#eafaf1";
                scheduleBox.style.borderColor = "#a9dfbf";
                timesList.innerHTML = "<span style='color:#27ae60;'>🎉 Harika! Bu tarihte tüm saatler müsait.</span>";
            }
        }
    } catch(e) {
        console.error("Saatler çekilemedi", e);
    }
}


// Modalı Kapatma Fonksiyonu
window.closeReservationModal = function() {
    document.getElementById("reservationModal").style.display = "none";
};

// Formu Gönderme (Backend'e İstek Atma) Fonksiyonu
window.submitReservation = async function(e) {
    e.preventDefault(); // Sayfanın yenilenmesini engelle

    const token = localStorage.getItem("token");

    // Formdan verileri topla
    const payload = {
        charger_id: selectedChargerId,
        vehicle_id: parseInt(document.getElementById("resVehicle").value),
        date: document.getElementById("resDate").value,
        // Backend saatleri HH:MM:SS formatında bekleyebilir, sonuna :00 ekliyoruz
        start_time: document.getElementById("resStartTime").value + ":00",
        end_time: document.getElementById("resEndTime").value + ":00"
    };

    try {
        const response = await fetch("/reservations/", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            alert(" Rezervasyon başarıyla oluşturuldu!");
            closeReservationModal();
            // Haritayı yenile ki istasyon/cihaz durumları (Dolu/Boş) güncellensin
            loadStations();
        } else {
            // Eğer cüzdanda 100 TL yoksa veya saat çakışıyorsa backend'den gelen hatayı göster
            alert("İşlem Başarısız: " + (data.detail || "Bilinmeyen bir hata oluştu."));
        }
    } catch (err) {
        console.error("Rezervasyon hatası:", err);
        alert("Sunucuya bağlanılamadı.");
    }
};

window.logout = function() {
    localStorage.removeItem('token');
    window.location.href = "/login";
};