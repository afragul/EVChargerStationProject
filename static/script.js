window.alertCallback = null;
window.confirmCallback = null;

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
    if (isConfirmed && window.confirmCallback) {
        window.confirmCallback();
    }
    window.confirmCallback = null;
};

window.loadProfile = async function() {
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
    const el = document.getElementById("reservationsList");
    try {
        const stRes = await fetch("/stations/", { headers: { "Authorization": `Bearer ${token}` } });
        let stations = [];
        if (stRes.ok) stations = await stRes.json();

        const res = await fetch("/reservations/me", { headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) {
            const reservations = await res.json();

            if (reservations.length === 0) {
                el.innerHTML = '<p style="color:#666; width:100%; text-align:center;">No reservations found.</p>';
                return;
            }

            reservations.sort((a, b) => new Date(b.date) - new Date(a.date));

            el.innerHTML = reservations.map(r => {
                let stationName = "Unknown Station";
                let chargerType = "";

                stations.forEach(s => {
                    const charger = s.chargers.find(c => c.charger_id === r.charger_id);
                    if(charger) {
                        stationName = s.name;
                        chargerType = charger.connector_type;
                    }
                });

                const statusColor = r.status === 'active' ? '#2ecc71' : '#3498db';

                let cancelBtnHtml = "";
                if (r.status === 'active') {
                    cancelBtnHtml = `<button onclick="confirmCancelReservation(${r.reservation_id})" style="background: none; border: 1px solid #e74c3c; color: #e74c3c; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; margin-top: 8px; font-weight:bold; transition: 0.3s;">Cancel Reservation</button>`;
                }

                return `
                <div class="vehicle-item" style="border-left: 4px solid ${statusColor}; background: rgba(255,255,255,0.03);">
                    <div class="vehicle-info" style="width: 100%;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <strong style="color:white; font-size:14px;">📅 ${r.date}</strong>
                            <span style="font-size:10px; font-weight:bold; color:${statusColor}; padding:2px 6px; border: 1px solid ${statusColor}; border-radius:4px; text-transform: uppercase;">
                                ${r.status}
                            </span>
                        </div>
                        <p style="font-size:0.85rem; color:#bbb; margin:6px 0; line-height: 1.4;">
                            <b>📍 ${stationName}</b><br>
                            🔌 ${chargerType} <br>
                            ⏰ ${r.start_time} - ${r.end_time}
                        </p>
                        ${cancelBtnHtml}
                    </div>
                </div>`;
            }).join('');
        }
    } catch (e) {
        console.error("Reservations load error:", e);
        el.innerHTML = '<p style="color:#e74c3c; text-align:center; width:100%;">Failed to load reservations.</p>';
    }
}

window.confirmCancelReservation = function(reservationId) {
    window.showCustomConfirm(
        "Are you sure you want to cancel this reservation? It will be permanently deleted and the fee will be refunded.",
        "Delete Reservation?",
        () => executeCancel(reservationId)
    );
};

// YENİ: İptal isteği artık DELETE metoduyla veritabanından siliyor
async function executeCancel(reservationId) {
    const token = localStorage.getItem("token");
    try {
        const response = await fetch(`/reservations/${reservationId}`, { // Rota güncellendi
            method: "DELETE", // Metod DELETE yapıldı
            headers: { "Authorization": `Bearer ${token}` }
        });

        if(response.ok) {
            window.showCustomAlert("Reservation deleted permanently. Fee refunded.", "Success", () => window.location.reload());
        } else {
            const data = await response.json();
            window.showCustomAlert(data.detail || "Failed to delete reservation.", "Error");
        }
    } catch (e) {
        console.error("Cancel error:", e);
        window.showCustomAlert("Connection error.", "Error");
    }
}

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
                <button onclick="confirmRemoveFav(${s.station_id})" style="background:none; border:1px solid #e74c3c; color:#e74c3c; padding:3px 8px; border-radius:4px; cursor:pointer; font-size:10px;">Remove</button>
            </div>
        </div>
    `).join('');
}

window.confirmRemoveFav = function(stationId) {
    window.showCustomConfirm(
        "Are you sure you want to remove this station from your favorites?",
        "Remove Favorite",
        () => removeFav(stationId)
    );
};

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
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount, type: "TopUp", driver_id: window.currentUserId })
    });
    if (res.ok) window.showCustomAlert("Funds added!", "Success", () => window.location.reload());
};

window.toggleVehicleView = (s) => {
    document.getElementById("profileView").style.display = s ? "none" : "block";
    document.getElementById("addView").style.display = s ? "block" : "none";
};

window.handleLogout = () => { localStorage.removeItem("token"); window.location.href = "/login"; };
document.addEventListener("DOMContentLoaded", window.loadProfile);