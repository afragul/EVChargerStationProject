window.alertCallback = null;
window.confirmCallback = null;
window.chargeInterval = null;



// BİLDİRİM SİSTEMİ FONKSİYONLARI

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

async function renderNotifs() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const res = await fetch("/users/me/notifications", { headers: { "Authorization": `Bearer ${token}` } });
        if (res.ok) {
            const notifs = await res.json();
            let list = document.getElementById('notifList');
            let badge = document.getElementById('notifBadge');

            if(notifs.length > 0) {
                badge.style.display = 'block';
                badge.innerText = notifs.length;
                list.innerHTML = notifs.map(n => `
                    <div style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                        <div style="color: #2ecc71; font-weight: bold; margin-bottom: 3px;">${n.time}</div>
                        <div>${n.message}</div>
                    </div>`).join('');
            } else {
                badge.style.display = 'none';
                list.innerHTML = '<p style="color:#666; text-align:center;">No new notifications.</p>';
            }
        }
    } catch (e) { console.error("Notification load error", e); }
}
// Lokal bildirim ekleyici. db ye gitmeden bildirim gitmez
function addNotification(message) {
    let time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    let list = document.getElementById('notifList');
    list.innerHTML = `
        <div style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <div style="color: #f1c40f; font-weight: bold; margin-bottom: 3px;">${time} (Local)</div>
            <div>${message}</div>
        </div>` + list.innerHTML;

    let badge = document.getElementById('notifBadge');
    badge.style.display = 'block';
    badge.innerText = parseInt(badge.innerText || 0) + 1;
}

window.toggleNotifs = () => {
    let p = document.getElementById('notifPanel');
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
};



// PROFİL VE VERİ YÜKLEME (ROLE GÖRE AYRIM)

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



// ADMIN (SİSTEM YÖNETİCİSİ) FONKSİYONLARI
async function loadAdminData(token) {
    try {
        const [opRes, stRes, pendingOpRes, claimsRes, analyticsRes, resDetails] = await Promise.all([
            fetch("/admin/operators", { headers: { "Authorization": `Bearer ${token}` } }),
            fetch("/stations/", { headers: { "Authorization": `Bearer ${token}` } }),
            fetch("/admin/operators/pending", { headers: { "Authorization": `Bearer ${token}` } }),
            fetch("/admin/station-claims/pending", { headers: { "Authorization": `Bearer ${token}` } }),
            fetch("/admin/analytics", { headers: { "Authorization": `Bearer ${token}` } }),
            fetch("/admin/reservations/details", { headers: { "Authorization": `Bearer ${token}` } }) // YENİ EKLENEN İSTEK
        ]);

        if (opRes.ok && stRes.ok) {
            const operators = await opRes.json();
            const stations = await stRes.json();
            renderAdminStations(stations, operators);
            if (pendingOpRes.ok) renderPendingOperators(await pendingOpRes.json(), stations);
        }

        if (claimsRes.ok) renderStationClaims(await claimsRes.json());

        // Analitikleri Çizdir
        if (analyticsRes.ok) {
            const analyticsData = await analyticsRes.json();
            renderAdminAnalytics(analyticsData);
        }

        // YENİ: Sistem Rezervasyonlarını Çizdir
        if (resDetails && resDetails.ok) {
            const reservations = await resDetails.json();
            renderAdminReservations(reservations);
        }

    } catch (e) {
        console.error("Admin data error:", e);
    }
}

