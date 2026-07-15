// --- Data Management ---
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyziWKgKXyBjr_OmBxiQ31PxdjtZuZ7f1VKp0HtlunzKA6uAts-I87sCoMqsIQphB7-vQ/exec';

let appData = { mataKuliah: {}, students: {} };

function getData() {
    return appData;
}

function sendToGoogleSheets(payload) {
    // Fire and forget using text/plain to avoid CORS preflight issues
    fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload)
    }).then(() => {
        console.log("Sync request to Google Sheets completed.");
    }).catch(err => {
        console.error("Error syncing to Google Sheets:", err);
    });
}

function sendToWhatsApp(payload) {
    // Fire and forget local POST
    fetch('http://localhost:3000/send-wa', {
        method: 'POST',
        mode: 'no-cors',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload)
    }).then(() => {
        console.log("WA notification request sent.");
    }).catch(err => {
        console.error("WA Server offline or error:", err);
    });
}

// --- Fetch Data from Sheets ---
async function fetchDataFromGoogleSheets() {
    const overlay = document.getElementById('loading-overlay');
    try {
        const response = await fetch(GOOGLE_SHEETS_URL);
        const data = await response.json();

        // Reconstruct appData from Google Sheets JSON
        appData = { mataKuliah: {}, students: {} };

        // Parse Master Matkul
        if (data.mataKuliah) {
            data.mataKuliah.forEach(mk => {
                appData.mataKuliah[mk.kode] = {
                    kode: mk.kode,
                    nama: mk.nama,
                    sks: parseInt(mk.sks)
                };
            });
        }

        // Parse Students
        if (data.students) {
            data.students.forEach(row => {
                const nim = row.nim;
                const semester = row.semester;

                if (!appData.students[nim]) {
                    appData.students[nim] = {
                        nim: nim,
                        nama: row.nama,
                        semesters: {}
                    };
                }

                if (!appData.students[nim].semesters[semester]) {
                    appData.students[nim].semesters[semester] = [];
                }

                appData.students[nim].semesters[semester].push({
                    kode: row.matkul, // Assuming matkul stores the name, if they stored kode it would be better. Let's use it as matkul name for now
                    matkul: row.matkul,
                    sks: parseInt(row.sks),
                    nilaiHuruf: row.nilaiHuruf,
                    nilaiAngka: scale[row.nilaiHuruf] || 0
                });
            });
        }

        // Update UI
        updateDashboard();
        updateMasterView();
        populateMatkulDropdown();
        updateView();

        // Hide overlay
        overlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => overlay.classList.add('hidden'), 300);

    } catch (error) {
        console.error("Error fetching data:", error);
        showToast('Gagal memuat data dari Google Sheets. Periksa koneksi atau URL Web App.', 'error');
        overlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

const scale = {
    'A': 4.0,
    'B+': 3.5,
    'B': 3.0,
    'C+': 2.5,
    'C': 2.0,
    'D': 1.0,
    'E': 0.0
};

// --- Navigation ---
let isMobileMenuOpen = false;

function toggleMobileMenu() {
    const nav = document.getElementById('sidebar-nav');
    isMobileMenuOpen = !isMobileMenuOpen;
    if (isMobileMenuOpen) {
        nav.classList.remove('hidden');
        nav.classList.add('flex');
    } else {
        nav.classList.add('hidden');
        nav.classList.remove('flex');
    }
}

function switchTab(tabId) {
    // Hide all sections
    ['dashboard', 'master', 'input', 'view'].forEach(id => {
        document.getElementById(`sec-${id}`).classList.add('hidden');
        document.getElementById(`sec-${id}`).classList.remove('block');
        document.getElementById(`nav-${id}`).classList.remove('nav-active');
    });

    // Show selected section
    document.getElementById(`sec-${tabId}`).classList.remove('hidden');
    document.getElementById(`sec-${tabId}`).classList.add('block');
    document.getElementById(`nav-${tabId}`).classList.add('nav-active');

    // Auto-close mobile menu if open
    if (window.innerWidth < 768 && isMobileMenuOpen) {
        toggleMobileMenu();
    }

    // Trigger updates
    if (tabId === 'dashboard') updateDashboard();
    if (tabId === 'master') updateMasterView();
    if (tabId === 'input') populateMatkulDropdown();
    if (tabId === 'view') updateView();

    // Hide detail view when switching away from view tab
    if (tabId !== 'view') closeDetail();
}

// --- Toast Notification ---
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    const iconEl = document.getElementById('toast-icon');

    msgEl.innerText = message;

    if (type === 'error') {
        iconEl.innerHTML = '<i class="fas fa-circle-exclamation text-danger-line"></i>';
    } else {
        iconEl.innerHTML = '<i class="fas fa-check-circle text-success-line"></i>';
    }

    toast.classList.remove('translate-y-full', 'opacity-0');

    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
        toast.classList.add('translate-y-full', 'opacity-0');
    }, 3500);
}

