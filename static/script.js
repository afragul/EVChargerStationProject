// --- GÖRÜNÜM DEĞİŞTİRME FONKSİYONU ---
// Profil bilgileri ve araç ekleme formu arasında geçiş yapar
function toggleVehicleView(showAdd) {
    const profileView = document.getElementById("profileView");
    const addView = document.getElementById("addView");

    if (showAdd) {
        profileView.style.display = "none";
        addView.style.display = "block";
    } else {
        profileView.style.display = "block";
        addView.style.display = "none";
    }
}

async function loadProfile() {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "/login";
        return;
    }

    try {
        const response = await fetch("/users/me", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (response.ok) {
            const data = await response.json();
            const user = data.user || data;

            window.currentUserId = user.user_id || user.id;

            document.getElementById("userName").innerText = user.name;
            document.getElementById("userEmail").innerText = user.email;

            const avatarLetter = document.getElementById("userNameLetter");
            if (avatarLetter) {
                avatarLetter.innerText = user.name.charAt(0).toUpperCase();
            }

            // 2. Rol Rozeti
            const roleBadge = document.getElementById("userRoleBadge");
            roleBadge.className = "role-badge"; // Sınıfları sıfırla
            roleBadge.innerText = user.role.charAt(0).toUpperCase() + user.role.slice(1);

            // 3. Cüzdan Bilgisi
            const walletBalanceEl = document.getElementById("walletBalance");
            if (walletBalanceEl && user.role === "driver") {
                try {
                    const balRes = await fetch("/payments/wallet-balance", {
                        method: "GET",
                        headers: { "Authorization": `Bearer ${token}` }
                    });
                    if (balRes.ok) {
                        const balData = await balRes.json();
                        walletBalanceEl.innerText = balData.balance.toFixed(2);
                    }
                } catch (e) {
                    console.error("Bakiye çekilemedi:", e);
                }
            }

            // 4. Araç Listesi
            if (user.role === "driver") {
                const vehiclesResponse = await fetch("/vehicles/me", {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });

                if (vehiclesResponse.ok) {
                    const vehicles = await vehiclesResponse.json();
                    const vehicleListEl = document.getElementById("vehicleList");

                    if (vehicleListEl) {
                        if (vehicles && vehicles.length > 0) {
                            vehicleListEl.innerHTML = vehicles.map((v, index) => `
                                <div class="vehicle-item" style="margin-bottom: 15px; padding: 12px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
                                    <div class="vehicle-info">
                                        <!-- index 0'dan başladığı için index + 1 diyoruz -->
                                        <strong style="font-size: 1.1em; color: #333;"> ${v.brand} - ${v.model}</strong>
                                        <div style="margin-top: 5px; color: #666; font-size: 0.9em;">
                                            <span> Plaka: <b>${v.plate_number}</b></span> <br>
                                            <span> Soket: <b>${v.connector_type}</b></span> | 
                                            <span> Batarya: <b>${v.battery_kWh} kWh</b></span>
                                        </div>
                                    </div>
                               </div>
                            `).join('');
                        } else {
                            vehicleListEl.innerHTML = '<p class="no-data" style="text-align:center; color:#666;">No vehicles registered.</p>';
                        }
                    }
                }
            }

            // 5. Dinamik İçerik (Account Status Başlığını Sildik)
            // Rol Bazlı İçerik Yönetimi (Account Status başlığı kaldırıldı)
            const statusContent = document.getElementById("statusContent");

            if (user.role === "driver") {
                roleBadge.classList.add("role-driver");
                // HTML'i buraya eksiksiz yazıyoruz ki veriden sonra "git-gel" yapmasın
                statusContent.innerHTML = `
                    <p style="color: #888; font-size: 0.9rem; margin-bottom: 15px; text-align: center;">
                        Ready to level up? Apply to be an operator!
                    </p>
                    <button class="btn-action btn-apply" onclick="applyForOperator()">
                        Apply as Operator
                    </button>
                `;
            } else if (user.role === "pending_operator") {
                roleBadge.classList.add("status-pending");
                statusContent.innerHTML = `
                    <div style="text-align: center; padding: 10px; background: rgba(241, 196, 15, 0.1); border-radius: 12px;">
                        <p style="color: #f1c40f; font-weight: bold;">Admin is currently reviewing your request.</p>
                    </div>
                `;
            } else if (user.role === "operator") {
                roleBadge.classList.add("role-operator");
                statusContent.innerHTML = `
                    <a href="/operator/dashboard" class="btn-action btn-apply" style="text-decoration: none; display: block; text-align: center;">
                        Go to Operator Dashboard
                    </a>
                `;
            }
        } else {
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
    } catch (error) {
        console.error("Profil yüklenirken hata oluştu:", error);
    }
}

// --- ARAÇ KAYDETME FONKSİYONU ---
document.getElementById("vehicleForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");

    const vehicleData = {
        brand: document.getElementById("vBrand").value,
        model: document.getElementById("vModel").value,
        plate_number: document.getElementById("vPlate").value,
        battery_kWh: parseFloat(document.getElementById("vBattery").value),
        connector_type: document.getElementById("vConnector").value,
        owner_id: 0
    };

    try {
        const response = await fetch("/vehicles/", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(vehicleData)
        });

        if (response.ok) {
            alert("Vehicle added successfully!");
            toggleVehicleView(false); // Profil ekranına dön
            loadProfile(); // Sayfayı yenilemeden verileri güncelle
        } else {
            alert("Could not add vehicle.");
        }
    } catch (error) {
        console.error("Araç ekleme hatası:", error);
    }
});

// --- OPERATÖR BAŞVURU FONKSİYONU ---
async function applyForOperator() {
    const token = localStorage.getItem("token");
    try {
        const response = await fetch("/users/operator-apply", {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (response.ok) {
            alert("Application received!");
            loadProfile();
        }
    } catch (error) {
        alert("An error occurred during application.");
    }
}

// --- ÇIKIŞ YAPMA FONKSİYONU ---
function handleLogout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
}

// Sayfa yüklendiğinde profili getir
document.addEventListener("DOMContentLoaded", loadProfile);

// --- BAKİYE YÜKLEME (TOP-UP) FONKSİYONU ---
window.topUpWallet = async function() {
    //  Kullanıcıdan tutar iste
    const amountStr = prompt("Yüklemek istediğiniz tutarı girin (₺):", "500");
    if (!amountStr) return; // İptal'e basarsa çık

    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
        alert("Lütfen geçerli bir sayı girin.");
        return;
    }

    if (!window.currentUserId) {
        alert("User not found. Please try again.");
        return;
    }

    const token = localStorage.getItem("token");

    const payload = {
        amount: amount,
        type: "TopUp",
        driver_id: window.currentUserId
    };

    try {
        const response = await fetch("/payments/topup", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert(` ${amount} ₺ başarıyla cüzdanınıza yüklendi!`);
            // Yeni bakiyeyi ekranda görmek için profili baştan yükle
            loadProfile();
        } else {
            const errorData = await response.json();
            alert("Yükleme başarısız: " + (errorData.detail || "Bilinmeyen hata"));
        }
    } catch (error) {
        console.error("Yükleme hatası:", error);
        alert("Sunucuya bağlanılamadı.");
    }
};