// Rezervasyonları Tabloya Basan Fonksiyon (loadAdminData'nın hemen dışında olmalı)
function renderAdminReservations(reservations) {
    const el = document.getElementById("adminAllReservationsList");
    if (!el) return;

    // Eğer sistemde hiç rezervasyon yoksa:
    if (!reservations || reservations.length === 0) {
        el.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#666;">Sistemde rezervasyon bulunamadı.</td></tr>';
        return;
    }

    // Veri varsa satırları oluştur:
    el.innerHTML = reservations.map(r => {
        let statusColor = r.status === 'completed' ? '#2ecc71' : (r.status === 'active' || r.status === 'charging' ? '#f39c12' : '#e74c3c');
        return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
            <td style="padding:15px; white-space: nowrap;"><strong>${r.date}</strong><br><span style="color:#aaa; font-size:11px;">${r.time}</span></td>
            <td style="padding:15px; color:#3498db; font-weight:bold;">${r.driver_name}</td>
            <td style="padding:15px; color:#aaa;">${r.vehicle_info}</td>
            <td style="padding:15px;">${r.station_name} <br><span style="font-size:11px; color:#888;">Charger #${r.charger_id}</span></td>
            <td style="padding:15px;"><span style="color:${statusColor}; font-weight:bold; font-size:11px; text-transform:uppercase; background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:4px;">${r.status}</span></td>
        </tr>`;
    }).join('');
}

// Onay bekleyen operatörleri HTML'e çevirip basan fonksiyon
function renderPendingOperators(pendingOps, stations) {
    const el = document.getElementById("adminPendingOperatorsList");
    if (!el) return;

    if (pendingOps.length === 0) {
        el.innerHTML = '<p style="color:#666; text-align:center; width:100%; padding: 10px;">No pending operator registrations.</p>';
        return;
    }

    const unassignedStations = stations.filter(s => !s.operator_id && !s.requested_operator_id);
    let stationOptions = unassignedStations.map(s => `<option value="${s.station_id}">${s.name}</option>`).join('');

    let html = '';
    pendingOps.forEach(op => {
        html += `
        <div style="background:#1a2922; padding:18px; border-radius:12px; margin-bottom:15px; border-left:5px solid #f39c12; display:flex; flex-direction:column; gap:12px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
            <div style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px;">
                <strong style="color:#f39c12; font-size:16px;"><i class="fas fa-user-clock"></i> ${op.name}</strong>
                <p style="font-size:0.9rem; color:#aaa; margin:6px 0 0 0;">📧 ${op.email}</p>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:8px;">
                <label style="font-size: 11px; color: #888; font-weight: bold; text-transform: uppercase;">1. Assign a Station</label>
                <select id="first_station_${op.operator_id}" style="width:100%; padding:12px; background:#2c3e50; color:white; border:1px solid #34495e; border-radius:8px; outline:none; font-size:13px; cursor:pointer;">
                    <option value="">-- Select an available station --</option>
                    ${stationOptions}
                </select>
                
                <button onclick="approveOperator('${op.operator_id}')" style="width:100%; background:#2ecc71; border:none; color:white; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px; margin-top:5px; transition:0.3s;">
                    Approve & Assign
                </button>
            </div>
        </div>`;
    });
    el.innerHTML = html;
}
// Onay butonuna basılınca çalışacak backend isteği
window.approveOperator = async function(operatorId) {
    const token = localStorage.getItem("token");
    const stationId = document.getElementById(`first_station_${operatorId}`).value;

    if(!stationId) {
        window.showCustomAlert("You must assign an available station to the operator before approving.", "Station Required");
        return;
    }

    window.showCustomConfirm("Approve operator and assign the selected station?", "Approve Operator", async () => {
        try {
            const res = await fetch(`/admin/operators/${operatorId}/approve?station_id=${stationId}`, {
                method: "PATCH",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) window.location.reload();
        } catch (e) { console.error(e); }
    });
};

//operatorlerin istek istasyonda bulunmasi
function renderStationClaims(claims) {
    const el = document.getElementById("adminStationClaimsList");
    if (!el) return;

    if (claims.length === 0) {
        el.innerHTML = '<p style="color:#666; text-align:center; width:100%; padding: 10px;">No pending station claims.</p>';
        return;
    }

    let html = '';
    claims.forEach(c => {
        html += `
        <div style="background:#1a2922; padding:18px; border-radius:12px; margin-bottom:15px; border-left:5px solid #3498db; display:flex; flex-direction:column; gap:12px; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
            <div style="border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 10px;">
                <strong style="color:#3498db; font-size:16px;"><i class="fas fa-map-marker-alt"></i> ${c.station_name}</strong>
                <p style="font-size:0.9rem; color:#aaa; margin:6px 0 0 0;">Requested by: <b style="color:#fff;">${c.operator_name}</b></p>
            </div>
            <button onclick="approveStationClaim('${c.station_id}')" style="width:100%; background:#3498db; border:none; color:white; padding:12px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px; transition:0.3s;">
                Grant Station Access
            </button>
        </div>`;
    });
    el.innerHTML = html;
}

window.approveStationClaim = async function(stationId) {
    const token = localStorage.getItem("token");
    window.showCustomConfirm("Grant this station to the requesting operator?", "Approve Claim", async () => {
        try {
            const res = await fetch(`/admin/stations/${stationId}/approve-claim`, {
                method: "PATCH",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) window.location.reload();
        } catch (e) { console.error(e); }
    });
};


// İstasyon verilerini güvenli bir şekilde hafızada tutuyoruz (HTML'i bozmaması için)
window.adminStationsData = [];

function renderAdminStations(stations, operators) {
    const el = document.getElementById("adminStationsList");
    if (!el) return;

    // Verileri global hafızaya al
    window.adminStationsData = stations;

    // 1. YENİ İSTASYON EKLEME BUTONU
    let html = `
    <div style="margin-bottom: 20px; text-align: right;">
        <button onclick="openStationModal()" style="background:#2ecc71; border:none; color:white; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px; box-shadow: 0 4px 6px rgba(46, 204, 113, 0.3);">
            ➕ Create New Station
        </button>
    </div>`;

    if (!stations || stations.length === 0) {
        html += '<p style="color:#666; text-align:center; width:100%;">No stations found in the system.</p>';
        el.innerHTML = html;
        return;
    }

    stations.forEach(s => {
        let opOptions = `<option value="">-- Unassigned (Available) --</option>` +
            operators.map(o => `<option value="${o.operator_id}" ${s.operator_id === o.operator_id ? 'selected' : ''}>${o.name}</option>`).join('');

        html += `
        <div style="background:#1a2922; padding:20px; border-radius:12px; margin-bottom:20px; border:1px solid rgba(155, 89, 182, 0.5); width:100%; position:relative;">
            
            <div style="position:absolute; top:20px; right:20px; display:flex; gap:10px;">
                <button onclick="editStationAction(${s.station_id})" style="background:none; border:none; color:#f1c40f; cursor:pointer; font-size:16px;" title="Edit Station"><i class="fas fa-edit"></i></button>
                <button onclick="deleteStation('${s.station_id}')" style="background:none; border:none; color:#e74c3c; cursor:pointer; font-size:16px;" title="Delete Station"><i class="fas fa-trash"></i></button>
            </div>

            <div style="border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:15px; margin-bottom:15px; padding-right:60px;">
                <h4 style="color:#9b59b6; margin:0 0 15px 0; font-size:18px;"><i class="fas fa-charging-station"></i> ${s.name}</h4>
                
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <label style="font-size: 11px; color: #888; font-weight:bold; text-transform:uppercase;">Manage Operator:</label>
                    <select id="assign_op_${s.station_id}" style="width:100%; padding:10px; background:#2c3e50; color:white; border:1px solid #34495e; border-radius:8px; outline:none; font-size:13px;">
                        ${opOptions}
                    </select>
                    <button onclick="assignOperatorToStation('${s.station_id}')" style="width:100%; background:#9b59b6; border:none; color:white; padding:10px; border-radius:8px; cursor:pointer; font-weight:bold; font-size:13px; margin-top:4px;">
                        Update Assignment
                    </button>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <label style="font-size: 11px; color: #888; font-weight:bold; text-transform:uppercase;">Chargers Configuration:</label>
                <button onclick="openChargerModal('${s.station_id}')" style="background:#3498db; border:none; color:white; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">➕ Add Charger</button>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:12px;">`;

        // ÇÖKME ÖNLEYİCİ: Eğer istasyonun henüz cihazı yoksa kodu çökertmek yerine güvenli boş array kullan
        const stationChargers = s.chargers || [];

        if (stationChargers.length === 0) {
            html += `<div style="color:#e74c3c; font-size:12px; text-align:center; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px;">⚠️ This station has no chargers yet.</div>`;
        } else {
            stationChargers.forEach(c => {
                // Duruma göre renk ve ikon belirle
                let cStatusColor = c.status === 'available' ? '#2ecc71' : c.status === 'occupied' ? '#f39c12' : '#e74c3c';
                let cStatusIcon = c.status === 'available' ? '🟢' : c.status === 'occupied' ? '🟡' : '🔴';

                html += `
                <div style="background:rgba(0,0,0,0.3); padding:15px; border-radius:10px; border-left:4px solid #3498db; width:100%; position:relative;">
                    
                    <button onclick="deleteCharger('${c.charger_id}')" style="position:absolute; top:15px; right:15px; background:none; border:none; color:#e74c3c; cursor:pointer; font-size:14px;" title="Remove Charger"><i class="fas fa-trash"></i></button>

                    <div style="display:flex; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
                        <strong style="color:white; font-size:14px;">🔌 Charger #${c.charger_id}</strong>
                        <span style="font-size:11px; color:#bdc3c7; background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:4px;">${c.power_kW}kW ${c.connector_type}</span>
                        <span style="font-size:11px; color:${cStatusColor}; font-weight:bold;">${cStatusIcon} ${c.status.toUpperCase()}</span>
                    </div>
                    
                    <div style="display:flex; align-items:center; justify-content:flex-start; margin-top:12px; gap:10px;">
                        <span style="font-size:12px; color:#aaa; font-weight:bold;">₺/kWh:</span>
                        <input type="number" id="price_${c.charger_id}" value="${c.price_per_kWh}" step="0.5" style="width:70px; text-align:center; padding:6px; background:#2c3e50; color:white; border:1px solid #34495e; border-radius:6px; font-size:13px; outline:none;">
                        <button onclick="updateChargerPrice('${c.charger_id}')" style="background:#3498db; border:none; color:white; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;">Save</button>
                    </div>
                </div>`;
            });
        }
        html += `</div></div>`;
    });
    el.innerHTML = html;
}

