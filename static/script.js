window.alertCallback = null;
window.confirmCallback = null;
window.chargeInterval = null;

// ==========================================
// BİLDİRİM SİSTEMİ FONKSİYONLARI
// ==========================================
function getNotifKey() { return 'ev_notifs_' + (window.currentUserId || 'guest'); }

function addNotification(message) {
    let key = getNotifKey();
    let notifs = JSON.parse(localStorage.getItem(key) || '[]');
    let time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    notifs.unshift({text: message, time: time});
    if(notifs.length > 10) notifs.pop();
    localStorage.setItem(key, JSON.stringify(notifs));
    renderNotifs();
}

function renderNotifs() {
    let key = getNotifKey();
    let notifs = JSON.parse(localStorage.getItem(key) || '[]');
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


// ==========================================
// PROFİL VE VERİ YÜKLEME (ROLE GÖRE AYRIM)
// ==========================================
window.loadProfile = async function() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const res = await fetch("/users/me", { headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) {
            const user = await res.json();
            window.currentUserId = user.user_id;
            renderNotifs();

            document.getElementById("userName").innerText = user.name;
            document.getElementById("userEmail").innerText = user.email;
            document.getElementById("userNameLetter").innerText = user.name.charAt(0).toUpperCase();

            let badgeColor = user.role === 'admin' ? '#9b59b6' : (user.role === 'operator' ? '#f39c12' : '#3498db');
            const badge = document.getElementById("userRoleBadge");
            badge.innerText = user.role.toUpperCase();
            badge.style.background = badgeColor;

            // Tüm view'leri gizle
            document.getElementById("driverView").style.display = "none";
            document.getElementById("operatorView").style.display = "none";
            document.getElementById("walletBlock").style.display = "none";
            if(document.getElementById("adminView")) document.getElementById("adminView").style.display = "none";

            // Yetkisine göre uygun view'i aç
            if (user.role === "driver") {
                document.getElementById("driverView").style.display = "block";
                document.getElementById("walletBlock").style.display = "block";

                const bRes = await fetch("/payments/wallet-balance", { headers: { "Authorization": `Bearer ${token}` } });
                if (bRes.ok) document.getElementById("walletBalance").innerText = (await bRes.json()).balance.toFixed(2);

                const vRes = await fetch("/vehicles/me", { headers: { "Authorization": `Bearer ${token}` } });
                if (vRes.ok) renderVehicles(await vRes.json());

                const fRes = await fetch("/stations/favorites/me", { headers: { "Authorization": `Bearer ${token}` } });
                if (fRes.ok) renderFavorites(await fRes.json());

                loadReservations(token);
            }
            else if (user.role === "operator") {
                document.getElementById("operatorView").style.display = "block";
                loadOperatorData(token);
            }
            else if (user.role === "admin") {
                if(document.getElementById("adminView")) document.getElementById("adminView").style.display = "block";
                loadAdminData(token);
            }
        }
    } catch (error) {
        console.error("Profile load error:", error);
    }
};


// ==========================================
// ADMIN (SİSTEM YÖNETİCİSİ) FONKSİYONLARI
// ==========================================
async function loadAdminData(token) {
    try {
        const [opRes, stRes] = await Promise.all([
            fetch("/admin/operators", { headers: { "Authorization": `Bearer ${token}` } }),
            fetch("/stations/", { headers: { "Authorization": `Bearer ${token}` } })
        ]);

        if (opRes.ok && stRes.ok) {
            const operators = await opRes.json();
            const stations = await stRes.json();
            renderAdminStations(stations, operators);
        }
    } catch (e) { console.error("Admin data error:", e); }
}

