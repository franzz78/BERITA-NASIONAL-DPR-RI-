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
const webhookConfigRef = db.ref("dprNirrConfig/webhookUrl");

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
const btnFetchLive = document.getElementById("btn-fetch-live");

let activeWebhookUrl = "";

// Fungsi Pencatatan Log Aktivitas
function addLog(message, type = "info") {
    const timeString = new Date().toLocaleTimeString("id-ID");
    const logDiv = document.createElement("div");
    
    let colorClass = "text-gray-400";
    if (type === "success") colorClass = "text-emerald-400";
    if (type === "error") colorClass = "text-rose-400";
    if (type === "info") colorClass = "text-amber-400";

    logDiv.className = colorClass;
    logDiv.textContent = `[${timeString}] ${message}`;
    logContainer.appendChild(logDiv);
    logContainer.scrollTop = logContainer.scrollHeight;
}

// Pantau Koneksi Firebase & Webhook Tersimpan
db.ref(".info/connected").on("value", (snapshot) => {
    if (snapshot.val() === true) {
        statusDot.className = "w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50";
        statusText.textContent = "Sistem Online & Terhubung";
        statFirebaseStatus.textContent = "Terhubung";
        statFirebaseStatus.className = "text-xs font-semibold px-2 py-1 rounded w-fit mt-1 bg-emerald-500/10 text-emerald-400";
        addLog("Berhasil terhubung ke Firebase Realtime Database.", "success");
    } else {
        statusDot.className = "w-3 h-3 rounded-full bg-rose-500 shadow-lg shadow-rose-500/50";
        statusText.textContent = "Koneksi Terputus";
        statFirebaseStatus.textContent = "Terputus";
        statFirebaseStatus.className = "text-xs font-semibold px-2 py-1 rounded w-fit mt-1 bg-rose-500/10 text-rose-400";
        addLog("Koneksi ke Firebase Realtime Database terputus.", "error");
    }
});

// Ambil Webhook dari Firebase
webhookConfigRef.on("value", (snapshot) => {
    const savedUrl = snapshot.val();
    if (savedUrl) {
        activeWebhookUrl = savedUrl;
        webhookUrlInput.value = "****************************************";
        webhookStatusHint.textContent = "Status: Webhook aktif dan tersimpan aman di database.";
        webhookStatusHint.className = "text-xs text-emerald-400";
    } else {
        activeWebhookUrl = "";
        webhookUrlInput.value = "";
        webhookStatusHint.textContent = "Status: Belum dikonfigurasi";
        webhookStatusHint.className = "text-xs text-gray-400";
    }
});

// Listener Berita Realtime
newsRef.on("value", (snapshot) => {
    const data = snapshot.val();
    newsTableBody.innerHTML = "";

    if (!data) {
        newsTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">Belum ada data berita. Klik tombol "Ambil Berita Riil" untuk menarik berita nasional terbaru.</td></tr>`;
        statTotalNews.textContent = "0";
        statSentDiscord.textContent = "0";
        return;
    }

    let newsArray = [];
    let sentCount = 0;

    Object.keys(data).forEach((key) => {
        newsArray.push({ id: key, ...data[key] });
    });

    newsArray.sort((a, b) => new Date(b.foundAt) - new Date(a.foundAt));
    statTotalNews.textContent = newsArray.length;

    newsArray.forEach((item) => {
        if (item.discordStatus === "Terkirim") sentCount++;

        const row = document.createElement("tr");
        row.className = "border-b border-white/5 hover:bg-white/[02] transition";

        row.innerHTML = `
            <td class="p-3 text-gray-300 whitespace-nowrap">${item.publishedAt || "-"}</td>
            <td class="p-3"><a href="${item.url}" target="_blank" class="text-nirrGold hover:underline font-medium">${item.title}</a></td>
            <td class="p-3 text-gray-300">${item.source || "Media Nasional"}</td>
            <td class="p-3 font-semibold ${item.discordStatus === 'Terkirim' ? 'text-emerald-400' : 'text-amber-400'}">${item.discordStatus || 'Menunggu'}</td>
            <td class="p-3 text-center">
                <button class="bg-white/10 hover:bg-white/15 border border-amber-500/20 text-white px-2.5 py-1 rounded text-xs font-semibold transition btn-send-single" data-id="${item.id}">Kirim Discord</button>
            </td>
        `;
        newsTableBody.appendChild(row);
    });

    // Pasang event handler untuk tombol kirim per baris
    document.querySelectorAll(".btn-send-single").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.target.getAttribute("data-id");
            const article = newsArray.find(n => n.id === id);
            if (article) sendToDiscordWebhook(article);
        });
    });

    statSentDiscord.textContent = sentCount;
    statLastUpdate.textContent = new Date().toLocaleTimeString("id-ID");
}, (error) => {
    addLog(`Kesalahan membaca database: ${error.message}`, "error");
});

