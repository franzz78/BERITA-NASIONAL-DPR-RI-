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
const webhookConfigRef = db.ref("dprNirrConfig/webhookData");

// Elemen DOM
const statusDot = document.getElementById("system-status-dot");
const statusText = document.getElementById("system-status-text");
const statFirebaseStatus = document.getElementById("stat-firebase-status");
const statTotalNews = document.getElementById("stat-total-news");
const statSentDiscord = document.getElementById("stat-sent-discord");
const statNextScan = document.getElementById("stat-next-scan");
const newsTableBody = document.getElementById("news-table-body");
const logContainer = document.getElementById("log-container");

const webhookUrlInput = document.getElementById("webhook-url-input");
const webhookMessageInput = document.getElementById("webhook-message-input");
const webhookMentionInput = document.getElementById("webhook-mention-input");
const webhookStatusHint = document.getElementById("webhook-status-hint");
const btnSaveWebhook = document.getElementById("btn-save-webhook");
const btnTestWebhook = document.getElementById("btn-test-webhook");
const btnDeleteWebhook = document.getElementById("btn-delete-webhook");
const btnRefreshNews = document.getElementById("btn-refresh-news");
const btnFetchLive = document.getElementById("btn-fetch-live");
const btnBroadcastLive = document.getElementById("btn-broadcast-live");

let activeConfig = {
    url: "",
    message: "",
    mention: ""
};

// Daftar 22 Media Nasional
const MEDIA_SOURCES = [
    { name: "ANTARA News", url: "https://www.antaranews.com/rss/parlemen" },
    { name: "Kompas.com", url: "https://news.kompas.com/search/dpr" },
    { name: "detikcom", url: "https://news.detik.com/rss" },
    { name: "CNN Indonesia", url: "https://www.cnnindonesia.com/nasional/rss" },
    { name: "Tempo.co", url: "https://tempo.co/rss/nasional" },
    { name: "Liputan6.com", url: "https://www.liputan6.com/rss" },
    { name: "Tribunnews", url: "https://www.tribunnews.com/rss" },
    { name: "Kumparan", url: "https://kumparan.com/rss" },
    { name: "Republika", url: "https://www.republika.co.id/rss" },
    { name: "SINDOnews", url: "https://www.sindonews.com/rss" },
    { name: "Metro TV", url: "https://www.metrotvnews.com/rss" },
    { name: "tvOne", url: "https://www.tvonenews.com/rss" },
    { name: "iNews", url: "https://www.inews.id/rss" },
    { name: "Okezone", url: "https://news.okezone.com/rss" },
    { name: "Suara.com", url: "https://www.suara.com/rss" },
    { name: "VIVA", url: "https://www.viva.co.id/rss" },
    { name: "Merdeka.com", url: "https://www.merdeka.com/feed/" },
    { name: "Media Indonesia", url: "https://mediaindonesia.com/rss" },
    { name: "RMOL", url: "https://rmol.id/rss" },
    { name: "JPNN", url: "https://www.jpnn.com/index.php?mib=rss" },
    { name: "Bisnis.com", url: "https://kabar24.bisnis.com/rss" },
    { name: "Katadata", url: "https://katadata.co.id/rss" }
];

let queuedArticles = [];
let isSendingQueue = false;
let countdownTimer = 60;

// Catatan Log Aktivitas
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

// Monitoring Koneksi Database & Config
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

webhookConfigRef.on("value", (snapshot) => {
    const data = snapshot.val();
    if (data && data.url) {
        activeConfig = data;
        webhookUrlInput.value = "****************************************";
        webhookMessageInput.value = data.message || "";
        webhookMentionInput.value = data.mention || "";
        webhookStatusHint.textContent = "Status: Webhook aktif (Auto-send 24/7).";
        webhookStatusHint.className = "text-xs text-emerald-400";
    } else {
        activeConfig = { url: "", message: "", mention: "" };
        webhookUrlInput.value = "";
        webhookMessageInput.value = "";
        webhookMentionInput.value = "";
        webhookStatusHint.textContent = "Status: Belum dikonfigurasi";
        webhookStatusHint.className = "text-xs text-gray-400";
    }
});

