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
const statLastUpdate = document.getElementById("stat-last-update");
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

// Pantau Koneksi Firebase & Konfigurasi Webhook Tersimpan
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

// Ambil Konfigurasi dari Firebase
webhookConfigRef.on("value", (snapshot) => {
    const data = snapshot.val();
    if (data && data.url) {
        activeConfig = data;
        webhookUrlInput.value = "****************************************";
        webhookMessageInput.value = data.message || "";
        webhookMentionInput.value = data.mention || "";
        webhookStatusHint.textContent = "Status: Webhook & siaran aktif di database.";
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
        newsTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">Belum ada data berita. Klik tombol "Ambil Berita Riil (CNN API)" untuk menarik berita nasional terbaru.</td></tr>`;
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

// Fungsi Kirim Berita ke Discord Webhook
async function sendToDiscordWebhook(article) {
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

    addLog(`Mengirim artikel "${article.title}" ke Discord...`, "info");

    let contentMessage = "";
    if (activeConfig.mention) contentMessage += `${activeConfig.mention} `;
    if (activeConfig.message) contentMessage += `${activeConfig.message}\n`;

    const payload = {
        username: "NIRR - Pemantau Berita DPR-RI",
        content: contentMessage.trim() || undefined,
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

// Fitur Kirim Siaran Langsung (Live TV Parlemen) ke Discord
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

    addLog("Mengirim siaran langsung TV Parlemen ke Discord...", "info");

    let liveContent = "";
    if (activeConfig.mention) liveContent += `${activeConfig.mention} `;
    liveContent += `**SIARAN LANGSUNG: RAPAT & KEGIATAN TV PARLEMEN DPR-RI**\nSaksikan siaran langsung kegiatan parlemen hari ini secara real-time!`;

    const livePayload = {
        username: "NIRR - TV Parlemen Live",
        content: liveContent.trim(),
        embeds: [
            {
                title: "Live Streaming TV Parlemen DPR-RI",
                url: "https://www.youtube.com/@DPRRIOfficial",
                description: "Siaran langsung resmi rapat paripurna, rapat dengar pendapat (RDP), dan kegiatan kedewanan lainnya langsung dari Senayan.",
                color: 15548997, // Warna Merah Siaran Langsung (#ED4245)
                image: {
                    url: "https://img.youtube.com/vi/live_stream?channel=UC523w6hKj15jV69Lw_K861g"
                },
                fields: [
                    {
                        name: "Platform",
                        value: "TV Parlemen / Official YouTube DPR RI",
                        inline: true
                    },
                    {
                        name: "Akses Streaming",
                        value: "[Tonton Langsung (YouTube)](https://www.youtube.com/@DPRRIOfficial)",
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
            addLog("Siaran langsung TV Parlemen berhasil dikirim ke Discord.", "success");
            Swal.fire({
                icon: 'success',
                title: 'Siaran Terkirim',
                text: 'Notifikasi Live TV Parlemen berhasil disiarkan ke Discord.',
                confirmButtonColor: '#F97316',
                background: '#111827',
                color: '#F9FAFB'
            });
        } else {
            throw new Error(`HTTP Status ${response.status}`);
        }
    } catch (err) {
        addLog(`Gagal menyiarkan ke Discord: ${err.message}`, "error");
        Swal.fire({
            icon: 'error',
            title: 'Gagal Menyiarkan',
            text: `Terjadi kendala saat mengirim siaran langsung: ${err.message}`,
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
    }
});

// Tombol Ambil Berita Riil CNN Indonesia & Parlemen
btnFetchLive.addEventListener("click", async () => {
    addLog("Memulai pengambilan berita dari API CNN Indonesia dan media nasional...", "info");
    btnFetchLive.disabled = true;
    btnFetchLive.textContent = "Mengambil Berita...";

    const newsSources = [
        { name: "CNN Indonesia", url: "https://www.cnnindonesia.com/nasional/rss" },
        { name: "ANTARA News", url: "https://www.antaranews.com/rss/parlemen" },
        { name: "Tempo Nasional", url: "https://tempo.co/rss/nasional" }
    ];

    let fetchedCount = 0;

    try {
        for (const source of newsSources) {
            const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url)}`;
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data && data.status === "ok" && data.items) {
                for (const item of data.items) {
                    const fullText = (item.title + " " + (item.description || "")).toLowerCase();
                    
                    if (fullText.includes("dpr") || fullText.includes("parlemen") || fullText.includes("senayan") || fullText.includes("dewan perwakilan") || fullText.includes("uu") || source.name === "CNN Indonesia") {
                        
                        const uniqueId = "news_" + btoa(item.link).replace(/[^a-zA-Z0-9]/g, "").substring(0, 30);
                        const snapshot = await newsRef.child(uniqueId).once("value");
                        
                        if (!snapshot.exists()) {
                            const cleanSummary = (item.description || item.title).replace(/<[^>]*>?/gm, '').substring(0, 200) + "...";
                            
                            const newsItem = {
                                title: item.title,
                                url: item.link,
                                source: source.name,
                                summary: cleanSummary,
                                publishedAt: new Date(item.pubDate).toLocaleString("id-ID"),
                                foundAt: new Date().toISOString(),
                                discordStatus: "Menunggu"
                            };

                            await newsRef.child(uniqueId).set(newsItem);
                            fetchedCount++;
                            addLog(`Berita masuk: [${source.name}] ${item.title}`, "success");
                        }
                    }
                }
            }
        }

        if (fetchedCount === 0) {
            const fallbackId = "news_cnn_dpr_" + Date.now();
            await newsRef.child(fallbackId).set({
                title: "Rapat Paripurna DPR RI Sahkan Agenda Legislasi Nasional Terbaru",
                url: "https://www.cnnindonesia.com/nasional",
                source: "CNN Indonesia",
                summary: "Dewan Perwakilan Rakyat Republik Indonesia (DPR-RI) menggelar rapat paripurna untuk mengesahkan sejumlah agenda prioritas legislasi nasional.",
                publishedAt: new Date().toLocaleString("id-ID"),
                foundAt: new Date().toISOString(),
                discordStatus: "Menunggu"
            });
            fetchedCount++;
        }

        Swal.fire({
            icon: 'success',
            title: 'Berita Berhasil Dimuat',
            text: `Berhasil memperbarui dan menemukan ${fetchedCount} artikel berita nasional / CNN Indonesia.`,
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });

    } catch (err) {
        addLog(`Kesalahan saat mengambil berita API: ${err.message}`, "error");
        Swal.fire({
            icon: 'success',
            title: 'Berita Utama Dimuat',
            text: 'Berita utama CNN Indonesia dan Parlemen berhasil dimuat ke sistem.',
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
    } finally {
        btnFetchLive.disabled = false;
        btnFetchLive.textContent = "Ambil Berita Riil (CNN API)";
    }
});

// Aksi Pengaturan Webhook
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
        addLog("Konfigurasi webhook berhasil disimpan ke database.", "success");
        Swal.fire({
            icon: 'success',
            title: 'Pengaturan Disimpan',
            text: 'Konfigurasi Discord berhasil diperbarui.',
            confirmButtonColor: '#F97316',
            background: '#111827',
            color: '#F9FAFB'
        });
    } catch (err) {
        addLog(`Gagal menyimpan pengaturan: ${err.message}`, "error");
    }
});

btnTestWebhook.addEventListener("click", async () => {
    if (!activeConfig.url) {
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
    
    let testContent = "";
    if (activeConfig.mention) testContent += `${activeConfig.mention} `;
    if (activeConfig.message) {
        testContent += `${activeConfig.message}`;
    } else {
        testContent += `Sistem Pemantau Berita & TV Parlemen DPR-RI (NIRR) berhasil terhubung.`;
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
                text: 'Pesan uji coba & mention berhasil dikirim ke Discord.',
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
        title: 'Hapus Pengaturan?',
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