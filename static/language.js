// ==========================================
// 🌍 DİNAMİK DİL SİSTEMİ (EN / TR) 🌍
// ==========================================

const trDictionary = {
    // -----------------------------------------
    // 1. MENÜLER VE ANA BAŞLIKLAR
    // -----------------------------------------
    "Notifications": "Bildirimler",
    "← Back": "← Geri",
    "Wallet": "Cüzdan",
    "+ Top Up": "+ Bakiye Yükle",
    "My Vehicles": "Araçlarım",
    "+ Add": "+ Ekle",
    "Favorite Stations": "Favori İstasyonlar",
    "Active Reservations": "Aktif Rezervasyonlar",
    "Charging History": "Şarj Geçmişi",
    "Sign Out": "Çıkış Yap",

    // -----------------------------------------
    // 2. ARAÇ VE ŞARJ FORMLARI
    // -----------------------------------------
    "Add New Vehicle": "Yeni Araç Ekle",
    "Brand": "Marka",
    "Model": "Model",
    "Plate": "Plaka",
    "Battery (kWh)": "Batarya (kWh)",
    "Connector": "Soket Tipi",
    "Save Vehicle": "Aracı Kaydet",
    "LIVE CHARGING": "CANLI ŞARJ",
    "TIME": "SÜRE",
    "ENERGY": "ENERJİ",
    "COST": "MALİYET",
    "🛑 STOP CHARGING": "🛑 ŞARJI DURDUR",

    // -----------------------------------------
    // 3. ADMİN VE OPERATÖR PANELİ
    // -----------------------------------------
    "🚨 Issue Reports (Arızalar)": "🚨 Arıza Bildirimleri",
    "🔌 Managed Stations (İstasyonlarım)": "🔌 İstasyonlarım",
    "🏢 Pending Operator Approvals": "🏢 Bekleyen Operatör Onayları",
    "Pending Station Claims": "Bekleyen İstasyon Talepleri",
    "Station Management & Assignments": "İstasyon Yönetimi ve Atamalar",
    "DASHBOARD ANALYTICS": "PANEL İSTATİSTİKLERİ",
    "Total Network Revenue": "Toplam Sistem Geliri",
    "Total Energy Delivered": "Dağıtılan Toplam Enerji",
    "Station Usage (Sessions)": "İstasyon Kullanım Sayısı",
    "Peak Charging Hours": "Yoğun Şarj Saatleri",
    "➕ Create New Station": "➕ Yeni İstasyon Kur",
    "Manage Operator:": "Operatör Ata:",
    "Update Assignment": "Atamayı Güncelle",
    "Chargers Configuration:": "Cihaz Yapılandırması:",
    "➕ Add Charger": "➕ Cihaz Ekle",
    "-- Unassigned (Available) --": "-- Atanmamış (Uygun) --",
    "⚠️ This station has no chargers yet":"⚠️ Bu istasyonda henüz şarj cihazı bulunmamaktadır.",

    // -----------------------------------------
    // 4. BUTONLAR, ETİKETLER VE DURUMLAR
    // -----------------------------------------
    "Save": "Kaydet",
    "Cancel": "İptal",
    "Submit": "Gönder",
    "Remove": "Kaldır",
    "Start": "Başlat",
    "Report": "Bildir",
    "⚡ Start": "⚡ Başlat",    // Emojiler eklendi!
    "🚨 Report": "🚨 Bildir",    // Emojiler eklendi!
    "Approve & Assign": "Onayla ve Ata",
    "Grant Station Access": "İstasyon Erişimini Ver",
    "✅ Mark as Resolved": "✅ Çözüldü Olarak İşaretle",
    "WAITING": "BEKLİYOR",
    "COMPLETED": "TAMAMLANDI",
    "CANCELLED": "İPTAL EDİLDİ",
    "CHARGING": "ŞARJ OLUYOR",
    "Unknown": "Bilinmiyor",
    "min": "dk",
    "Type 2": "Tip 2",
    "🟢 Available": "🟢 Uygun",
    "🟡 Occupied": "🟡 Dolu",
    "🔴 Offline (Out of Service)": "🔴 Çevrimdışı (Hizmet Dışı)",
    "Hardware Failure": "Donanım Arızası",
    "Cable Damage": "Kablo Hasarı",
    "Software Issue": "Yazılım Sorunu",
    "Details...": "Detaylar...",

    // -----------------------------------------
    // 5. UYARI MODALI BAŞLIKLARI (SweetAlert Tarzı)
    // -----------------------------------------
    "Success": "Başarılı",
    "Error": "Hata",
    "Session Ended": "Oturum Sonlandı",
    "System Stopped.": "Sistem Durduruldu",
    "Status Update": "Durum Güncellemesi",
    "Resolve Issue": "Arıza Çözümü",
    "Delete Vehicle": "Aracı Sil",
    "Remove Charger": "Cihazı Kaldır",
    "Delete Station": "İstasyonu Sil",
    "Approve Claim": "Talebi Onayla",
    "Approve Operator": "Operatörü Onayla",
    "Station Required": "İstasyon Gerekli",
    "Stop Charging": "Şarjı Durdur",

    // -----------------------------------------
    // 6. UYARI VE BİLDİRİM METİNLERİ (Cümleler)
    // -----------------------------------------
    "No new notifications.": "Yeni bildirim yok.",
    "No pending reservations.": "Bekleyen rezervasyon yok.",
    "No history.": "Geçmiş yok.",
    "No favorites.": "Favori istasyon yok.",
    "No active issue reports.": "Aktif arıza bildirimi yok.",
    "You have no stations assigned yet.": "Henüz size atanmış bir istasyon yok.",
    "No stations found in the system.": "Sistemde istasyon bulunamadı.",
    "No pending operator registrations.": "Bekleyen operatör kaydı yok.",
    "No pending station claims.": "Bekleyen istasyon talebi yok.",

    "Operator successfully assigned to station.": "Operatör başarıyla istasyona atandı.",
    "Station assignment updated successfully.": "İstasyon ataması başarıyla güncellendi.",
    "Error assigning operator.": "Operatör atanırken hata oluştu.",
    "Price updated successfully.": "Fiyat başarıyla güncellendi.",
    "Error updating price.": "Fiyat güncellenirken hata oluştu.",
    "Error updating status.": "Durum güncellenirken hata oluştu.",
    "Report Sent": "Bildirim Gönderildi",
    "Error adding charger.": "Cihaz eklenirken hata oluştu.",
    "Error adding vehicle": "Araç eklenirken hata oluştu.",
    "Vehicle added successfully!": "Araç başarıyla eklendi!",
    "The vehicle has been successfully deleted.": "Araç başarıyla silindi.",
    "An error occurred while deleting the vehicle.": "Araç silinirken bir hata oluştu.",

    "Charging started! We will monitor your balance.": "Şarj başladı! Bakiyenizi takip edeceğiz.",
    "Error starting charge": "Şarj başlatılırken hata oluştu.",
    "Error stopping the charge.": "Şarj durdurulurken hata oluştu.",
    "⚠️ Balance too low! Charging auto-stopped.": "⚠️ Bakiye çok düşük! Şarj otomatik durduruldu.",
    "✅ Charging completed manually.": "✅ Şarj manuel olarak tamamlandı.",
    "Charging stopped because the balance was depleted.": "Bakiye tükendiği için şarj durduruldu.",
    "Charging has stopped because your reservation period has expired.": "Rezervasyon süreniz dolduğu için şarj durduruldu.",

    // -----------------------------------------
    // 7. ONAY (CONFIRM) METİNLERİ
    // -----------------------------------------
    "Cancel booking?": "Rezervasyonu iptal etmek istiyor musunuz?",
    "Do you want to stop charging and complete the session?": "Şarjı durdurup oturumu sonlandırmak istiyor musunuz?",
    "Are you sure you want to delete this tool?": "Bu aracı silmek istediğinize emin misiniz?",
    "Are you sure you want to remove this charger?": "Bu cihazı kaldırmak istediğinize emin misiniz?",
    "This will delete the station and all its chargers. Are you sure?": "Bu işlem istasyonu ve tüm cihazlarını silecek. Emin misiniz?",
    "Mark issue as resolved?": "Arızayı çözüldü olarak işaretlemek istiyor musunuz?",
    "Grant this station to the requesting operator?": "Bu istasyonu talep eden operatöre devretmek istiyor musunuz?",
    "Approve operator and assign the selected station?": "Operatörü onaylayıp seçilen istasyonu atamak istiyor musunuz?",
    "You must assign an available station to the operator before approving.": "Onaylamadan önce operatöre uygun bir istasyon atamalısınız.",
    // -----------------------------------------
    // 8. MODAL İÇİ FORMLAR (İstasyon ve Cihaz Ekleme)
    // -----------------------------------------
    "🔌 Add Charger": "🔌 Cihaz Ekle",
    "Power (kW)": "Güç (kW)",
    "Price (₺)": "Fiyat (₺)",
    "Connector Type": "Soket Tipi",
    "➕ Add Station": "➕ İstasyon Ekle",
    "✏️ Edit Station": "✏️ İstasyonu Düzenle",
    "Station Name": "İstasyon Adı",
    "Address": "Adres",
    "Latitude (Enlem)": "Enlem",
    "Longitude (Boylam)": "Boylam",
    "Operating Hours": "Çalışma Saatleri",
    // -----------------------------------------
    // 9. SÜRÜCÜ VE OPERATÖR MODALLARI
    // -----------------------------------------
    "🚨 Report Issue": "🚨 Arıza Bildir",
    "Top Up Wallet": "Cüzdana Para Yükle",
    "Amount (TL)": "Tutar (TL)",
    "Amount (₺)": "Tutar (₺)",
    "Card Number": "Kart Numarası",
    "Expiry Date": "Son Kullanma Tarihi",
    "CVV": "CVV",
    "Confirm": "Onayla",
    "Pay": "Öde",
    "Add Balance": "Bakiye Ekle",
    // -----------------------------------------
    // 10. İNATÇI MODAL METİNLERİ VE GİRİŞ EKRANI
    // -----------------------------------------
    "CIHAZ YAPILANDIRMASI:": "CİHAZ YAPILANDIRMASI:", // Eğer büyük harfle yazıldıysa
    "This station has no chargers yet.": "Bu istasyonda henüz cihaz yok.",
    "Are you sure you want to delete this tool?": "Bu aracı silmek istediğinizden emin misiniz?",
    "Are you sure you want to remove this charger?": "Bu cihazı kaldırmak istediğinizden emin misiniz?",
    "This will delete the station and all its chargers. Are you sure?": "Bu işlem istasyonu ve tüm cihazlarını silecek. Emin misiniz?",
    "EV Charging System": "Elektrikli Araç Şarj Sistemi",
    "Enter your details to access the panel": "Panele erişmek için bilgilerinizi girin",
    "Email Address": "E-posta Adresi",
    "Password": "Şifre",
    "Remember Me": "Beni Hatırla",
    "Forgot Password?": "Şifremi Unuttum?",
    "Sign In to System": "Sisteme Giriş Yap",
    "Don't have an account yet?": "Henüz bir hesabınız yok mu?",
    "Create New Account": "Yeni Hesap Oluştur",
    "or": "veya",
    "Want to manage a station?": "Bir istasyon mu yönetmek istiyorsunuz?",
    "Apply as Operator": "Operatör Olarak Başvur",
    // 11. HARİTA (MAPS) VE REZERVASYON MODALI
    // -----------------------------------------
    "EV Stations Map": "Şarj İstasyonları Haritası",
    "Profile": "Profil",
    "Logout": "Çıkış Yap",
    "⚡ Reserve Charger": "⚡ Cihaz Rezerve Et",
    "Your Vehicle": "Aracınız",
    "Date": "Tarih",
    "📅 Occupied Hours on this Date": "📅 Bu Tarihteki Dolu Saatler",
    "Start Time": "Başlangıç Saati",
    "End Time": "Bitiş Saati",
    "* A provision fee (100 TL) will be deducted from your wallet upon confirmation.": "* Onaylandığında cüzdanınızdan provizyon ücreti (100 TL) kesilecektir.",
    "Notification": "Bildirim",
    "Message goes here.": "Mesaj buraya gelecek.",
    "OK": "Tamam",
    // PROFİL SAYFASI EKSİKLERİ
    "DRIVER": "SÜRÜCÜ",
    "OPERATOR": "OPERATÖR",
    "ADMIN": "YÖNETİCİ",
    "EMAIL": "E-POSTA",
    "WALLET": "CÜZDAN",
    "Back": "Geri",
    // SİSTEM REZERVASYONLARI TABLOSU
    "System Reservations": "Sistem Rezervasyonları",
    "Date & Time": "Tarih ve Saat",
    "Driver": "Sürücü",
    "Vehicle": "Araç",
    "Station (Charger)": "İstasyon (Cihaz)",
    "Status": "Durum",
    "No reservations found in the system.": "Sistemde rezervasyon bulunamadı."
};