function renderAdminStations(stations, operators) {
    const el = document.getElementById("adminStationsList");
    if (!el) return;
    if (stations.length === 0) {
        el.innerHTML = '<p style="color:#666; text-align:center; width:100%;">No stations found in the system.</p>';
        return;
    }

    let html = '';
    stations.forEach(s => {
        let opOptions = `<option value="">-- Unassigned --</option>` +
            operators.map(o => `<option value="${o.operator_id}" ${s.operator_id === o.operator_id ? 'selected' : ''}>${o.name}</option>`).join('');

        html += `
        <div style="background:#1a2922; padding:20px; border-radius:10px; margin-bottom:15px; border:1px solid #9b59b6; width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; margin-bottom:10px;">
                <h4 style="color:#9b59b6; margin:0;">📍 ${s.name}</h4>
                <div style="display:flex; gap:10px;">
                    <select id="assign_op_${s.station_id}" style="padding:6px; background:#2c3e50; color:white; border:none; border-radius:4px; outline:none;">
                        ${opOptions}
                    </select>
                    <button onclick="assignOperatorToStation('${s.station_id}')" style="background:#9b59b6; border:none; color:white; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:bold;">Assign</button>
                </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:10px;">`;

        s.chargers.forEach(c => {
            html += `
                <div style="background:#0f1714; padding:10px; border-radius:8px; border-left:4px solid #3498db; width:48%; min-width:150px;">
                    <strong style="color:white; font-size:13px;">🔌 Charger #${c.charger_id}</strong>
                    <div style="display:flex; align-items:center; gap:5px; margin-top:8px;">
                        <span style="font-size:11px; color:#aaa;">₺/kWh:</span>
                        <input type="number" id="price_${c.charger_id}" value="${c.price_per_kWh}" step="0.5" style="width:60px; padding:4px; background:#2c3e50; color:white; border:none; border-radius:4px; font-size:12px;">
                        <button onclick="updateChargerPrice('${c.charger_id}')" style="background:#3498db; border:none; color:white; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">Update</button>
                    </div>
                </div>
            `;
        });
        html += `</div></div>`;
    });
    el.innerHTML = html;
}