// Fungsi Kirim ke Discord Webhook
async function sendToDiscordWebhook(article) {
    if (!activeWebhookUrl) {
        Swal.fire({
            icon: 'warning',
            title: 'Webhook Belum Diatur',
            text: 'Silakan masukkan dan simpan URL Discord Webhook terlebih dahulu.',
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
        return;
    }

    addLog(`Mengirim artikel "${article.title}" ke Discord...`, "info");

    const embedPayload = {
        username: "NIRR - Pemantau Berita DPR-RI",
        embeds: [
            {
                title: article.title,
                url: article.url,
                description: article.summary || "Ringkasan berita resmi mengenai kegiatan dan legislasi DPR-RI.",
                color: 16181772, // Emas-Oranye (#F59E0B)
                fields: [
                    {
                        name: "Sumber Berita",
                        value: article.source || "Media Nasional",
                        inline: true
                    }
                ],
                footer: {
                    text: "DEWAN PERWAKILAN RAKYAT REPUBLIK INDONESIA - NIRR"
                },
                timestamp: new Date().toISOString()
            }
        ],
        allowed_mentions: { parse: [] }
    };

    try {
        const response = await fetch(activeWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(embedPayload)
        });

        if (response.ok || response.status === 204) {
            await newsRef.child(article.id).update({ discordStatus: "Terkirim" });
            addLog(`Berita "${article.title}" berhasil dikirim ke Discord.`, "success");
            Swal.fire({
                icon: 'success',
                title: 'Berhasil Terkirim',
                text: 'Embed berita berhasil dikirim ke kanal Discord.',
                confirmButtonColor: '#F97316',
                background: '#111827',
                color: '#F9FAFB',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            throw new Error(`Gagal mengirim, status HTTP: ${response.status}`);
        }
    } catch (err) {
        addLog(`Gagal mengirim ke Discord: ${err.message}`, "error");
        Swal.fire({
            icon: 'error',
            title: 'Gagal Mengirim',
            text: `Terjadi kesalahan saat menghubungi Discord: ${err.message}`,
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
    }
}

// Tombol Ambil Berita Riil (Multi-Source API / RSS Feed Parser)
btnFetchLive.addEventListener("click", async () => {
    addLog("Memulai pengambilan berita riil nasional mengenai DPR-RI...", "info");
    btnFetchLive.disabled = true;
    btnFetchLive.textContent = "Memuat...";

    // Daftar RSS Feed publik media nasional Indonesia yang digabungkan via public rss2json API
    const rssFeeds = [
        { name: "ANTARA News", url: "https://www.antaranews.com/rss/parlemen" },
        { name: "CNN Indonesia", url: "https://www.cnnindonesia.com/nasional/rss" },
        { name: "Tempo Nasional", url: "https://tempo.co/rss/nasional" }
    ];

    let fetchedCount = 0;

    try {
        for (const feed of rssFeeds) {
            const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`;
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data && data.status === "ok" && data.items) {
                for (const item of data.items) {
                    // Filter relevansi kata kunci DPR atau Parlemen
                    const contentToCheck = (item.title + " " + (item.description || "")).toLowerCase();
                    if (contentToCheck.includes("dpr") || contentToCheck.includes("parlemen") || contentToCheck.includes("senayan") || contentToCheck.includes("dewan perwakilan")) {
                        
                        // Buat ID unik berdasarkan URL artikel
                        const uniqueId = "news_" + btoa(item.link).replace(/[^a-zA-Z0-9]/g, "").substring(0, 30);
                        
                        // Cek apakah sudah ada di Firebase
                        const snapshot = await newsRef.child(uniqueId).once("value");
                        if (!snapshot.exists()) {
                            const cleanSummary = (item.description || item.title).replace(/<[^>]*>?/gm, '').substring(0, 200) + "...";
                            
                            const newsItem = {
                                title: item.title,
                                url: item.link,
                                source: feed.name,
                                summary: cleanSummary,
                                publishedAt: new Date(item.pubDate).toLocaleString("id-ID"),
                                foundAt: new Date().toISOString(),
                                discordStatus: "Menunggu"
                            };

                            await newsRef.child(uniqueId).set(newsItem);
                            fetchedCount++;
                            addLog(`Ditemukan berita baru: [${feed.name}] ${item.title}`, "success");
                        }
                    }
                }
            }
        }

        Swal.fire({
            icon: 'success',
            title: 'Pemantauan Selesai',
            text: `Berhasil memperbarui dan menemukan ${fetchedCount} artikel baru yang membahas DPR-RI.`,
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });

    } catch (err) {
        addLog(`Kesalahan saat mengambil berita riil: ${err.message}`, "error");
        Swal.fire({
            icon: 'error',
            title: 'Gagal Mengambil Berita',
            text: 'Terjadi kendala jaringan saat mengakses feed berita nasional.',
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
    } finally {
        btnFetchLive.disabled = false;
        btnFetchLive.textContent = "Ambil Berita Riil";
    }
});

// Aksi Pengaturan Webhook
btnSaveWebhook.addEventListener("click", async () => {
    const url = webhookUrlInput.value.trim();
    if (!url.startsWith("https://discord.com/api/webhooks/")) {
        Swal.fire({
            icon: 'error',
            title: 'URL Tidak Valid',
            text: 'Pastikan URL Discord Webhook dimulai dengan https://discord.com/api/webhooks/',
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
        return;
    }

    try {
        await webhookConfigRef.set(url);
        activeWebhookUrl = url;
        webhookUrlInput.value = "****************************************";
        addLog("URL webhook berhasil disimpan ke database.", "success");
        Swal.fire({
            icon: 'success',
            title: 'Webhook Disimpan',
            text: 'Konfigurasi Discord Webhook berhasil disimpan.',
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
    } catch (err) {
        addLog(`Gagal menyimpan webhook: ${err.message}`, "error");
    }
});

btnTestWebhook.addEventListener("click", async () => {
    if (!activeWebhookUrl) {
        Swal.fire({
            icon: 'warning',
            title: 'Webhook Kosong',
            text: 'Masukkan dan simpan URL webhook terlebih dahulu sebelum menguji koneksi.',
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
        return;
    }

    addLog("Mengirim pesan uji koneksi ke Discord...", "info");
    try {
        const response = await fetch(activeWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: "Sistem Pemantau Berita Nasional DPR-RI (NIRR) berhasil terhubung ke kanal Discord ini.",
                allowed_mentions: { parse: [] }
            })
        });

        if (response.ok || response.status === 204) {
            addLog("Uji koneksi Discord Webhook berhasil.", "success");
            Swal.fire({
                icon: 'success',
                title: 'Koneksi Berhasil',
                text: 'Pesan uji coba berhasil dikirim ke Discord.',
                confirmButtonColor: '#F97316',
                background: '#111827',
                color: '#F9FAFB'
            });
        } else {
            throw new Error(`HTTP Status ${response.status}`);
        }
    } catch (err) {
        addLog(`Uji koneksi gagal: ${err.message}`, "error");
        Swal.fire({
            icon: 'error',
            title: 'Uji Koneksi Gagal',
            text: `Tidak dapat mengirim pesan ke Discord: ${err.message}`,
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
    }
});

btnDeleteWebhook.addEventListener("click", async () => {
    const result = await Swal.fire({
        title: 'Hapus Webhook?',
        text: 'Apakah Anda yakin ingin menghapus konfigurasi webhook?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#4B5563',
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        background: '#111827',
        color: '#F9FAFB'
    });

    if (result.isConfirmed) {
        await webhookConfigRef.remove();
        activeWebhookUrl = "";
        webhookUrlInput.value = "";
        webhookStatusHint.textContent = "Status: Belum dikonfigurasi";
        webhookStatusHint.className = "text-xs text-gray-400";
        addLog("Konfigurasi webhook dihapus dari database.", "info");
        Swal.fire({
            icon: 'success',
            title: 'Berhasil Dihapus',
            text: 'Webhook telah dihapus.',
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
    }
});

btnRefreshNews.addEventListener("click", () => {
    addLog("Memuat ulang data dari database...", "info");
    location.reload();
});