// Tarayıcı hafızasından seçili dili al (Varsayılan: İngilizce)
let currentLang = localStorage.getItem("appLang") || "en";

// Butona basıldığında dili değiştir ve sayfayı yenile
function toggleLanguage() {
    currentLang = currentLang === "en" ? "tr" : "en";
    localStorage.setItem("appLang", currentLang);
    location.reload();
}

// 🪄 Çeviri Motoru: Sayfadaki tüm metinleri tarar ve sözlükte varsa çevirir
function translateDOM(node) {
    if (currentLang === "en") return; // Dil İngilizce ise motoru durdur

    // Eğer node bir metin kutusuysa (Yazı)
    if (node.nodeType === 3) {
        let text = node.nodeValue.trim();
        if (text === "") return;

        // 1. Önce tam eşleşme (Sözlükten) ara
        if (trDictionary[text]) {
            node.nodeValue = node.nodeValue.replace(text, trDictionary[text]);
            return;
        }

        // 2. EĞER TAM EŞLEŞME YOKSA: Dinamik (içinde sayı/tarih olan) bildirimleri Regex ile avla

        // Kural 1: Çevrimdışı olma ve İade bildirimi (Senin attığın fotoğraftaki)
        let match1 = /Charger #(\d+) went offline\. Your reservation on ([\d-]+) is cancelled and ([\d.]+) TL is refunded\./;
        if (match1.test(text)) {
            node.nodeValue = text.replace(match1, "Cihaz #$1 çevrimdışı oldu. $2 tarihli rezervasyonunuz iptal edildi ve $3 TL iade edildi.");
            return;
        }

        // Kural 2: Fiyat Güncelleme Bildirimi
        let match2 = /Charger #(\d+) price updated to ([\d.]+) ₺\./;
        if (match2.test(text)) {
            node.nodeValue = text.replace(match2, "Cihaz #$1 fiyatı $2 ₺ olarak güncellendi.");
            return;
        }

        // Kural 3: Cihaz Durumu Güncelleme Bildirimi
        let match3 = /Charger status updated to (.*)\./;
        if (match3.test(text)) {
            let durum = text.match(match3)[1];
            // Eğer durum kelimesinin sözlükte karşılığı varsa (available -> Uygun gibi) onu da çevir
            let cevrilmisDurum = trDictionary[durum] || durum;
            node.nodeValue = text.replace(match3, `Cihaz durumu ${cevrilmisDurum} olarak güncellendi.`);
            return;
        }
        // Kural 4: Sürücü Arıza Bildirim Modalı Dinamik Başlığı
        let match4 = /Reporting for Charger #(\d+)/;
        if (match4.test(text)) {
            node.nodeValue = text.replace(match4, "Cihaz #$1 için arıza bildiriliyor");
            return;
        }

    }
    // Eğer node bir HTML elemanıysa (div, span, buton vb.) ve script değilse içindekileri tara
    else if (node.nodeType === 1 && node.nodeName !== "SCRIPT" && node.nodeName !== "STYLE") {
        if (node.placeholder && trDictionary[node.placeholder.trim()]) {
            node.placeholder = trDictionary[node.placeholder.trim()];
        }
        node.childNodes.forEach(translateDOM);
    }
}

// Sayfa ilk yüklendiğinde ve dinamik içerik geldiğinde motoru çalıştır
document.addEventListener("DOMContentLoaded", () => {
    // Butonun üzerindeki bayrağı ayarla
    const langBtn = document.getElementById("langBtn");
    if(langBtn) {
        langBtn.innerHTML = currentLang === "en" ? "TR 🇹🇷" : "EN 🇬🇧";
    }

    // İlk yüklemedeki sabit yazıları çevir
    translateDOM(document.body);

    // JS ile sonradan eklenen listeleri/istasyonları yakalamak için gözlemci (Observer)
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if(node.nodeType === 1) translateDOM(node);
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
});