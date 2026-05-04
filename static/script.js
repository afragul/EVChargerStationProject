window.alertCallback = null;
window.confirmCallback = null;
window.chargeInterval = null;

// YENİ: BİLDİRİM SİSTEMİ FONKSİYONLARI
function addNotification(message) {
    let notifs = JSON.parse(localStorage.getItem('ev_notifs') || '[]');
    let time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    notifs.unshift({text: message, time: time});
    if(notifs.length > 10) notifs.pop(); // Son 10 bildirimi tut
    localStorage.setItem('ev_notifs', JSON.stringify(notifs));
    renderNotifs();
}

function renderNotifs() {
    let notifs = JSON.parse(localStorage.getItem('ev_notifs') || '[]');
    let list = document.getElementById('notifList');
    let badge = document.getElementById('notifBadge');

    if(notifs.length > 0) {
        badge.style.display = 'block';
        badge.innerText = notifs.length;
        list.innerHTML = notifs.map(n => `
            <div style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div style="color: #2ecc71; font-weight: bold; margin-bottom: 3px;">${n.time}</div>
                <div>${n.text}</div>
            </div>`).join('');
    } else {
        badge.style.display = 'none';
        list.innerHTML = '<p style="color:#666; text-align:center;">No new notifications.</p>';
    }
}

