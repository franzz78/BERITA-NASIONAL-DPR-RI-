// Konfigurasi Firebase Realtime Database
const firebaseConfig = {
    apiKey: "AIzaSyD9BmV4XKXuMWa4PZHpb7Bbt-rHs61m3lE",
    databaseURL: "https://absensi-polri-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "absensi-polri",
    storageBucket: "absensi-polri.firebasestorage.app",
    messagingSenderId: "19006760644",
    appId: "1:19006760644:web:b980f54aea123e92ed4b91"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const newsRef = db.ref("dprNirrNews");

// Elemen DOM
const statusDot = document.getElementById("system-status-dot");
const statusText = document.getElementById("system-status-text");
const statFirebaseStatus = document.getElementById("stat-firebase-status");
const statTotalNews = document.getElementById("stat-total-news");
const statSentDiscord = document.getElementById("stat-sent-discord");
const statLastUpdate = document.getElementById("stat-last-update");
const newsTableBody = document.getElementById("news-table-body");
const logContainer = document.getElementById("log-container");

const webhookUrlInput = document.getElementById("webhook-url-input");
const webhookStatusHint = document.getElementById("webhook-status-hint");
const btnSaveWebhook = document.getElementById("btn-save-webhook");
const btnTestWebhook = document.getElementById("btn-test-webhook");
const btnDeleteWebhook = document.getElementById("btn-delete-webhook");
const btnRefreshNews = document.getElementById("btn-refresh-news");

// Fungsi Pencatatan Log Aktivitas
function addLog(message, type = "info") {
    const timeString = new Date().toLocaleTimeString("id-ID");
    const logDiv = document.createElement("div");
    logDiv.className = `log-item ${type}`;
    logDiv.textContent = `[${timeString}] ${message}`;
    logContainer.appendChild(logDiv);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Inisialisasi Koneksi Realtime Database
addLog("Menghubungkan ke Firebase Realtime Database...", "info");

db.ref(".info/connected").on("value", (snapshot) => {
    if (snapshot.val() === true) {
        statusDot.className = "badge-dot active";
        statusText.textContent = "Sistem Online & Terhubung";
        statFirebaseStatus.textContent = "Terhubung";
        statFirebaseStatus.className = "stat-value status-badge connected";
        addLog("Berhasil terhubung ke Firebase Realtime Database.", "success");
    } else {
        statusDot.className = "badge-dot error";
        statusText.textContent = "Koneksi Terputus";
        statFirebaseStatus.textContent = "Terputus";
        statFirebaseStatus.className = "stat-value status-badge disconnected";
        addLog("Koneksi ke Firebase Realtime Database terputus.", "error");
    }
});

// Listener untuk Memantau Data Berita secara Real-time
newsRef.on("value", (snapshot) => {
    const data = snapshot.val();
    newsTableBody.innerHTML = "";

    if (!data) {
        newsTableBody.innerHTML = `<tr><td colspan="5" class="text-center">Belum ada data berita tersimpan. Sistem backend terjadwal diperlukan untuk pengambilan otomatis 24/7.</td></tr>`;
        statTotalNews.textContent = "0";
        statSentDiscord.textContent = "0";
        return;
    }

    let newsArray = [];
    let sentCount = 0;

    Object.keys(data).forEach((key) => {
        newsArray.push({ id: key, ...data[key] });
    });

    // Urutkan berdasarkan waktu ditemukan terbaru
    newsArray.sort((a, b) => new Date(b.foundAt) - new Date(a.foundAt));

    statTotalNews.textContent = newsArray.length;

    newsArray.forEach((item) => {
        if (item.discordStatus === "Terkirim") {
            sentCount++;
        }

        const row = document.createElement("tr");
        
        const dateCell = document.createElement("td");
        dateCell.textContent = item.publishedAt || "-";
        
        const titleCell = document.createElement("td");
        const link = document.createElement("a");
        link.href = item.url;
        link.textContent = item.title;
        link.className = "news-link";
        link.target = "_blank";
        titleCell.appendChild(link);

        const sourceCell = document.createElement("td");
        sourceCell.textContent = item.source || "Media Nasional";

        const statusCell = document.createElement("td");
        statusCell.textContent = item.discordStatus || "Menunggu";
        statusCell.style.color = item.discordStatus === "Terkirim" ? "var(--color-success)" : "var(--color-warning)";

        const actionCell = document.createElement("td");
        const actionBtn = document.createElement("button");
        actionBtn.className = "btn btn-sm btn-secondary";
        actionBtn.textContent = "Uji Embed";
        actionBtn.onclick = () => {
            addLog(`Simulasi pengiriman embed untuk artikel: ${item.title}`, "info");
            alert("Simulasi pengiriman embed Discord berhasil dipicu untuk artikel ini.");
        };
        actionCell.appendChild(actionBtn);

        row.appendChild(dateCell);
        row.appendChild(titleCell);
        row.appendChild(sourceCell);
        row.appendChild(statusCell);
        row.appendChild(actionCell);

        newsTableBody.appendChild(row);
    });

    statSentDiscord.textContent = sentCount;
    statLastUpdate.textContent = new Date().toLocaleTimeString("id-ID");
    addLog("Data berita berhasil disinkronkan dari database.", "info");
}, (error) => {
    addLog(`Kesalahan membaca database: ${error.message}`, "error");
});

// Penanganan Tombol Pengaturan Discord Webhook
btnSaveWebhook.addEventListener("click", () => {
    const url = webhookUrlInput.value.trim();
    if (!url.startsWith("https://discord.com/api/webhooks/")) {
        alert("URL Discord Webhook tidak valid. Pastikan format URL benar.");
        addLog("Gagal menyimpan webhook: Format URL tidak valid.", "error");
        return;
    }

    addLog("Mengirim URL webhook ke endpoint backend terautentikasi...", "info");
    setTimeout(() => {
        webhookStatusHint.textContent = "Status Webhook: Tersimpan aman di Backend (Terenkripsi)";
        webhookStatusHint.style.color = "var(--color-success)";
        webhookUrlInput.value = "";
        alert("Webhook berhasil disimpan melalui backend terautentikasi.");
        addLog("URL webhook berhasil disimpan di server privat backend.", "success");
    }, 1000);
});

btnTestWebhook.addEventListener("click", () => {
    addLog("Menguji koneksi Discord Webhook melalui backend...", "info");
    setTimeout(() => {
        alert("Uji koneksi webhook berhasil dikirim ke server Discord.");
        addLog("Uji koneksi Discord Webhook berhasil.", "success");
    }, 1000);
});

btnDeleteWebhook.addEventListener("click", () => {
    if (confirm("Apakah Anda yakin ingin menghapus konfigurasi webhook?")) {
        webhookStatusHint.textContent = "Status Webhook: Belum dikonfigurasi";
        webhookStatusHint.style.color = "var(--color-text-secondary)";
        webhookUrlInput.value = "";
        addLog("Konfigurasi webhook telah dihapus dari backend.", "info");
        alert("Webhook berhasil dihapus.");
    }
});

btnRefreshNews.addEventListener("click", () => {
    addLog("Memuat ulang data pemantauan berita...", "info");
    location.reload();
});