// --- Field Validation Helpers ---
function showFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorEl = document.querySelector(`.field-error[data-for="${fieldId}"]`);
    if (input) input.classList.add('invalid');
    if (errorEl) {
        errorEl.querySelector('span').innerText = message;
        errorEl.classList.add('show');
    }
}

function clearFieldError(fieldId) {
    const input = document.getElementById(fieldId);
    const errorEl = document.querySelector(`.field-error[data-for="${fieldId}"]`);
    if (input) input.classList.remove('invalid');
    if (errorEl) errorEl.classList.remove('show');
}

function clearFormErrors(formEl) {
    formEl.querySelectorAll('.field-error').forEach(el => el.classList.remove('show'));
    formEl.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
}

// --- MASTER DATA LOGIC ---
function validateMasterField(fieldId) {
    const data = getData();
    if (fieldId === 'master-kode') {
        const val = document.getElementById('master-kode').value.trim();
        if (!val) { showFieldError('master-kode', 'Kode MK wajib diisi.'); return false; }
        clearFieldError('master-kode');
        return true;
    }
    if (fieldId === 'master-nama') {
        const val = document.getElementById('master-nama').value.trim();
        if (!val) { showFieldError('master-nama', 'Nama mata kuliah wajib diisi.'); return false; }
        clearFieldError('master-nama');
        return true;
    }
    if (fieldId === 'master-sks') {
        const val = document.getElementById('master-sks').value;
        const num = parseInt(val);
        if (!val) { showFieldError('master-sks', 'SKS wajib diisi.'); return false; }
        if (isNaN(num) || num < 1 || num > 6) { showFieldError('master-sks', 'SKS harus di antara 1 dan 6.'); return false; }
        clearFieldError('master-sks');
        return true;
    }
    return true;
}

function handleMasterSubmit(event) {
    event.preventDefault();

    const validKode = validateMasterField('master-kode');
    const validNama = validateMasterField('master-nama');
    const validSks = validateMasterField('master-sks');

    if (!validKode || !validNama || !validSks) {
        showToast('Periksa kembali data yang diisi.', 'error');
        return;
    }

    const kode = document.getElementById('master-kode').value.trim().toUpperCase();
    const nama = document.getElementById('master-nama').value.trim();
    const sks = parseInt(document.getElementById('master-sks').value);

    const data = getData();

    const isUpdate = !!data.mataKuliah[kode];
    data.mataKuliah[kode] = { kode, nama, sks };

    // Send to Google Sheets (Optimistic UI - update local memory first)
    const payload = {
        id: Date.now(),
        action: 'master_matkul',
        kode: kode,
        namaMK: nama,
        sks: sks
    };

    sendToGoogleSheets(payload);
    sendToWhatsApp(payload);

    document.getElementById('form-master').reset();
    clearFormErrors(document.getElementById('form-master'));
    document.getElementById('master-kode').focus();

    updateMasterView();
    updateDashboard();
    showToast(isUpdate ? `Mata kuliah ${nama} diperbarui & disinkron!` : `Mata kuliah ${nama} ditambahkan & disinkron!`);
}