// Düzenleme butonuna basıldığında veriyi güvenli şekilde modal'a aktaran fonksiyon
window.editStationAction = function(stationId) {
    const station = window.adminStationsData.find(s => s.station_id === stationId);
    if(station) {
        openStationModal(station);
    }
};

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

    stations.forEach(s => {
        if(s.chargers.some(charger => charger.charger_id === r.charger_id)) {
            sName = s.name;
        }
    });

    let statusColor = r.status === 'completed' ? '#2ecc71' : '#e74c3c';

    return `<div class="vehicle-item" style="border-left: 4px solid ${statusColor}; opacity:0.8;">
        <div class="vehicle-info" style="width: 100%;">
            <div style="display:flex; justify-content:space-between;">
                <strong>📅 ${r.date}</strong>
                <span style="font-size:9px; color:${statusColor};">${r.status.toUpperCase()}</span>
            </div>
            <p style="font-size:0.8rem; color:#888; margin:4px 0;">📍 ${sName}</p>
            ${r.charging_session ? `<p style="font-size:10px; color:#f1c40f; margin:0;">${r.charging_session.duration_min} min | ${r.charging_session.kwh_consumed} kWh | ${r.charging_session.total_cost} ₺</p>` : ''}
        </div>
    </div>`;
}

function startLiveDashboard(resId) {
    const token = localStorage.getItem("token");

    const livePanel = document.getElementById('liveChargingPanel');
    if (livePanel) {
        const stopBtn = livePanel.querySelector('button');
        if (stopBtn) stopBtn.onclick = () => window.stopCharging(resId);
    }

    let endTimeObj = null;
    let vehicleBatteryCapacity = 50; // Araç verisi gelmezse varsayılan 50 kWh
    let startingBatteryPct = 20; // Simülasyon gereği şarja %20'den başlıyoruz

    // 1. Rezervasyon ve Araç Bilgilerini Çek
    fetch("/reservations/me", { headers: { "Authorization": `Bearer ${token}` } })
        .then(res => res.json())
        .then(async reservations => {
            const currentRes = reservations.find(r => r.reservation_id == resId);
            if (currentRes) {
                // Bitiş saatini hesapla
                const [h, m, s] = currentRes.end_time.split(':');
                endTimeObj = new Date();
                endTimeObj.setHours(parseInt(h), parseInt(m), parseInt(s), 0);

                // 🚀 YENİ: Aracın kendi batarya kapasitesini (kWh) bul
                try {
                    const vRes = await fetch("/vehicles/me", { headers: { "Authorization": `Bearer ${token}` } });
                    if (vRes.ok) {
                        const vehicles = await vRes.json();
                        const vehicle = vehicles.find(v => v.vehicle_id === currentRes.vehicle_id);
                        if (vehicle && vehicle.battery_kWh) {
                            vehicleBatteryCapacity = vehicle.battery_kWh;
                        }
                    }
                } catch(e) { console.error("Araç bilgisi çekilemedi:", e); }
            }
        });

    let startTime = parseInt(localStorage.getItem('chargeStart_' + resId)) || Date.now();
    localStorage.setItem('chargeStart_' + resId, startTime);

    if(window.chargeInterval) clearInterval(window.chargeInterval);

    const balanceElement = document.getElementById("walletBalance");
    let initialBalance = parseFloat(balanceElement?.innerText || 0);
    const pricePerKwh = 7.5;

    // 2. Her Saniye Çalışan Canlı Döngü
    window.chargeInterval = setInterval(() => {
        let now = new Date();
        let elapsedSeconds = Math.floor((now.getTime() - startTime) / 1000);

        // kwh hesaplama (22kW şarj hızı varsayımıyla saniyelik tüketim)
        let kwh = (22 * (elapsedSeconds / 3600) * 0.8);
        let currentCost = parseFloat((kwh * pricePerKwh).toFixed(2));

        // 🚀 YENİ: Batarya Yüzdesini Hesapla
        let addedPct = (kwh / vehicleBatteryCapacity) * 100;
        let currentPct = startingBatteryPct + addedPct;
        if (currentPct > 100) currentPct = 100; // %100'ü geçmesini engelle

        // Arayüzü güncelle
        document.getElementById('liveTime').innerText = formatTime(elapsedSeconds);
        document.getElementById('liveKwh').innerText = kwh.toFixed(4);
        document.getElementById('liveCost').innerText = currentCost.toFixed(2);

        // Bataryayı ekrana yazdır (Örn: %21.5)
        const batteryEl = document.getElementById('liveBatteryPct');
        if (batteryEl) batteryEl.innerText = '%' + currentPct.toFixed(1);

        // --- BAKİYEYİ EŞ ZAMANLI DÜŞÜR ---
        let updatedBalance = (initialBalance - currentCost).toFixed(2);
        if (balanceElement) {
            balanceElement.innerText = updatedBalance;
        }

        // --- KONTROL 1: BAKİYE BİTTİ Mİ? ---
        if (updatedBalance <= 0) {
            stopChargingWithReason(resId, "Charging stopped because the balance was depleted.");
        }

        // --- KONTROL 2: SÜRE DOLDU MU? ---
        if (endTimeObj && now >= endTimeObj) {
            stopChargingWithReason(resId, "Charging has stopped because your reservation period has expired.");
        }

        // 🚀 KONTROL 3: BATARYA %100 OLDU MU? ---
        if (currentPct >= 100) {
            stopChargingWithReason(resId, "Charging stopped automatically. Battery is fully charged (%100).");
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
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`/reservations/${reservationId}/start`, {
            method: "PATCH",
            headers: { "Authorization": `Bearer ${token}` }
        });

        if(res.ok) {
            window.showCustomAlert("Charging started! We will monitor your balance.", "Success");
            window.location.reload();
        } else {
            const data = await res.json();
            window.showCustomAlert(data.detail || "Error starting charge", "Error");
        }
    } catch (e) { console.error(e); }
};

window.stopCharging = async function(resId) {
    const token = localStorage.getItem("token");

    window.showCustomConfirm("Do you want to stop charging and complete the session?", "Stop Charging", async () => {
        try {
            const res = await fetch(`/reservations/${resId}/complete`, {
                method: "PATCH",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                const msg = data.auto_stopped ? "⚠️ Balance too low! Charging auto-stopped." : "✅ Charging completed manually.";

                // 🚀 DÜZELTME: reload() komutunu alertin içine sakladık. Kullanıcı OK'a basana kadar sayfa yenilenmez!
                window.showCustomAlert(`${msg}\nCost: ${data.cost} TL\nEnergy: ${data.kwh} kWh`, "Session Ended", () => {
                    window.location.reload();
                });
            } else {
                window.showCustomAlert("Error stopping the charge.", "Error");
            }
        } catch (e) { console.error(e); }
    });
};

window.confirmCancelReservation = (id) => window.showCustomConfirm("Cancel booking?", "Cancel", async () => {
    try {
        const res = await fetch(`/reservations/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` } });
        if(res.ok) window.location.reload();
    } catch (e) { console.error(e); }
});