window.assignOperatorToStation = async function(stationId) {
    const opId = document.getElementById(`assign_op_${stationId}`).value;
    if (!opId) {
        window.showCustomAlert("Please select an operator from the list.", "Error");
        return;
    }

    const token = localStorage.getItem("token");
    const res = await fetch(`/admin/stations/${stationId}/assign-operator?operator_id=${opId}`, {
        method: "PUT", headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.ok) {
        addNotification(`Operator successfully assigned to station.`);
        window.showCustomAlert("Station assignment updated successfully.", "Success", () => window.location.reload());
    } else {
        window.showCustomAlert("Error assigning operator.", "Error");
    }
};

window.updateChargerPrice = async function(chargerId) {
    const price = document.getElementById(`price_${chargerId}`).value;
    const token = localStorage.getItem("token");

    const res = await fetch(`/admin/chargers/${chargerId}/price?price_per_kwh=${price}`, {
        method: "PUT", headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.ok) {
        addNotification(`Charger #${chargerId} price updated to ${price} ₺.`);
        window.showCustomAlert("Price updated successfully.", "Success");
    } else {
        window.showCustomAlert("Error updating price.", "Error");
    }
};


// ==========================================
// 🏢 OPERATÖR (YÖNETİCİ) FONKSİYONLARI 🏢
// ==========================================
async function loadOperatorData(token) {
    try {
        const issRes = await fetch("/operators/issues", { headers: { "Authorization": `Bearer ${token}` } });
        if (issRes.ok) renderOperatorIssues(await issRes.json());
    } catch (e) { console.error(e); }

    try {
        const stRes = await fetch("/operators/my-stations", { headers: { "Authorization": `Bearer ${token}` } });
        if (stRes.ok) renderOperatorStations(await stRes.json());
    } catch (e) { console.error(e); }
}

function renderOperatorIssues(issues) {
    const el = document.getElementById("operatorIssuesList");
    const openIssues = issues.filter(i => i.status === 'open');
    if (openIssues.length === 0) {
        el.innerHTML = '<p style="color:#666; width:100%; text-align:center;">No active issue reports.</p>'; return;
    }
    el.innerHTML = openIssues.map(i => `
        <div class="vehicle-item" style="border-left: 4px solid #e74c3c; width:100%;">
            <div class="vehicle-info" style="width:100%;">
                <div style="display:flex; justify-content:space-between;">
                    <strong style="color:#e74c3c; font-size:14px;">🚨 Charger ID: #${i.charger_id}</strong>
                    <span style="font-size:10px; color:#aaa;">${new Date(i.reported_at).toLocaleString()}</span>
                </div>
                <p style="font-size:0.85rem; color:#ddd; margin:6px 0;">${i.description}</p>
                <button onclick="resolveIssue('${i.issue_id}')" style="background:#2ecc71; border:none; color:white; padding:6px 12px; border-radius:4px; cursor:pointer;">✅ Mark as Resolved</button>
            </div>
        </div>
    `).join('');
}

function renderOperatorStations(stations) {
    const el = document.getElementById("operatorStationsList");
    if (stations.length === 0) {
        el.innerHTML = '<p style="color:#666; width:100%; text-align:center;">You have no stations assigned yet.</p>'; return;
    }
    let html = '';
    stations.forEach(s => {
        html += `<div style="background:#1a2922; padding:20px; border-radius:10px; margin-bottom:15px; border:1px solid #2ecc71; width:100%;">
            <h4 style="color:#2ecc71; margin-top:0; margin-bottom:5px;">📍 ${s.name}</h4><div style="display:flex; flex-wrap:wrap; gap:10px;">`;
        s.chargers.forEach(c => {
            let color = c.status === 'available' ? '#2ecc71' : c.status === 'occupied' ? '#f39c12' : '#e74c3c';
            // BORDER-LEFT KISMI DÜZELTİLDİ (Boşluk eklendi)
            html += `
                <div style="background:#0f1714; padding:10px; border-radius:8px; border-left:4px solid ${color}; width:48%; min-width:150px;">
                    <strong style="color:white; font-size:13px;">🔌 Charger #${c.charger_id}</strong>
                    <select onchange="updateChargerStatus('${c.charger_id}', this.value)" style="width:100%; padding:6px; margin-top:8px; background:#2c3e50; color:white; border:none; border-radius:4px;">
                        <option value="available" ${c.status==='available'?'selected':''}>🟢 Available</option>
                        <option value="occupied" ${c.status==='occupied'?'selected':''}>🟡 Occupied</option>
                        <option value="offline" ${c.status==='offline'?'selected':''}>🔴 Offline (Out of Service)</option>
                    </select>
                </div>`;
        });
        html += `</div></div>`;
    });
    el.innerHTML = html;
}

window.updateChargerStatus = async function(chargerId, newStatus) {
    const token = localStorage.getItem("token");
    window.showCustomConfirm(`Change Charger #${chargerId} to ${newStatus.toUpperCase()}?`, "Status Update", async () => {
        try {
            const res = await fetch(`/operators/chargers/${chargerId}/status`, {
                method: "PUT", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                addNotification(`Charger status updated to ${newStatus}.`);
                window.location.reload();
            } else {
                window.showCustomAlert("Error updating status.", "Error");
            }
        } catch (e) { console.error(e); }
    });
};

window.resolveIssue = async function(issueId) {
    const token = localStorage.getItem("token");
    window.showCustomConfirm("Mark issue as resolved?", "Resolve Issue", async () => {
        try {
            const res = await fetch(`/operators/issues/${issueId}/resolve`, {
                method: "PATCH", headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                window.location.reload();
            }
        } catch (e) { console.error(e); }
    });
};


// ==========================================
// 🚘 SÜRÜCÜ (DRIVER) FONKSİYONLARI 🚘
// ==========================================
async function loadReservations(token) {
    const elActive = document.getElementById("reservationsList");
    const elHistory = document.getElementById("historyList");
    let isCurrentlyCharging = false;
    let chargingResId = null;

    try {
        const stRes = await fetch("/stations/", { headers: { "Authorization": `Bearer ${token}` } });
        let stations = stRes.ok ? await stRes.json() : [];

        const res = await fetch("/reservations/me", { headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) {
            const reservations = await res.json();
            const activeRes = reservations.filter(r => r.status === 'active');
            const historyRes = reservations.filter(r => r.status === 'completed' || r.status === 'cancelled');
            const chargingRes = reservations.find(r => r.status === 'charging');

            if(chargingRes) {
                isCurrentlyCharging = true;
                chargingResId = chargingRes.reservation_id;
            }

            if (activeRes.length === 0) elActive.innerHTML = '<p style="color:#666; text-align:center;">No pending reservations.</p>';
            else elActive.innerHTML = activeRes.map(r => renderActiveRes(r, stations)).join('');

            if (historyRes.length === 0) elHistory.innerHTML = '<p style="color:#666; text-align:center;">No history.</p>';
            else elHistory.innerHTML = historyRes.map(r => renderHistoryRes(r, stations)).join('');

            if (isCurrentlyCharging) {
                document.getElementById('liveChargingPanel').style.display = 'block';
                document.getElementById('reservationsSection').style.display = 'none';
                startLiveDashboard(chargingResId);
            } else {
                document.getElementById('liveChargingPanel').style.display = 'none';
                document.getElementById('reservationsSection').style.display = 'block';
                if(window.chargeInterval) clearInterval(window.chargeInterval);
            }
        }
    } catch (e) { console.error(e); }
}

function renderActiveRes(r, stations) {
    let sName = "Unknown"; let cType = "";
    stations.forEach(s => { const c = s.chargers.find(x => x.charger_id === r.charger_id); if(c) { sName = s.name; cType = c.connector_type; }});
    return `<div class="vehicle-item" style="border-left: 4px solid #f39c12; width:100%;">
        <div class="vehicle-info" style="width: 100%;">
            <div style="display:flex; justify-content:space-between;"><strong>📅 ${r.date}</strong><span style="color:#f39c12; font-size:10px;">WAITING</span></div>
            <p style="font-size:0.85rem; color:#bbb; margin:6px 0;">📍 ${sName}<br>🔌 ${cType}<br>⏰ ${r.start_time} - ${r.end_time}</p>
            <div style="margin-top: 8px;">
                <button onclick="startCharging('${r.reservation_id}')" style="background:#2ecc71; border:none; color:white; padding:6px 10px; border-radius:4px; font-weight:bold; cursor:pointer;">⚡ Start</button>
                <button onclick="confirmCancelReservation('${r.reservation_id}')" style="background:none; border:1px solid #e74c3c; color:#e74c3c; padding:5px 10px; border-radius:4px; cursor:pointer;">Cancel</button>
                <button onclick="openIssueModal('${r.charger_id}')" style="background:none; border:1px solid #f39c12; color:#f39c12; padding:5px 10px; border-radius:4px; margin-left:5px; cursor:pointer;">🚨 Report</button>
            </div>
        </div>
    </div>`;
}

function renderHistoryRes(r, stations) {
    let sName = "Station";
    stations.forEach(s => { if(s.chargers.some(c => c.charger_id === r.charger_id)) sName = s.name; });
    let c = r.status === 'completed' ? '#2ecc71' : '#e74c3c';
    // BORDER-LEFT KISMI DÜZELTİLDİ (Boşluk eklendi)
    return `<div class="vehicle-item" style="border-left: 4px solid ${c}; opacity:0.8;">
        <div class="vehicle-info" style="width: 100%;">
            <div style="display:flex; justify-content:space-between;"><strong>📅 ${r.date}</strong><span style="font-size:9px; color:${c};">${r.status.toUpperCase()}</span></div>
            <p style="font-size:0.8rem; color:#888; margin:4px 0;">📍 ${sName}</p>
            ${r.charging_session ? `<p style="font-size:10px; color:#f1c40f; margin:0;">${r.charging_session.duration_min} min | ${r.charging_session.kwh_consumed} kWh | ${r.charging_session.total_cost} ₺</p>` : ''}
        </div>
    </div>`;
}

function startLiveDashboard(resId) {
    const token = localStorage.getItem("token");
    let endTimeObj = null;

    // Rezervasyon bilgilerini çek (Bitiş saatini garantiye alalım)
    fetch("/reservations/me", { headers: { "Authorization": `Bearer ${token}` } })
        .then(res => res.json())
        .then(reservations => {
            const currentRes = reservations.find(r => r.reservation_id == resId);
            if (currentRes) {
                // Saat bilgisini parçalayıp bugünün tarihine set ediyoruz (Format: HH:mm:ss)
                const [h, m, s] = currentRes.end_time.split(':');
                endTimeObj = new Date();
                endTimeObj.setHours(parseInt(h), parseInt(m), parseInt(s), 0);
            }
        });

    let startTime = parseInt(localStorage.getItem('chargeStart_' + resId)) || Date.now();
    localStorage.setItem('chargeStart_' + resId, startTime);

    if(window.chargeInterval) clearInterval(window.chargeInterval);

    // Başlangıç bakiyesini DOM'dan al
    const balanceElement = document.getElementById("walletBalance");
    let initialBalance = parseFloat(balanceElement?.innerText || 0);
    const pricePerKwh = 7.5;

    window.chargeInterval = setInterval(() => {
        let now = new Date();
        let elapsedSeconds = Math.floor((now.getTime() - startTime) / 1000);

        // kwh hesaplama (22kW şarj hızı varsayımıyla saniyelik tüketim)
        let kwh = (22 * (elapsedSeconds / 3600) * 0.8);
        let currentCost = parseFloat((kwh * pricePerKwh).toFixed(2));

        // Arayüzü güncelle
        document.getElementById('liveTime').innerText = formatTime(elapsedSeconds);
        document.getElementById('liveKwh').innerText = kwh.toFixed(4);
        document.getElementById('liveCost').innerText = currentCost.toFixed(2);

        // --- GÜNCELLEME: BAKİYEYİ EŞ ZAMANLI DÜŞÜR ---
        let updatedBalance = (initialBalance - currentCost).toFixed(2);
        if (balanceElement) {
            balanceElement.innerText = updatedBalance;
        }

        // --- KONTROL 1: BAKİYE BİTTİ Mİ? ---
        if (updatedBalance <= 0) {
            stopChargingWithReason(resId, "Charging stopped because the balance was depleted.");
        }

        // --- KONTROL 2: SÜRE DOLDU MU? ---
        // Sadece endTimeObj başarıyla oluşturulduysa kontrol et
        if (endTimeObj && now >= endTimeObj) {
            stopChargingWithReason(resId, "Charging has stopped because your reservation period has expired.");
        }

    }, 1000);
}

function stopChargingWithReason(resId, reason) {
    clearInterval(window.chargeInterval);
    // Bakiyeyi sıfıra sabitle (eksi görünmesin)
    const balanceElement = document.getElementById("walletBalance");
    if(balanceElement && parseFloat(balanceElement.innerText) < 0) balanceElement.innerText = "0.00";

    window.showCustomAlert(reason, "System Stopped.", () => {
        stopCharging(resId);
    });
}

function formatTime(seconds) {
    let m = Math.floor(seconds / 60);
    let s = seconds % 60;
    return `${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`;
}

window.startCharging = async function(reservationId) {
    try {
        const res = await fetch(`/reservations/${reservationId}/start`, { method: "PATCH", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
        if(res.ok) {
            localStorage.setItem('chargeStart_' + reservationId, Date.now());
            window.location.reload();
        } else {
            const data = await res.json();
            window.showCustomAlert(data.detail || "Error starting charge", "Error");
        }
    } catch (e) { console.error(e); }
};

window.stopCharging = async function(resId) {
    window.showCustomConfirm("End session?", "Stop", async () => {
        try {
            const res = await fetch(`/reservations/${resId}/complete`, { method: "PATCH", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
            if(res.ok) {
                localStorage.removeItem('chargeStart_' + resId);
                window.location.reload();
            }
        } catch(e) { console.error(e); }
    });
};

window.confirmCancelReservation = (id) => window.showCustomConfirm("Cancel booking?", "Cancel", async () => {
    try {
        const res = await fetch(`/reservations/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
        if(res.ok) window.location.reload();
    } catch (e) { console.error(e); }
});

// script.js içindeki openIssueModal
window.openIssueModal = function(chargerId) {
    window.currentIssueChargerId = chargerId;
    const oldModal = document.getElementById('issueModal');
    if(oldModal) oldModal.remove();

    document.body.insertAdjacentHTML('beforeend', `
        <div id="issueModal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:100000; display:flex; justify-content:center; align-items:center;">
            <div style="background:#1a2922; border:1px solid #f39c12; padding:30px; border-radius:15px; width:320px;">
                <h3 style="color:#f39c12; margin-top:0;">🚨 Report Issue</h3>
                <p style="color:#aaa; font-size:12px;">Reporting for Charger #${chargerId}</p>
                <select id="issueType" style="width:100%; padding:10px; margin-bottom:15px; border-radius:8px; background:#2c3e50; color:white; border:none;">
                    <option value="Hardware Failure">Hardware Failure</option>
                    <option value="Cable Damage">Cable Damage</option>
                    <option value="Software Issue">Software Issue</option>
                </select>
                <textarea id="issueDesc" placeholder="Details..." style="width:100%; height:60px; padding:10px; margin-bottom:20px; border-radius:8px; background:#2c3e50; color:white; border:none; resize:none;"></textarea>
                <div style="display:flex; gap:15px;">
                    <button onclick="window.closeIssueModal()" style="flex:1; padding:12px; background:rgba(255,255,255,0.1); border-radius:8px; color:white; cursor:pointer; border:none;">Cancel</button>
                    <button onclick="window.submitIssueReport()" style="flex:1; padding:12px; background:#f39c12; border:none; border-radius:8px; color:white; cursor:pointer; font-weight:bold;">Submit</button>
                </div>
            </div>
        </div>
    `);
};

window.closeIssueModal = () => { const m = document.getElementById('issueModal'); if(m) m.remove(); };

window.submitIssueReport = async function() {
    const token = localStorage.getItem("token");
    try {
        const res = await fetch("/issue-reports/", {
            method: "POST", headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ charger_id: window.currentIssueChargerId, description: `[${document.getElementById('issueType').value}] ${document.getElementById('issueDesc').value}` })
        });
        if (res.ok) {
            closeIssueModal();
            window.showCustomAlert("Report Sent", "Success", () => window.location.reload());
        }
    } catch(e) { console.error(e); }
};

function renderFavorites(favs) {
    const el = document.getElementById("favoriteStationsList");
    el.innerHTML = favs.length > 0 ? favs.map(s => `<div class="vehicle-item" style="border-left: 4px solid #e74c3c;"><strong>❤️ ${s.name}</strong><button onclick="removeFav('${s.station_id}')" style="background:none; border:1px solid #e74c3c; color:#e74c3c; padding:3px 8px; border-radius:4px; font-size:10px; cursor:pointer;">Remove</button></div>`).join('') : '<p style="color:#666;">No favorites.</p>';
}

window.removeFav = async (id) => {
    try {
        await fetch(`/stations/${id}/favorite`, { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
        window.location.reload();
    } catch(e) { console.error(e); }
};

function renderVehicles(vs) {
    const el = document.getElementById("vehicleList");
    if (vs.length > 0) {
        el.innerHTML = vs.map(v => `
            <div class="vehicle-item" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                <div>
                    <strong style="color: #3498db;">${v.brand} ${v.model}</strong>
                    <p style="margin: 0; font-size: 12px; color: #aaa;">${v.plate_number} | ${v.connector_type}</p>
                </div>
                <button onclick="window.deleteVehicle('${v.vehicle_id}')" 
                        style="background: none; border: 1px solid #e74c3c; color: #e74c3c; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 11px; transition: 0.3s;"
                        onmouseover="this.style.background='#e74c3c'; this.style.color='white';"
                        onmouseout="this.style.background='none'; this.style.color='#e74c3c';">
                    <i class="fas fa-trash"></i> Sil
                </button>
            </div>
        `).join('');
    } else {
        el.innerHTML = '<p style="color: #666; text-align: center;">Henüz bir araç eklenmemiş.</p>';
    }
}
window.deleteVehicle = async function(vehicleId) {
    window.showCustomConfirm("Are you sure you want to delete this tool?", "Delete Vehicle", async () => {
        const token = localStorage.getItem("token");
        try {
            const res = await fetch(`/vehicles/${vehicleId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                addNotification("The vehicle has been successfully deleted.");
                window.loadProfile(); // Listeyi güncellemek için profili tekrar yükle
            } else {
                const err = await res.json();
                window.showCustomAlert(err.detail || "An error occurred while deleting the vehicle.", "Error");
            }
        } catch (error) {
            console.error("Vehicle deletion error:", error);
        }
    });
};

// ==========================================
// ORTAK MODALLAR VE YARDIMCI İŞLEMLER
// ==========================================
window.showCustomAlert = (m, t, cb) => { document.getElementById("customAlertTitle").innerText = t; document.getElementById("customAlertMessage").innerText = m; document.getElementById("customAlertModal").style.display = "flex"; window.alertCallback = cb; };
window.closeCustomAlert = () => { document.getElementById("customAlertModal").style.display = "none"; if(window.alertCallback) window.alertCallback(); };
window.showCustomConfirm = (message, title, onConfirm) => { document.getElementById("customConfirmTitle").innerText = title; document.getElementById("customConfirmMessage").innerText = message; document.getElementById("customConfirmModal").style.display = "flex"; window.confirmCallback = onConfirm; };
window.closeCustomConfirm = (isConfirmed) => { document.getElementById("customConfirmModal").style.display = "none"; if (isConfirmed && window.confirmCallback) window.confirmCallback(); window.confirmCallback = null; };
window.openTopUpModal = () => document.getElementById("topUpModal").style.display = "flex";
window.closeTopUpModal = () => document.getElementById("topUpModal").style.display = "none";
window.submitTopUp = async () => {
    const amount = parseFloat(document.getElementById("topUpAmount").value);
    const token = localStorage.getItem("token");

    try {
        const res = await fetch("/payments/topup", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                amount: amount,
                type: "TopUp",
                driver_id: window.currentUserId
            })
        });
        if (res.ok) window.location.reload();
    } catch(e) { console.error(e); }
};
window.toggleVehicleView = (s) => { document.getElementById("profileView").style.display = s ? "none" : "block"; document.getElementById("addView").style.display = s ? "block" : "none"; };
window.handleLogout = () => { localStorage.removeItem("token"); window.location.href = "/login"; };

// Araç Kaydetme Formu Dinleyicisi
document.getElementById("vehicleForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");

    const vehicleData = {
        brand: document.getElementById("vBrand").value,
        model: document.getElementById("vModel").value,
        plate_number: document.getElementById("vPlate").value,
        battery_kWh: parseFloat(document.getElementById("vBattery").value),
        connector_type: document.getElementById("vConnector").value,
        owner_id: window.currentUserId
    };

    try {
        const res = await fetch("/vehicles/", { // Backend rotana göre sonundaki /'a dikkat et
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(vehicleData)
        });

        if (res.ok) {
            window.showCustomAlert("Vehicle added successfully!", "Success", () => {
                window.toggleVehicleView(false); // Profil ekranına dön
                window.loadProfile();           // Verileri (ve listeyi) yeniden yükle
            });
        } else {
            const err = await res.json();
            window.showCustomAlert(err.detail || "Error adding vehicle", "Error");
        }
    } catch (error) {
        console.error("Vehicle add error:", error);
    }
});document.addEventListener("DOMContentLoaded", window.loadProfile);
document.head.insertAdjacentHTML("beforeend", `<style>@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } } button { cursor: pointer; }</style>`);