// Listener Berita Realtime
newsRef.on("value", (snapshot) => {
    const data = snapshot.val();
    newsTableBody.innerHTML = "";

    if (!data) {
        newsTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">Belum ada data berita. Sistem sedang memindai berita pejabat & parlemen secara otomatis...</td></tr>`;
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
                <button class="bg-white/10 hover:bg-white/15 border border-amber-500/20 text-white px-2.5 py-1 rounded text-xs font-semibold transition btn-send-single" data-id="${item.id}">Kirim Manual</button>
            </td>
        `;
        newsTableBody.appendChild(row);
    });

    document.querySelectorAll(".btn-send-single").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const id = e.target.getAttribute("data-id");
            const article = newsArray.find(n => n.id === id);
            if (article) sendToDiscordWebhook(article);
        });
    });

    statSentDiscord.textContent = sentCount;
}, (error) => {
    addLog(`Kesalahan membaca database: ${error.message}`, "error");
});

// Kirim Embed Berita ke Discord Webhook (Dengan Jeda Antar Pengiriman)
async function sendToDiscordWebhook(article) {
    if (!activeConfig.url) return false;

    addLog(`Mengirim berita otomatis ke Discord: ${article.title}`, "info");

    let contentMessage = "";
    if (activeConfig.mention) contentMessage += `${activeConfig.mention} `;
    if (activeConfig.message) contentMessage += `${activeConfig.message}\n`;

    const payload = {
        username: "NIRR - Pemantau Berita Otomatis",
        content: contentMessage.trim() || undefined,
        embeds: [
            {
                title: article.title,
                url: article.url,
                description: article.summary || "Ringkasan berita resmi mengenai kegiatan pejabat dan nasional.",
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
        allowed_mentions: { parse: ["users", "roles", "everyone"] }
    };

    try {
        const response = await fetch(activeConfig.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok || response.status === 204) {
            await newsRef.child(article.id).update({ discordStatus: "Terkirim" });
            addLog(`Berhasil terkirim otomatis: ${article.title}`, "success");
            return true;
        } else {
            throw new Error(`HTTP Status ${response.status}`);
        }
    } catch (err) {
        addLog(`Gagal mengirim ke Discord: ${err.message}`, "error");
        return false;
    }
}

// Proses Antrean Pengiriman dengan Jeda 1 Menit (60 Detik)
async function processQueue() {
    if (isSendingQueue || queuedArticles.length === 0) return;
    isSendingQueue = true;

    while (queuedArticles.length > 0) {
        const article = queuedArticles.shift();
        
        // Periksa status terbaru di database apakah sudah terkirim atau belum
        const snap = await newsRef.child(article.id).once("value");
        if (snap.exists() && snap.val().discordStatus !== "Terkirim") {
            await sendToDiscordWebhook(article);
            
            // Jeda 1 menit (60 detik) sebelum mengirim artikel berikutnya agar tidak spam
            if (queuedArticles.length > 0) {
                addLog("Menunggu jeda 1 menit sebelum mengirim berita berikutnya...", "info");
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
        }
    }

    isSendingQueue = false;
}

// Fungsi Pemindaian Otomatis Berita Pejabat & Parlemen dari 22 Media
async function scanAndAutoSendNews(isManual = false) {
    if (isManual) {
        addLog("Memulai pemindaian manual berita pejabat & parlemen...", "info");
    } else {
        addLog("Memulai pemindaian otomatis 22 Media Nasional...", "info");
    }

    let newFoundCount = 0;

    for (const media of MEDIA_SOURCES) {
        try {
            const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(media.url)}`;
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data && data.status === "ok" && data.items) {
                for (const item of data.items) {
                    const text = (item.title + " " + (item.description || "")).toLowerCase();
                    
                    // Filter relevansi: mencakup DPR, pejabat, menteri, presiden, kementerian, politisi, kebijakan, atau parlemen
                    const keywords = ["dpr", "pejabat", "menteri", "presiden", "parlemen", "senayan", "kebijakan", "kementerian", "politik", "hukum", "anggaran", "uu", "wakil rakyat"];
                    const isRelevant = keywords.some(kw => text.includes(kw));

                    if (isRelevant || isManual) {
                        const uniqueId = "news_" + btoa(item.link).replace(/[^a-zA-Z0-9]/g, "").substring(0, 30);
                        const snapshot = await newsRef.child(uniqueId).once("value");

                        if (!snapshot.exists()) {
                            const cleanSummary = (item.description || item.title).replace(/<[^>]*>?/gm, '').substring(0, 200) + "...";
                            
                            const newsItem = {
                                title: item.title,
                                url: item.link,
                                source: media.name,
                                summary: cleanSummary,
                                publishedAt: new Date(item.pubDate || Date.now()).toLocaleString("id-ID"),
                                foundAt: new Date().toISOString(),
                                discordStatus: "Menunggu"
                            };

                            await newsRef.child(uniqueId).set(newsItem);
                            newFoundCount++;
                            
                            // Masukkan ke antrean kirim otomatis
                            queuedArticles.push({ id: uniqueId, ...newsItem });
                            addLog(`Ditemukan berita baru: [${media.name}] ${item.title}`, "success");
                        }
                    }
                }
            }
        } catch (err) {
            continue;
        }
    }

    // Mulai proses antrean pengiriman otomatis
    if (queuedArticles.length > 0 && !isSendingQueue) {
        processQueue();
    }

    if (isManual) {
        Swal.fire({
            icon: 'success',
            title: 'Pemindaian Selesai',
            text: `Berhasil menemukan dan mengantrekan ${newFoundCount} berita pejabat & nasional baru.`,
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
    }
}

// Timer Hitung Mundur untuk Interval Otomatis 1 Menit (60 Detik)
function startAutoInterval() {
    setInterval(() => {
        countdownTimer--;
        if (countdownTimer <= 0) {
            countdownTimer = 60;
            scanAndAutoSendNews(false); // Pemindaian otomatis berjalan di background
        }
        statNextScan.textContent = `${countdownTimer} detik`;
    }, 1000);
}

// Jalankan pemindaian pertama kali saat halaman dimuat
setTimeout(() => {
    scanAndAutoSendNews(false);
    startAutoInterval();
}, 2000);

// Tombol Scan Manual
btnFetchLive.addEventListener("click", () => {
    scanAndAutoSendNews(true);
});

// Kirim Live Streaming TVR PARLEMEN ke Discord Webhook
btnBroadcastLive.addEventListener("click", async () => {
    if (!activeConfig.url) {
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

    addLog("Mengirim siaran langsung TVR PARLEMEN ke Discord...", "info");

    let liveContent = "";
    if (activeConfig.mention) liveContent += `${activeConfig.mention} `;
    liveContent += `**SIARAN LANGSUNG TVR PARLEMEN DPR-RI**\nSaksikan persidangan, rapat paripurna, dan kegiatan peliputan resmi DPR RI secara live!`;

    const livePayload = {
        username: "NIRR - TVR PARLEMEN LIVE",
        content: liveContent.trim(),
        embeds: [
            {
                title: "SIARAN LANGSUNG TVR PARLEMEN 24 JAM",
                url: "https://www.youtube.com/@TVRPARLEMEN",
                description: "Referensi utama siaran persidangan, rapat dengar pendapat (RDP), dan berita resmi DPR RI langsung dari Senayan.",
                color: 15548997,
                fields: [
                    {
                        name: "Stasiun TV",
                        value: "TVR PARLEMEN (Setjen DPR RI)",
                        inline: true
                    },
                    {
                        name: "Tautan Live Streaming",
                        value: "[Tonton di YouTube TVR PARLEMEN](https://www.youtube.com/@TVRPARLEMEN)",
                        inline: true
                    }
                ],
                footer: {
                    text: "DEWAN PERWAKILAN RAKYAT REPUBLIK INDONESIA - NIRR"
                },
                timestamp: new Date().toISOString()
            }
        ],
        allowed_mentions: { parse: ["users", "roles", "everyone"] }
    };

    try {
        const response = await fetch(activeConfig.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(livePayload)
        });

        if (response.ok || response.status === 204) {
            addLog("Notifikasi siaran TVR PARLEMEN berhasil disiarkan ke Discord.", "success");
            Swal.fire({
                icon: 'success',
                title: 'Siaran TVR Terkirim',
                text: 'Notifikasi Live TVR PARLEMEN berhasil dikirim ke kanal Discord.',
                confirmButtonColor: '#F97316',
                background: '#111827',
                color: '#F9FAFB'
            });
        } else {
            throw new Error(`HTTP Status ${response.status}`);
        }
    } catch (err) {
        addLog(`Gagal menyiarkan TVR Parlemen: ${err.message}`, "error");
        Swal.fire({
            icon: 'error',
            title: 'Gagal Menyiarkan',
            text: `Terjadi kendala pengiriman: ${err.message}`,
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
    }
});

// Simpan Webhook Config
btnSaveWebhook.addEventListener("click", async () => {
    let url = webhookUrlInput.value.trim();
    if (url.includes("***") && activeConfig.url) {
        url = activeConfig.url;
    }

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

    const configData = {
        url: url,
        message: webhookMessageInput.value.trim(),
        mention: webhookMentionInput.value.trim()
    };

    try {
        await webhookConfigRef.set(configData);
        activeConfig = configData;
        webhookUrlInput.value = "****************************************";
        addLog("Pengaturan Discord Webhook berhasil diperbarui.", "success");
        Swal.fire({
            icon: 'success',
            title: 'Pengaturan Disimpan',
            text: 'URL Webhook, pesan kustom, dan mention telah aktif untuk pengiriman otomatis.',
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
    } catch (err) {
        addLog(`Gagal menyimpan pengaturan: ${err.message}`, "error");
    }
});

// Uji Koneksi Webhook
btnTestWebhook.addEventListener("click", async () => {
    if (!activeConfig.url) {
        Swal.fire({
            icon: 'warning',
            title: 'Webhook Kosong',
            text: 'Masukkan dan simpan URL webhook terlebih dahulu.',
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
        return;
    }

    addLog("Mengirim pesan uji coba ke Discord...", "info");
    
    let testContent = "";
    if (activeConfig.mention) testContent += `${activeConfig.mention} `;
    if (activeConfig.message) {
        testContent += `${activeConfig.message}`;
    } else {
        testContent += `Sistem Pemantau Berita Otomatis & TVR PARLEMEN DPR-RI (NIRR) terhubung dengan sukses.`;
    }

    try {
        const response = await fetch(activeConfig.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: testContent.trim(),
                allowed_mentions: { parse: ["users", "roles", "everyone"] }
            })
        });

        if (response.ok || response.status === 204) {
            addLog("Uji koneksi Discord Webhook berhasil.", "success");
            Swal.fire({
                icon: 'success',
                title: 'Koneksi Berhasil',
                text: 'Pesan uji coba & mention berhasil terkirim ke Discord.',
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

// Hapus Webhook
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
        activeConfig = { url: "", message: "", mention: "" };
        webhookUrlInput.value = "";
        webhookMessageInput.value = "";
        webhookMentionInput.value = "";
        webhookStatusHint.textContent = "Status: Belum dikonfigurasi";
        webhookStatusHint.className = "text-xs text-gray-400";
        addLog("Konfigurasi webhook dihapus dari database.", "info");
        Swal.fire({
            icon: 'success',
            title: 'Berhasil Dihapus',
            text: 'Pengaturan webhook telah dihapus.',
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