async function checkActiveChargingSession() {
    const token = localStorage.getItem("token");
    if (!token) return;

    // 🚀 YENİ KONTROL: Sadece sürücü ekranı (driverView) açıksa istek at, admin/operatörse durdur!
    const driverView = document.getElementById("driverView");
    if (!driverView || driverView.style.display === "none") {
        return;
    }

    try {
        const res = await fetch("/reservations/me", { headers: { "Authorization": `Bearer ${token}` } });
        if (!res.ok) return; // Eğer 403 vb. bir hata dönerse alt satırlara inip çökmesini engelle

        const reservations = await res.json();

        // Şuan şarjda olan bir rezervasyon var mı?
        const activeSession = reservations.find(r => r.status === "charging");

        if (activeSession) {
            // Kullanıcı verilerini çek (bakiye için)
            const userRes = await fetch("/users/me", { headers: { "Authorization": `Bearer ${token}` } });
            const userData = await userRes.json();
            const driverData = userData.driver_profile;

            // Eğer bakiye 5 TL'nin altına düştüyse otomatik durdur
            if (driverData && driverData.wallet_balance < 5.0) {
                console.log("Low balance detected! Auto-stopping...");
                window.stopCharging(activeSession.reservation_id);
            }
        }
    } catch (e) { console.log("Session monitor error"); }
}

