window.alertCallback = null;

window.showCustomAlert = function(message, title = "Notification", onConfirm = null) {
    document.getElementById("customAlertTitle").innerText = title;
    document.getElementById("customAlertMessage").innerText = message;
    document.getElementById("customAlertModal").style.display = "flex";
    window.alertCallback = onConfirm;
};

window.closeCustomAlert = function() {
    document.getElementById("customAlertModal").style.display = "none";
    if (typeof window.alertCallback === "function") {
        window.alertCallback();
        window.alertCallback = null;
    }
};

window.toggleVehicleView = function(showAdd) {
    document.getElementById("profileView").style.display = showAdd ? "none" : "block";
    document.getElementById("addView").style.display = showAdd ? "block" : "none";
};

window.loadProfile = async function() {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/login"; return; }

    try {
        const response = await fetch("/users/me", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            const user = data.user || data;
            window.currentUserId = user.user_id || user.id;

            document.getElementById("userName").innerText = user.name;
            document.getElementById("userEmail").innerText = user.email;
            document.getElementById("userNameLetter").innerText = user.name.charAt(0).toUpperCase();

            const roleBadge = document.getElementById("userRoleBadge");
            roleBadge.innerText = user.role.charAt(0).toUpperCase() + user.role.slice(1);

            if (user.role === "driver") {
                // Bakiye
                const balRes = await fetch("/payments/wallet-balance", { headers: { "Authorization": `Bearer ${token}` } });
                if (balRes.ok) {
                    const balData = await balRes.json();
                    document.getElementById("walletBalance").innerText = balData.balance.toFixed(2);
                }
                // Araçlar
                const vRes = await fetch("/vehicles/me", { headers: { "Authorization": `Bearer ${token}` } });
                if (vRes.ok) renderVehicles(await vRes.json());
                // Favoriler
                loadFavoriteStations(token);
            }
            renderStatusContent(user);
        } else {
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
    } catch (e) { console.error(e); }
};

async function loadFavoriteStations(token) {
    const el = document.getElementById("favoriteStationsList");
    try {
        const res = await fetch("/stations/favorites/me", { headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) {
            const favs = await res.json();
            el.innerHTML = favs.length > 0 ? favs.map(s => `
                <div class="vehicle-item" style="border-left: 4px solid #e74c3c;">
                    <div class="vehicle-info">
                        <strong>❤️ ${s.name}</strong>
                        <p style="font-size:0.8rem; color:#bbb;">${s.address}</p>
                        <button onclick="removeFavProfile(${s.station_id})" style="background:none; border:1px solid #e74c3c; color:#e74c3c; cursor:pointer; font-size:10px; margin-top:5px; border-radius:3px;">Remove</button>
                    </div>
                </div>
            `).join('') : '<p style="color:#666; width:100%; text-align:center;">No favorite stations yet.</p>';
        }
    } catch (e) { console.error(e); }
}

window.removeFavProfile = async function(id) {
    const token = localStorage.getItem("token");
    const res = await fetch(`/stations/${id}/favorite`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
    if (res.ok) window.location.reload();
};

function renderVehicles(vehicles) {
    const el = document.getElementById("vehicleList");
    el.innerHTML = vehicles.length > 0 ? vehicles.map(v => `
        <div class="vehicle-item">
            <div class="vehicle-info"><strong>${v.brand} ${v.model}</strong><p>${v.plate_number}</p></div>
        </div>
    `).join('') : '<p style="color:#666;">No vehicles registered.</p>';
}

function renderStatusContent(user) {
    const el = document.getElementById("statusContent");
    if (user.role === "driver") {
        el.innerHTML = `<button class="btn-action btn-apply" onclick="applyOperator()">Apply as Operator</button>`;
    } else if (user.role === "operator") {
        el.innerHTML = `<a href="/operator/dashboard" class="btn-action btn-apply" style="text-decoration:none;">Go to Dashboard</a>`;
    }
}

window.applyOperator = async function() {
    const token = localStorage.getItem("token");
    const res = await fetch("/users/operator-apply", { method: "POST", headers: { "Authorization": `Bearer ${token}` } });
    if (res.ok) window.showCustomAlert("Application sent!", "Success", () => window.location.reload());
};

window.handleLogout = () => { localStorage.removeItem("token"); window.location.href = "/login"; };

window.openTopUpModal = () => { document.getElementById("topUpAmount").value = ""; document.getElementById("topUpModal").style.display = "flex"; };
window.closeTopUpModal = () => document.getElementById("topUpModal").style.display = "none";
window.submitTopUp = async function(e) {
    if (e) e.preventDefault();
    const amount = parseFloat(document.getElementById("topUpAmount").value);
    const token = localStorage.getItem("token");
    const res = await fetch("/payments/topup", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ amount, type: "TopUp", driver_id: window.currentUserId })
    });
    if (res.ok) {
        window.closeTopUpModal();
        window.showCustomAlert(`Added ${amount} ₺!`, "Success", () => window.location.reload());
    }
};

document.addEventListener("DOMContentLoaded", window.loadProfile);