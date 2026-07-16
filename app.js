// --- Data Management & State ---
// Ganti URL ini dengan tautan Google Apps Script Anda yang asli
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/xxxx/exec"; 

let appData = {
    dosen: {
        "041234567": { nidn: "041234567", nama: "Dr. Budi Santoso, M.T." },
        "047654321": { nidn: "047654321", nama: "Prof. Siti Aminah, Ph.D." }
    },
    students: {}
};

// State global sementara untuk melacak baris mana yang akan dihapus
let deleteTarget = { category: null, id: null };

// --- 1. System Tab Navigation ---
function switchTab(tabName) {
    // Sembunyikan semua konten tab
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    // Tampilkan konten tab terpilih
    document.getElementById(`content-${tabName}`).classList.remove('hidden');

    // Ubah styling tombol tab aktif
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-indigo-600', 'shadow-sm');
        btn.classList.add('text-slate-600', 'hover:text-slate-900');
    });
    
    const activeBtn = document.getElementById(`tab-${tabName}`);
    activeBtn.classList.add('bg-white', 'text-indigo-600', 'shadow-sm');
    activeBtn.classList.remove('text-slate-600', 'hover:text-slate-900');
}

// --- 2. Form Submission Handler (Tambah Data) ---
function handleDosenSubmit(event) {
    event.preventDefault();
    const nidn = document.getElementById('nidn').value.trim();
    const nama = document.getElementById('namaDosen').value.trim();

    if (nidn && nama) {
        // Simpan ke state lokal
        appData.dosen[nidn] = { nidn, nama };
        
        // Bersihkan Input & Update UI Tabel
        document.getElementById('dosenForm').reset();
        updateDosenView();
        
        showToast("Data Dosen berhasil ditambahkan!", "success");
        
        // Sinkronisasi ke Google Sheets (Async di latar belakang)
        sendToGoogleSheets('insert', 'dosen', { nidn, nama });
    }
}

// --- 3. Render Table dengan Tombol Aksi "Hapus" ---
function updateDosenView() {
    const tableBody = document.getElementById('dosenTableBody');
    tableBody.innerHTML = '';

    const listDosen = Object.values(appData.dosen);

    if (listDosen.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="3" class="px-6 py-10 text-center text-slate-400">
                    <i class="fa-solid fa-folder-open text-3xl mb-2 block"></i>
                    Belum ada data dosen.
                </td>
            </tr>`;
        return;
    }

    listDosen.forEach(dosen => {
        const row = document.createElement('tr');
        row.className = "hover:bg-slate-50/50 transition-colors duration-150";
        row.innerHTML = `
            <td class="px-6 py-4 font-mono font-medium text-slate-700">${dosen.nidn}</td>
            <td class="px-6 py-4 font-medium text-slate-950">${dosen.nama}</td>
            <td class="px-6 py-4 text-center">
                <button onclick="openDeleteModal('dosen', '${dosen.nidn}')" 
                        class="inline-flex items-center justify-center p-2.5 text-rose-500 hover:text-white bg-rose-50 hover:bg-rose-500 active:scale-90 rounded-xl transition-all duration-200 shadow-sm shadow-rose-100/50"
                        title="Hapus Data">
                    <i class="fa-regular fa-trash-can text-base"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// --- 4. Fungsi Mengontrol Modal Konfirmasi (Fade & Scale) ---
const modal = document.getElementById('deleteModal');
const modalContent = document.getElementById('modalContent');

function openDeleteModal(category, id) {
    deleteTarget = { category, id };

    // Tampilkan penutup latar belakang (hidden dicopot)
    modal.classList.remove('hidden');
    
    // Berikan jeda mikro agar browser membaca perubahan status "display", lalu jalankan animasi transisi
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95', 'opacity-0');
        modalContent.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function closeDeleteModal() {
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100', 'opacity-100');
    modalContent.classList.add('scale-95', 'opacity-0');
    
    // Tunggu animasi transisi 300ms selesai sebelum benar-benar disembunyikan
    setTimeout(() => {
        modal.classList.add('hidden');
        deleteTarget = { category: null, id: null };
    }, 300);
}

// Tombol di dalam Modal
document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    const { category, id } = deleteTarget;
    if (category && id) {
        await executeDeleteData(category, id);
    }
    closeDeleteModal();
});

// --- 5. Fungsi Eksekusi Penghapusan Data ---
async function executeDeleteData(category, id) {
    showToast("Sedang menghapus data di cloud...", "info");

    // A. Hapus data dari memori lokal (Instant Response)
    if (appData[category] && appData[category][id]) {
        delete appData[category][id];
    }

    // Refresh Tampilan Tabel
    if (category === 'dosen') updateDosenView();

    // B. Sinkronisasi ke Google Sheets Web App
    try {
        await sendToGoogleSheets('delete', category, { id });
        showToast("Data berhasil dihapus selamanya!", "success");
    } catch (error) {
        console.error("Sinkronisasi gagal:", error);
        showToast("Gagal menghapus dari server, tapi data lokal sudah diperbarui.", "error");
    }
}

// --- 6. Fungsi Pengiriman Google Sheets ---
async function sendToGoogleSheets(action, category, data) {
    try {
        await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors', // Disesuaikan dengan CORS Apps Script
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, category, ...data })
        });
    } catch (err) {
        throw err;
    }
}

// --- 7. Sistem Notifikasi Toast Interaktif ---
function showToast(message, type = "info") {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    let bgIcon = {
        success: { bg: 'bg-emerald-500', icon: 'fa-circle-check' },
        error: { bg: 'bg-rose-500', icon: 'fa-circle-xmark' },
        info: { bg: 'bg-indigo-500', icon: 'fa-circle-info' }
    }[type];

    toast.className = `flex items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-xl transform translate-y-4 opacity-0 transition-all duration-300 pointer-events-auto max-w-sm`;
    toast.innerHTML = `
        <div class="flex-shrink-0 text-lg text-white">
            <i class="fa-solid ${bgIcon.icon} ${type === 'success' ? 'text-emerald-400' : type === 'error' ? 'text-rose-400' : 'text-indigo-400'}"></i>
        </div>
        <p class="text-xs font-semibold tracking-wide">${message}</p>
    `;

    container.appendChild(toast);

    // Memicu transisi masuk
    setTimeout(() => {
        toast.classList.remove('translate-y-4', 'opacity-0');
    }, 10);

    // Otomatis hilang dalam 3,5 detik
    setTimeout(() => {
        toast.classList.add('translate-y-4', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// Jalankan rendering tabel awal saat halaman dimuat
window.onload = () => {
    updateDosenView();
};