// Her 10 saniyede bir bakiyeyi kontrol et
setInterval(checkActiveChargingSession, 10000);


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
// ==========================================
// 🛠️ ADMIN İSTASYON & CİHAZ CRUD İŞLEMLERİ 🛠️
// ==========================================

window.openStationModal = function(station = null) {
    document.getElementById("adminStationModal").style.display = "flex";

    // 1. Kutu İçeriklerini Doldur veya Boşalt
    if (station) {
        document.getElementById("stationModalTitle").innerText = "✏️ Edit Station";
        document.getElementById("editStationId").value = station.station_id;
        document.getElementById("mStationName").value = station.name;
        document.getElementById("mStationAddress").value = station.address;
        document.getElementById("mStationLat").value = station.latitude;
        document.getElementById("mStationLng").value = station.longitude;
        document.getElementById("mStationHours").value = station.operating_hours;
    } else {
        document.getElementById("stationModalTitle").innerText = "➕ Add Station";
        document.getElementById("editStationId").value = "";
        document.getElementById("mStationName").value = "";
        document.getElementById("mStationAddress").value = "";
        document.getElementById("mStationLat").value = "";
        document.getElementById("mStationLng").value = "";
        document.getElementById("mStationHours").value = "24/7";
    }

    // 2. Harita Kutusunu Görünür Yap
    const mapDiv = document.getElementById("adminMapPicker");
    if (!mapDiv) return; // Eğer HTML'e eklenmemişse hata vermesin
    mapDiv.style.display = "block";

    // 3. Haritayı Çizdir (Modalın açılmasını 200ms bekliyoruz ki harita gri kalmasın)
    setTimeout(() => {
        // İzmir merkez koordinatları (Varsayılan)
        let lat = parseFloat(document.getElementById("mStationLat").value) || 38.4237;
        let lng = parseFloat(document.getElementById("mStationLng").value) || 27.1428;

        const pickerMap = new google.maps.Map(mapDiv, {
            center: { lat: lat, lng: lng },
            zoom: 13,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false
        });

        // Sürüklenebilir Kırmızı Pin
        const pickerMarker = new google.maps.Marker({
            position: { lat: lat, lng: lng },
            map: pickerMap,
            draggable: true,
            title: "Konumu seçmek için beni sürükle!"
        });

        // OLAY 1: Kullanıcı pini sürükleyip bıraktığında
        pickerMarker.addListener("dragend", (e) => {
            document.getElementById("mStationLat").value = e.latLng.lat().toFixed(6);
            document.getElementById("mStationLng").value = e.latLng.lng().toFixed(6);
        });

        // OLAY 2: Kullanıcı haritada boş bir yere tıkladığında
        pickerMap.addListener("click", (e) => {
            pickerMarker.setPosition(e.latLng); // Pini tıklanan yere taşı
            document.getElementById("mStationLat").value = e.latLng.lat().toFixed(6);
            document.getElementById("mStationLng").value = e.latLng.lng().toFixed(6);
        });
    }, 200);
};