function updateMasterView() {
    const data = getData();
    const tbody = document.getElementById('table-master-body');
    const emptyState = document.getElementById('empty-master-state');

    tbody.innerHTML = '';

    const matkuls = Object.values(data.mataKuliah);

    if (matkuls.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');

        matkuls.forEach(mk => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-surface transition-colors';
            tr.innerHTML = `
                <td class="p-3.5 px-5 text-sm font-semibold text-ink font-num">${mk.kode}</td>
                <td class="p-3.5 text-sm text-ink-soft">${mk.nama}</td>
                <td class="p-3.5 text-sm text-center font-medium text-ink font-num">${mk.sks}</td>
                <td class="p-3.5 px-5 text-center">
                    <button onclick="deleteMaster('${mk.kode}')" class="text-muted hover:text-danger transition-colors p-2 rounded-md hover:bg-danger-soft" aria-label="Hapus ${mk.kode}">
                        <i class="fas fa-trash text-sm"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function deleteMaster(kode) {
    showToast("Penghapusan tidak dapat dilakukan dari sini. Hapus baris data secara manual di Google Sheets lalu refresh halaman.", 'error');
}

// --- INPUT NILAI LOGIC ---
function populateMatkulDropdown() {
    const data = getData();
    const select = document.getElementById('input-matkul');
    const alertNoMaster = document.getElementById('alert-no-master');
    const btnSubmit = document.getElementById('btn-submit-nilai');

    const matkuls = Object.values(data.mataKuliah);

    // Clear existing options
    select.innerHTML = '<option value="" disabled selected>— Pilih mata kuliah —</option>';

    if (matkuls.length === 0) {
        alertNoMaster.classList.remove('hidden');
        btnSubmit.disabled = true;
        btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        alertNoMaster.classList.add('hidden');
        btnSubmit.disabled = false;
        btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');

        matkuls.forEach(mk => {
            const option = document.createElement('option');
            option.value = mk.kode;
            option.text = `${mk.kode} — ${mk.nama}`;
            // Store SKS in data attribute for easy access
            option.setAttribute('data-sks', mk.sks);
            option.setAttribute('data-nama', mk.nama);
            select.appendChild(option);
        });
    }

    // Reset SKS display
    document.getElementById('display-sks').value = '';
    document.getElementById('input-sks').value = '';
}

function updateSksDisplay() {
    const select = document.getElementById('input-matkul');
    if (select.selectedIndex > 0) {
        const option = select.options[select.selectedIndex];
        const sks = option.getAttribute('data-sks');
        document.getElementById('display-sks').value = `${sks} SKS`;
        document.getElementById('input-sks').value = sks;
        clearFieldError('input-matkul');
    }
}

function validateNilaiField(fieldId) {
    if (fieldId === 'input-nim') {
        const val = document.getElementById('input-nim').value.trim();
        if (!val) { showFieldError('input-nim', 'NIM wajib diisi.'); return false; }
        if (!/^\d+$/.test(val)) { showFieldError('input-nim', 'NIM hanya boleh berisi angka.'); return false; }
        clearFieldError('input-nim');
        return true;
    }
    if (fieldId === 'input-nama') {
        const val = document.getElementById('input-nama').value.trim();
        if (!val) { showFieldError('input-nama', 'Nama wajib diisi.'); return false; }
        clearFieldError('input-nama');
        return true;
    }
    if (fieldId === 'input-semester') {
        const val = document.getElementById('input-semester').value;
        const num = parseInt(val);
        if (!val) { showFieldError('input-semester', 'Semester wajib diisi.'); return false; }
        if (isNaN(num) || num < 1 || num > 14) { showFieldError('input-semester', 'Semester harus di antara 1 dan 14.'); return false; }
        clearFieldError('input-semester');
        return true;
    }
    if (fieldId === 'input-matkul') {
        const val = document.getElementById('input-matkul').value;
        if (!val) { showFieldError('input-matkul', 'Pilih mata kuliah terlebih dahulu.'); return false; }
        clearFieldError('input-matkul');
        return true;
    }
    if (fieldId === 'input-nilai') {
        const val = document.getElementById('input-nilai').value;
        if (!val) { showFieldError('input-nilai', 'Pilih nilai huruf.'); return false; }
        clearFieldError('input-nilai');
        return true;
    }
    return true;
}

function handleFormSubmit(event) {
    event.preventDefault();

    const fields = ['input-nim', 'input-nama', 'input-semester', 'input-matkul', 'input-nilai'];
    const results = fields.map(validateNilaiField);

    if (results.includes(false)) {
        showToast('Periksa kembali data yang diisi.', 'error');
        return;
    }

    const nim = document.getElementById('input-nim').value.trim();
    const nama = document.getElementById('input-nama').value.trim();
    const semester = document.getElementById('input-semester').value;

    const select = document.getElementById('input-matkul');
    const kodeMk = select.value;
    const namaMk = select.options[select.selectedIndex].getAttribute('data-nama');
    const sks = parseInt(document.getElementById('input-sks').value);

    const nilaiHuruf = document.getElementById('input-nilai').value;
    const nilaiAngka = scale[nilaiHuruf];

    const data = getData();

    // Initialize student if not exists
    if (!data.students[nim]) {
        data.students[nim] = {
            nim: nim,
            nama: nama,
            semesters: {}
        };
    } else {
        data.students[nim].nama = nama; // Update name
    }

    // Initialize semester if not exists
    if (!data.students[nim].semesters[semester]) {
        data.students[nim].semesters[semester] = [];
    }

    // Check if subject already inputted for this semester
    const exists = data.students[nim].semesters[semester].find(mk => mk.kode === kodeMk);
    if (exists) {
        showFieldError('input-matkul', 'Mata kuliah ini sudah diinput pada semester tersebut.');
        showToast('Mata kuliah ini sudah diinput pada semester tersebut!', 'error');
        return;
    }

    // Add subject
    data.students[nim].semesters[semester].push({
        kode: kodeMk,
        matkul: namaMk,
        sks: sks,
        nilaiHuruf: nilaiHuruf,
        nilaiAngka: nilaiAngka
    });

    // Calculate updated IPK for this student to send to Google Sheets
    const currentIpk = calculateIPK(data.students[nim]).toFixed(2);

    const payload = {
        id: Date.now(),
        action: 'input_nilai',
        nim: nim,
        nama: nama,
        semester: semester,
        matkul: namaMk,
        sks: sks,
        nilaiHuruf: nilaiHuruf,
        ipk: currentIpk
    };

    // Send to Google Sheets
    sendToGoogleSheets(payload);
    sendToWhatsApp(payload);

    // Reset only the subject/grade fields, keep student identity for fast repeat entry
    document.getElementById('input-matkul').value = '';
    document.getElementById('display-sks').value = '';
    document.getElementById('input-sks').value = '';
    document.getElementById('input-nilai').value = '';
    clearFieldError('input-matkul');
    clearFieldError('input-nilai');
    document.getElementById('input-matkul').focus();

    updateDashboard();
    showToast(`Nilai ${namaMk} untuk ${nama} berhasil direkam & disinkron!`);
}

// --- Calculations & View Logic ---
function calculateIPK(student) {
    let totalBobot = 0;
    let totalSKS = 0;

    for (const sem in student.semesters) {
        student.semesters[sem].forEach(mk => {
            totalBobot += (mk.sks * mk.nilaiAngka);
            totalSKS += mk.sks;
        });
    }

    return totalSKS === 0 ? 0 : (totalBobot / totalSKS);
}

function calculateIPS(semesterData) {
    let totalBobot = 0;
    let totalSKS = 0;

    semesterData.forEach(mk => {
        totalBobot += (mk.sks * mk.nilaiAngka);
        totalSKS += mk.sks;
    });

    return totalSKS === 0 ? 0 : (totalBobot / totalSKS);
}

function updateDashboard() {
    const data = getData();
    let totalMhs = Object.keys(data.students).length;
    let totalMatkulMaster = Object.keys(data.mataKuliah).length;
    let totalNilai = 0;

    for (const nim in data.students) {
        for (const sem in data.students[nim].semesters) {
            totalNilai += data.students[nim].semesters[sem].length;
        }
    }

    document.getElementById('stat-mhs').innerText = totalMhs;
    document.getElementById('stat-matkul-master').innerText = totalMatkulMaster;
    document.getElementById('stat-nilai').innerText = totalNilai;
}

function updateView() {
    const data = getData();
    const tbody = document.getElementById('table-mhs-body');
    const emptyState = document.getElementById('empty-state');

    tbody.innerHTML = '';

    const students = Object.values(data.students);

    if (students.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');

        students.forEach(student => {
            let totalSKS = 0;
            for (const sem in student.semesters) {
                student.semesters[sem].forEach(mk => totalSKS += mk.sks);
            }

            const ipk = calculateIPK(student).toFixed(2);
            let ipkClasses = 'bg-success-soft text-success border-success-line';

            if (ipk < 2.0) { ipkClasses = 'bg-danger-soft text-danger border-danger-line'; }
            else if (ipk < 3.0) { ipkClasses = 'bg-warn-soft text-warn border-warn-line'; }

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-surface transition-colors';
            tr.innerHTML = `
                <td class="p-4 px-5">
                    <div class="flex items-center">
                        <div class="w-8 h-8 rounded-md bg-accent-soft text-accent flex items-center justify-center font-semibold text-sm mr-3 flex-shrink-0">
                            ${student.nama.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p class="font-medium text-ink text-sm">${student.nama}</p>
                            <p class="text-xs text-muted font-num">${student.nim}</p>
                        </div>
                    </div>
                </td>
                <td class="p-4 text-center text-sm text-ink-soft font-num">${totalSKS}</td>
                <td class="p-4 text-center">
                    <span class="${ipkClasses} px-2.5 py-1 rounded-md font-semibold text-xs border font-num">${ipk}</span>
                </td>
                <td class="p-4 px-5 text-center">
                    <button onclick="viewDetail('${student.nim}')" class="border border-line text-ink-soft hover:text-accent hover:border-accent px-3 py-1.5 rounded-md text-xs font-medium transition-colors">
                        <i class="fas fa-eye mr-1"></i> Rincian
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function viewDetail(nim) {
    const data = getData();
    const student = data.students[nim];
    if (!student) return;

    document.getElementById('detail-nim').innerText = student.nim;
    document.getElementById('detail-nama').innerText = student.nama;
    document.getElementById('detail-ipk').innerText = calculateIPK(student).toFixed(2);

    const semestersContainer = document.getElementById('detail-semesters');
    semestersContainer.innerHTML = '';

    // Sort semesters
    const semKeys = Object.keys(student.semesters).sort((a, b) => parseInt(a) - parseInt(b));

    semKeys.forEach(sem => {
        const mkData = student.semesters[sem];
        const ips = calculateIPS(mkData).toFixed(2);

        let sksSem = 0;
        let rows = '';

        mkData.forEach(mk => {
            sksSem += mk.sks;
            let badgeClasses = 'bg-success-soft text-success border-success-line';
            if (['D', 'E'].includes(mk.nilaiHuruf)) badgeClasses = 'bg-danger-soft text-danger border-danger-line';
            else if (['C', 'C+'].includes(mk.nilaiHuruf)) badgeClasses = 'bg-warn-soft text-warn border-warn-line';

            rows += `
                <tr class="border-b border-line last:border-0 hover:bg-surface transition-colors">
                    <td class="py-3 px-4">
                        <p class="text-sm text-ink">${mk.matkul}</p>
                        <p class="text-xs text-muted font-num">${mk.kode || '-'}</p>
                    </td>
                    <td class="py-3 px-4 text-center text-sm text-ink-soft font-num">${mk.sks}</td>
                    <td class="py-3 px-4 text-center">
                        <span class="${badgeClasses} px-2 py-0.5 rounded border text-xs font-semibold font-num">${mk.nilaiHuruf}</span>
                    </td>
                    <td class="py-3 px-4 text-center text-sm text-ink-soft font-num">${mk.nilaiAngka.toFixed(2)}</td>
                </tr>
            `;
        });

        const semHtml = `
            <div class="border border-line rounded-lg overflow-hidden">
                <div class="bg-surface p-3.5 px-4 flex justify-between items-center border-b border-line">
                    <h4 class="text-sm font-semibold text-ink">Semester ${sem}</h4>
                    <div class="flex items-center gap-3 text-xs">
                        <span class="text-muted">SKS <span class="font-semibold text-ink font-num">${sksSem}</span></span>
                        <span class="text-line-strong">|</span>
                        <span class="text-muted">IPS <span class="font-semibold text-accent font-num">${ips}</span></span>
                    </div>
                </div>
                <table class="w-full text-left">
                    <thead class="text-muted text-[11px] uppercase border-b border-line">
                        <tr>
                            <th class="py-2.5 px-4 font-semibold">Mata Kuliah</th>
                            <th class="py-2.5 px-4 font-semibold text-center w-20">SKS</th>
                            <th class="py-2.5 px-4 font-semibold text-center w-24">Nilai</th>
                            <th class="py-2.5 px-4 font-semibold text-center w-24">Bobot</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white">
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
        semestersContainer.innerHTML += semHtml;
    });

    document.getElementById('detail-view').classList.remove('hidden');
    // Scroll to detail view
    document.getElementById('detail-view').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeDetail() {
    document.getElementById('detail-view').classList.add('hidden');
}

function clearAllData() {
    showToast("Untuk mereset seluruh data, hapus baris data langsung di Google Sheets Anda, lalu refresh halaman.", 'error');
}

// --- Live validation wiring ---
function initLiveValidation() {
    const masterFields = ['master-kode', 'master-nama', 'master-sks'];
    masterFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('blur', () => validateMasterField(id));
        if (el) el.addEventListener('input', () => { if (el.classList.contains('invalid')) validateMasterField(id); });
    });

    const nilaiFields = ['input-nim', 'input-nama', 'input-semester', 'input-matkul', 'input-nilai'];
    nilaiFields.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('blur', () => validateNilaiField(id));
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
            if (el.classList.contains('invalid')) validateNilaiField(id);
        });
    });
}

// Init
window.onload = () => {
    initLiveValidation();
    fetchDataFromGoogleSheets();
};
