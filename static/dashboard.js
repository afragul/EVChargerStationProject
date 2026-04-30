//Haritayı İzmir merkezli başlatma
var map = L.map('map').setView([38.4237, 27.1428], 13);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© CARTO',
    maxZoom: 20
}).addTo(map);

async function initDashboard() {
    const token = localStorage.getItem('token');

    //giriş kontrolü token yoksa logine at
    if (!token) {
        window.location.href = "/login";
        return;
    }

    try {
        //kullanıcı bilgilerini çek
        const userRes = await fetch('/users/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (userRes.ok) {
            const userData = await userRes.json();
            const welcomeElement = document.getElementById('welcomeMessage');
            if (welcomeElement) {
                welcomeElement.innerText = `Welcome, ${userData.name}`;
            }
        } else {
            logout();
        }

        //istasyonları haritaya ekle
        loadStations();

    } catch (error) {
        console.error("Dashboard error:", error);
    }
}

async function loadStations() {
    try {
        const response = await fetch('/stations/');
        if (response.ok) {
            const stations = await response.json();
            stations.forEach(station => {
                L.marker([station.latitude, station.longitude])
                    .addTo(map)
                    .bindPopup(`
                        <div style="color: #333;">
                            <b style="font-size: 14px;">${station.name}</b><br>
                            <p style="margin: 5px 0;">${station.address}</p>
                            <button class="reserve-btn" style="width:100%; background:#28a745; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer; font-weight:bold;">Reserve Now</button>
                        </div>
                    `);
            });
        }
    } catch (err) {
        console.log("Stations could not be loaded.");
    }
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = "/login";
}

//sayfa yüklendiğinde butonları bağlama ve dashboardu başlatma
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = logout;
    }
    initDashboard();
});