window.closeAdminModal = (id) => document.getElementById(id).style.display = "none";

window.submitStationForm = async function() {
    const token = localStorage.getItem("token");
    const id = document.getElementById("editStationId").value;
    const payload = {
        name: document.getElementById("mStationName").value,
        address: document.getElementById("mStationAddress").value,
        latitude: parseFloat(document.getElementById("mStationLat").value),
        longitude: parseFloat(document.getElementById("mStationLng").value),
        operating_hours: document.getElementById("mStationHours").value
    };

    // ID yoksa POST (admin.py rotası), varsa PUT (stations.py rotası)
    const url = id ? `/stations/${id}` : `/admin/stations`;
    const method = id ? "PUT" : "POST";

    try {
        const res = await fetch(url, {
            method: method,
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (res.ok) window.location.reload();
        else window.showCustomAlert("İşlem sırasında hata oluştu.", "Error");
    } catch (e) { console.error(e); }
};

window.deleteStation = function(id) {
    window.showCustomConfirm("This will delete the station and all its chargers. Are you sure?", "Delete Station", async () => {
        try {
            const res = await fetch(`/stations/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }});
            if (res.ok) window.location.reload();
        } catch (e) { console.error(e); }
    });
};

window.openChargerModal = function(stationId) {
    document.getElementById("adminChargerModal").style.display = "flex";
    document.getElementById("chargerTargetStationId").value = stationId;
};

window.submitChargerForm = async function() {
    const token = localStorage.getItem("token");
    const payload = {
        station_id: parseInt(document.getElementById("chargerTargetStationId").value),
        power_kW: parseFloat(document.getElementById("mChargerPower").value),
        price_per_kWh: parseFloat(document.getElementById("mChargerPrice").value),
        connector_type: document.getElementById("mChargerType").value,
        status: "available",
        type: document.getElementById("mChargerType").value === "Type 2" ? "AC" : "DC"
    };

    try {
        const res = await fetch(`/chargers/`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        if (res.ok) window.location.reload();
        else window.showCustomAlert("Error adding charger.", "Error");
    } catch (e) { console.error(e); }
};

window.deleteCharger = function(id) {
    window.showCustomConfirm("Are you sure you want to remove this charger?", "Remove Charger", async () => {
        try {
            const res = await fetch(`/chargers/${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }});
            if (res.ok) window.location.reload();
        } catch (e) { console.error(e); }
    });
};

// ==========================================
// 📊 ADMIN ANALYTICS & CHARTS 📊
// ==========================================

window.stationChartInstance = null;
window.peakChartInstance = null;

function renderAdminAnalytics(data) {
   // 1. Özet Kartlarını Doldur
    document.getElementById("analyticsTotalRevenue").innerText = (data.total_revenue || 0).toFixed(2) + " ₺";
    document.getElementById("analyticsTotalKwh").innerText = (data.total_kwh || 0).toFixed(2) + " kWh";

    // YENİ EKLENEN: Kullanıcı ve Sistem Verileri
    if (data.user_activity) {
        document.getElementById("analyticsTotalUsers").innerText = data.user_activity.total_users || 0;
        document.getElementById("analyticsTotalDrivers").innerText = data.user_activity.total_drivers || 0;
        document.getElementById("analyticsTotalOperators").innerText = data.user_activity.total_operators || 0;
        document.getElementById("analyticsActiveRes").innerText = data.user_activity.active_reservations || 0;
        document.getElementById("analyticsCompletedRes").innerText = data.user_activity.completed_sessions || 0;
    }

    // Genel Grafik Ayarları
    Chart.defaults.color = '#aaa';
    Chart.defaults.font.family = 'inherit';

    // 2. İstasyon Kullanım Grafiği (Bar Chart)
    const ctxStation = document.getElementById('stationUsageChart');
    if (ctxStation) {
        if (window.stationChartInstance) window.stationChartInstance.destroy(); // Eski grafiği sil (Bug olmaması için)

        window.stationChartInstance = new Chart(ctxStation.getContext('2d'), {
            type: 'bar',
            data: {
                labels: data.station_usage.map(s => s.station),
                datasets: [{
                    label: 'Charging Sessions',
                    data: data.station_usage.map(s => s.sessions),
                    backgroundColor: 'rgba(46, 204, 113, 0.6)',
                    borderColor: '#2ecc71',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
                plugins: { legend: { display: false } }
            }
        });
    }

    // 3. Peak Hour (Yoğun Saat) Grafiği (Line Chart)
    const ctxPeak = document.getElementById('peakHoursChart');
    if (ctxPeak) {
        if (window.peakChartInstance) window.peakChartInstance.destroy(); // Eski grafiği sil

        window.peakChartInstance = new Chart(ctxPeak.getContext('2d'), {
            type: 'line',
            data: {
                labels: data.peak_hours.map(p => p.hour + ":00"),
                datasets: [{
                    label: 'Active Sessions',
                    data: data.peak_hours.map(p => p.count),
                    backgroundColor: 'rgba(243, 156, 18, 0.2)',
                    borderColor: '#f39c12',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4 // Çizgileri tatlı bir şekilde yumuşatır
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true, suggestedMax: 5, ticks: { stepSize: 1 } } },
                plugins: { legend: { display: false } }
            }
        });
    }
}