window.toggleNotifs = () => {
    let p = document.getElementById('notifPanel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
};

// UI MODALLAR
window.showCustomAlert = (m, t, cb) => {
    document.getElementById("customAlertTitle").innerText = t;
    document.getElementById("customAlertMessage").innerText = m;
    document.getElementById("customAlertModal").style.display = "flex";
    window.alertCallback = cb;
};
window.closeCustomAlert = () => {
    document.getElementById("customAlertModal").style.display = "none";
    if(window.alertCallback) window.alertCallback();
};
window.showCustomConfirm = (message, title, onConfirm) => {
    document.getElementById("customConfirmTitle").innerText = title;
    document.getElementById("customConfirmMessage").innerText = message;
    document.getElementById("customConfirmModal").style.display = "flex";
    window.confirmCallback = onConfirm;
};
window.closeCustomConfirm = (isConfirmed) => {
    document.getElementById("customConfirmModal").style.display = "none";
    if (isConfirmed && window.confirmCallback) window.confirmCallback();
    window.confirmCallback = null;
};

// PROFİL YÜKLEME
window.loadProfile = async function() {
    renderNotifs(); // Bildirimleri yükle
    const token = localStorage.getItem("token");
    if (!token) return;

    const res = await fetch("/users/me", { headers: { "Authorization": `Bearer ${token}` } });
    if (res.ok) {
        const user = await res.json();
        window.currentUserId = user.user_id;
        document.getElementById("userName").innerText = user.name;
        document.getElementById("userEmail").innerText = user.email;
        document.getElementById("userNameLetter").innerText = user.name.charAt(0).toUpperCase();

        if (user.role === "driver") {
            const bRes = await fetch("/payments/wallet-balance", { headers: { "Authorization": `Bearer ${token}` } });
            if (bRes.ok) document.getElementById("walletBalance").innerText = (await bRes.json()).balance.toFixed(2);

            const vRes = await fetch("/vehicles/me", { headers: { "Authorization": `Bearer ${token}` } });
            if (vRes.ok) renderVehicles(await vRes.json());

            const fRes = await fetch("/stations/favorites/me", { headers: { "Authorization": `Bearer ${token}` } });
            if (fRes.ok) renderFavorites(await fRes.json());

            loadReservations(token);
        }
    }
};

async function loadReservations(token) {
    const elActive = document.getElementById("reservationsList");
    const elHistory = document.getElementById("historyList");
    let isCurrentlyCharging = false;
    let chargingResId = null;

    try {
        const stRes = await fetch("/stations/", { headers: { "Authorization": `Bearer ${token}` } });
        let stations = [];
        if (stRes.ok) stations = await stRes.json();

        const res = await fetch("/reservations/me", { headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) {
            const reservations = await res.json();

            const activeRes = reservations.filter(r => r.status === 'active');
            const historyRes = reservations.filter(r => r.status === 'completed');

            // Canlı şarj olan var mı kontrol et
            const chargingRes = reservations.find(r => r.status === 'charging');
            if(chargingRes) {
                isCurrentlyCharging = true;
                chargingResId = chargingRes.reservation_id;
            }

            // AKTİF REZERVASYONLAR (Sadece 'active' olanlar - bekleyenler)
            if (activeRes.length === 0) {
                elActive.innerHTML = '<p style="color:#666; width:100%; text-align:center;">No pending reservations.</p>';
            } else {
                activeRes.sort((a, b) => new Date(b.date) - new Date(a.date));
                elActive.innerHTML = activeRes.map(r => {
                    let stationName = "Unknown Station";
                    let chargerType = "";
                    stations.forEach(s => {
                        const charger = s.chargers.find(c => c.charger_id === r.charger_id);
                        if(charger) { stationName = s.name; chargerType = charger.connector_type; }
                    });

                    return `
                    <div class="vehicle-item" style="border-left: 4px solid #f39c12; background: rgba(255,255,255,0.03);">
                        <div class="vehicle-info" style="width: 100%;">
                            <div style="display: flex; justify-content: space-between;">
                                <strong style="color:white; font-size:14px;">📅 ${r.date}</strong>
                                <span style="font-size:10px; font-weight:bold; color:#f39c12; padding:2px 6px; border: 1px solid #f39c12; border-radius:4px;">WAITING</span>
                            </div>
                            <p style="font-size:0.85rem; color:#bbb; margin:6px 0;"><b>📍 ${stationName}</b><br>🔌 ${chargerType} <br>⏰ ${r.start_time} - ${r.end_time}</p>
                            <div style="margin-top: 8px;">
                                <button onclick="startCharging(${r.reservation_id})" style="background: #2ecc71; border: none; color: white; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight:bold; margin-right: 5px;">⚡ Start Charge</button>
                                <button onclick="confirmCancelReservation(${r.reservation_id})" style="background: none; border: 1px solid #e74c3c; color: #e74c3c; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight:bold;">Cancel</button>
                            </div>
                        </div>
                    </div>`;
                }).join('');
            }

            // GEÇMİŞ (HISTORY)
            if (historyRes.length === 0) {
                elHistory.innerHTML = '<p style="color:#666; width:100%; text-align:center;">No charging history.</p>';
            } else {
                historyRes.sort((a, b) => new Date(b.date) - new Date(a.date));
                elHistory.innerHTML = historyRes.map(r => {
                    let stationName = "Unknown Station";
                    stations.forEach(s => {
                        const charger = s.chargers.find(c => c.charger_id === r.charger_id);
                        if(charger) stationName = s.name;
                    });
                    return `
                    <div class="vehicle-item" style="border-left: 4px solid #2ecc71; opacity: 0.8;">
                        <div class="vehicle-info" style="width: 100%;">
                            <div style="display: flex; justify-content: space-between;">
                                <strong style="color:white; font-size:13px;">📅 ${r.date}</strong>
                                <span style="font-size:9px; color:#2ecc71;">COMPLETED</span>
                            </div>
                            <p style="font-size:0.8rem; color:#888; margin:4px 0;">📍 ${stationName}</p>
                            ${r.charging_session ? `<p style="font-size:10px; color:#f1c40f; margin:0;">${r.charging_session.duration_min} min | ${r.charging_session.kwh_consumed} kWh | ${r.charging_session.total_cost} ₺</p>` : ''}
                        </div>
                    </div>`;
                }).join('');
            }

            // YENİ: CANLI ŞARJ EKRANINI YÖNET
            if (isCurrentlyCharging) {
                document.getElementById('liveChargingPanel').style.display = 'block';
                document.getElementById('reservationsSection').style.display = 'none'; // Aktifleri gizle, kafası karışmasın
                startLiveDashboard(chargingResId);
            } else {
                document.getElementById('liveChargingPanel').style.display = 'none';
                document.getElementById('reservationsSection').style.display = 'block';
                if(window.chargeInterval) clearInterval(window.chargeInterval);
            }
        }
    } catch (e) { console.error(e); }
}

// YENİ: CANLI DASHBOARD SİMÜLASYONU (FRONTEND)
function startLiveDashboard(resId) {
    // Şarjın başlama zamanını local storage'dan al, yoksa şu anki zamanı kaydet (Sayfa yenilense de süre devam etsin)
    let startTime = localStorage.getItem('chargeStart_' + resId);
    if (!startTime) {
        startTime = Date.now();
        localStorage.setItem('chargeStart_' + resId, startTime);
    }

    if(window.chargeInterval) clearInterval(window.chargeInterval);

    // Her saniye ekranı güncelle
    window.chargeInterval = setInterval(() => {
        let diffSeconds = Math.floor((Date.now() - startTime) / 1000);
        let simMinutes = diffSeconds; // Backend simülasyonumuzla aynı mantık: 1 saniye = 1 dakika

        // Gösterişli Ortalama Hesaplamalar (22kW Cihaz, 7.5 TL/kWh)
        let kwh = (22 * (simMinutes / 60) * 0.8).toFixed(2);
        let cost = (kwh * 7.5).toFixed(2);
        let displayMin = simMinutes < 10 ? '0' + simMinutes : simMinutes;

        document.getElementById('liveTime').innerText = `00:${displayMin}`;
        document.getElementById('liveKwh').innerHTML = `${kwh} <span style="font-size:14px;">kWh</span>`;
        document.getElementById('liveCost').innerHTML = `${cost} <span style="font-size:14px;">₺</span>`;
    }, 1000);

    document.getElementById('liveStopBtn').onclick = () => stopCharging(resId);
}


// ŞARJ İŞLEMLERİ
window.startCharging = async function(reservationId) {
    const token = localStorage.getItem("token");
    try {
        const response = await fetch(`/reservations/${reservationId}/start`, {
            method: "PATCH", headers: { "Authorization": `Bearer ${token}` }
        });
        if(response.ok) {
            localStorage.setItem('chargeStart_' + reservationId, Date.now());
            addNotification("Charging session started! Energy is flowing.");
            window.location.reload();
        } else {
            const data = await response.json();
            window.showCustomAlert(data.detail, "Error");
        }
    } catch (e) { console.error(e); }
};

window.stopCharging = async function(reservationId) {
    window.showCustomConfirm("Are you sure you want to stop charging? Your final bill will be calculated.", "Stop Charge", async () => {
        const token = localStorage.getItem("token");
        try {
            const response = await fetch(`/reservations/${reservationId}/complete`, {
                method: "PATCH", headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await response.json();
            if(response.ok) {
                // Şarj bittiği için timer'ı sıfırla ve bildirim at
                localStorage.removeItem('chargeStart_' + reservationId);
                if(window.chargeInterval) clearInterval(window.chargeInterval);

                addNotification(`Charging completed! Consumed: ${data.kwh} kWh. Total fee: ${data.cost} ₺.`);

                const billMessage = `Session Ended!\n\nConsumed: ${data.kwh} kWh\nDuration: ${data.duration} min\nTotal Cost: ${data.cost} ₺\n\nFee adjusted from your wallet.`;
                window.showCustomAlert(billMessage, "Invoice Summary", () => window.location.reload());
            } else {
                window.showCustomAlert(data.detail, "Error");
            }
        } catch (e) { console.error(e); }
    });
};

window.confirmCancelReservation = function(reservationId) {
    window.showCustomConfirm("Are you sure you want to cancel this reservation? The provision will be refunded.", "Delete Reservation?", () => executeCancel(reservationId));
};

async function executeCancel(reservationId) {
    const token = localStorage.getItem("token");
    const response = await fetch(`/reservations/${reservationId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` }});
    if(response.ok) {
        addNotification("Reservation cancelled. Provision refunded to wallet.");
        window.showCustomAlert("Reservation deleted. Fee refunded.", "Success", () => window.location.reload());
    }
}

// DİĞER GÖRÜNÜMLER
function renderFavorites(favs) {
    const el = document.getElementById("favoriteStationsList");
    if (favs.length === 0) {
        el.innerHTML = '<p style="color:#666; width:100%; text-align:center;">No favorites yet.</p>';
        return;
    }
    el.innerHTML = favs.map(s => `
        <div class="vehicle-item" style="border-left: 4px solid #e74c3c; background: rgba(231, 76, 60, 0.05);">
            <div class="vehicle-info">
                <strong style="color:white;">❤️ ${s.name}</strong>
                <p style="font-size:0.8rem; color:#bbb; margin:5px 0;">${s.address}</p>
                <button onclick="removeFav(${s.station_id})" style="background:none; border:1px solid #e74c3c; color:#e74c3c; padding:3px 8px; border-radius:4px; cursor:pointer; font-size:10px;">Remove</button>
            </div>
        </div>
    `).join('');
}

window.removeFav = async (id) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`/stations/${id}/favorite`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
    if (res.ok) window.location.reload();
};

function renderVehicles(vs) {
    const el = document.getElementById("vehicleList");
    el.innerHTML = vs.length > 0 ? vs.map(v => `
        <div class="vehicle-item"><strong>${v.brand} ${v.model}</strong><p>${v.plate_number}</p></div>
    `).join('') : '<p style="color:#666;">No vehicles.</p>';
}

window.openTopUpModal = () => document.getElementById("topUpModal").style.display = "flex";
window.closeTopUpModal = () => document.getElementById("topUpModal").style.display = "none";

window.submitTopUp = async () => {
    const amount = parseFloat(document.getElementById("topUpAmount").value);
    const token = localStorage.getItem("token");
    const res = await fetch("/payments/topup", {
        method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount, type: "TopUp", driver_id: window.currentUserId })
    });
    if (res.ok) {
        addNotification(`Wallet topped up successfully with ${amount} ₺.`);
        window.showCustomAlert("Funds added!", "Success", () => window.location.reload());
    }
};

window.toggleVehicleView = (s) => {
    document.getElementById("profileView").style.display = s ? "none" : "block";
    document.getElementById("addView").style.display = s ? "block" : "none";
};

window.handleLogout = () => { localStorage.removeItem("token"); window.location.href = "/login"; };
document.addEventListener("DOMContentLoaded", window.loadProfile);

// CHARGING PULSE ANIMATION
document.head.insertAdjacentHTML("beforeend", `<style>
@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.3; }
  100% { opacity: 1; }
}
</style>`);