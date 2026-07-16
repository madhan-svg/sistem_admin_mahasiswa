// --- Data Management ---
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyziWKgKXyBjr_OmBxiQ31PxdjtZuZ7f1VKp0HtlunzKA6uAts-I87sCoMqsIQphB7-vQ/exec';

let appData = { mataKuliah: {}, students: {}, dosen: {} };

const scale = {
    'A': 4.0,
    'B+': 3.5,
    'B': 3.0,
    'C+': 2.5,
    'C': 2.0,
    'D': 1.0,
    'E': 0.0
};

function getData() {
    return appData;
}

// Konversi Nilai Komparatif Otomatis ke Skala Huruf
function convertToGradeLetter(score) {
    if (score >= 85) return 'A';
    if (score >= 75) return 'B+';
    if (score >= 68) return 'B';
    if (score >= 60) return 'C+';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'E';
}

function sendToGoogleSheets(payload) {
  fetch(GOOGLE_SHEETS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload),
    redirect: 'follow'
  })
  .then(() => {
    console.log("Sync request to Google Sheets completed.");
  })
  .catch((err) => {
    console.error("Error syncing to Google Sheets:", err);
  });
}

function sendToWhatsApp(payload) {
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

        appData = { mataKuliah: {}, students: {}, dosen: {} };

        // Parsing Master Matkul
        if (data.mataKuliah) {
            data.mataKuliah.forEach(mk => {
                appData.mataKuliah[mk.kode] = {
                    kode: mk.kode,
                    nama: mk.nama,
                    sks: parseInt(mk.sks)
                };
            });
        }

        // Parsing Master Dosen
        if (data.dosen) {
            data.dosen.forEach(ds => {
                appData.dosen[ds.nidn] = {
                    nidn: ds.nidn,
                    nama: ds.nama
                };
            });
        }

        // Parsing Students
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

                const findMatkul = Object.values(appData.mataKuliah).find(m => m.nama === row.matkul);
                const kodeMk = findMatkul ? findMatkul.kode : 'MK-';

                appData.students[nim].semesters[semester].push({
                    kode: kodeMk,
                    matkul: row.matkul,
                    sks: parseInt(row.sks),
                    dosen: row.dosen || 'Dosen Pengampu',
                    nilaiHuruf: row.nilaiHuruf,
                    nilaiAngka: scale[row.nilaiHuruf] || 0
                });
            });
        }

        updateDashboard();
        updateMasterView();
        updateDosenView();
        populateMatkulDropdown();
        populateDosenDropdown();
        updateView();

        overlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => overlay.classList.add('hidden'), 300);

    } catch (error) {
        console.error("Error fetching data:", error);
        showToast('Gagal memuat data dari Sheets. Demo lokal aktif.', 'error');
        overlay.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

// --- Navigation ---
let isMobileMenuOpen = false;

function toggleMobileMenu() {
    const nav = document.getElementById('sidebar-nav');
    isMobileMenuOpen = !isMobileMenuOpen;
    if (isMobileMenuOpen) {
        nav.classList.remove('hidden');
    } else {
        nav.classList.add('hidden');
    }
}

function switchTab(tabId) {
    ['dashboard', 'dosen', 'master', 'input', 'view'].forEach(id => {
        const sec = document.getElementById(`sec-${id}`);
        const nav = document.getElementById(`nav-${id}`);
        if (sec) sec.classList.add('hidden');
        if (nav) nav.classList.remove('nav-active');
    });

    const activeSec = document.getElementById(`sec-${tabId}`);
    const activeNav = document.getElementById(`nav-${tabId}`);
    if (activeSec) activeSec.classList.remove('hidden');
    if (activeNav) activeNav.classList.add('nav-active');

    if (window.innerWidth < 768 && isMobileMenuOpen) {
        toggleMobileMenu();
    }

    if (tabId === 'dashboard') updateDashboard();
    if (tabId === 'dosen') updateDosenView();
    if (tabId === 'master') updateMasterView();
    if (tabId === 'input') {
        populateMatkulDropdown();
        populateDosenDropdown();
    }
    if (tabId === 'view') updateView();
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

// --- Validation Helpers ---
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
    if (!formEl) return;
    formEl.querySelectorAll('.field-error').forEach(el => el.classList.remove('show'));
    formEl.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
}

// --- MASTER DATA DOSEN ---
function validateDosenField(fieldId) {
    if (fieldId === 'dosen-nidn') {
        const val = document.getElementById('dosen-nidn').value.trim();
        if (!val) { showFieldError('dosen-nidn', 'NIDN wajib diisi.'); return false; }
        clearFieldError('dosen-nidn');
        return true;
    }
    if (fieldId === 'dosen-nama') {
        const val = document.getElementById('dosen-nama').value.trim();
        if (!val) { showFieldError('dosen-nama', 'Nama dosen wajib diisi.'); return false; }
        clearFieldError('dosen-nama');
        return true;
    }
    return true;
}

function handleDosenSubmit(event) {
    event.preventDefault();
    const vNidn = validateDosenField('dosen-nidn');
    const vNama = validateDosenField('dosen-nama');

    if (!vNidn || !vNama) {
        showToast('Harap periksa isian data dosen.', 'error');
        return;
    }

    const nidn = document.getElementById('dosen-nidn').value.trim();
    const nama = document.getElementById('dosen-nama').value.trim();

    appData.dosen[nidn] = { nidn, nama };

    const payload = {
        id: Date.now(),
        action: 'master_dosen',
        nidn: nidn,
        namaDosen: nama
    };

    sendToGoogleSheets(payload);
    sendToWhatsApp(payload);

    document.getElementById('form-dosen').reset();
    clearFormErrors(document.getElementById('form-dosen'));
    updateDosenView();
    updateDashboard();
    showToast(`Dosen ${nama} berhasil disimpan dan disinkron!`);
}

function updateDosenView() {
    const tbody = document.getElementById('table-dosen-body');
    const emptyState = document.getElementById('empty-dosen-state');
    if (!tbody) return;

    tbody.innerHTML = '';
    const dosens = Object.values(appData.dosen);

    if (dosens.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        dosens.forEach(ds => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-surface transition-colors';
            tr.innerHTML = `
                <td class="p-3.5 px-5 text-sm font-semibold text-ink font-num">${ds.nidn}</td>
                <td class="p-3.5 text-sm text-ink-soft">${ds.nama}</td>
                <td class="p-3.5 px-5 text-center">
                    <button onclick="deleteDosen('${ds.nidn}')" class="text-muted hover:text-danger transition-colors p-2 rounded-md hover:bg-danger-soft">
                        <i class="fas fa-trash text-sm"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function deleteDosen(nidn) {
    delete appData.dosen[nidn];
    updateDosenView();
    updateDashboard();
    showToast("Dosen berhasil dihapus.", "success");
}

function populateDosenDropdown() {
    const select = document.getElementById('input-dosen');
    if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Pilih Dosen</option>';
    Object.values(appData.dosen).forEach(ds => {
        const opt = document.createElement('option');
        opt.value = ds.nama;
        opt.text = ds.nama;
        select.appendChild(opt);
    });
}

// --- MASTER DATA MATKUL ---
function validateMasterField(fieldId) {
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

    const isUpdate = !!appData.mataKuliah[kode];
    appData.mataKuliah[kode] = { kode, nama, sks };

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
    updateMasterView();
    updateDashboard();
    showToast(isUpdate ? `Mata kuliah ${nama} diperbarui!` : `Mata kuliah ${nama} ditambahkan!`);
}

function updateMasterView() {
    const tbody = document.getElementById('table-master-body');
    const emptyState = document.getElementById('empty-master-state');
    if (!tbody) return;

    tbody.innerHTML = '';
    const matkuls = Object.values(appData.mataKuliah);

    if (matkuls.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        matkuls.forEach(mk => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-surface transition-colors';
            tr.innerHTML = `
                <td class="p-3.5 px-5 text-sm font-semibold text-ink font-num">${mk.kode}</td>
                <td class="p-3.5 text-sm text-ink-soft">${mk.nama}</td>
                <td class="p-3.5 text-sm text-center font-medium text-ink font-num">${mk.sks}</td>
                <td class="p-3.5 px-5 text-center">
                    <button onclick="deleteMaster('${mk.kode}')" class="text-muted hover:text-danger transition-colors p-2 rounded-md hover:bg-danger-soft">
                        <i class="fas fa-trash text-sm"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function deleteMaster(kode) {
    delete appData.mataKuliah[kode];
    updateMasterView();
    updateDashboard();
    showToast('Mata kuliah dihapus.', 'success');
}

// --- INPUT & KALKULASI NILAI ---
function populateMatkulDropdown() {
    const select = document.getElementById('input-matkul');
    const alertNoMaster = document.getElementById('alert-no-master');
    const btnSubmit = document.getElementById('btn-submit-nilai');
    if (!select) return;

    const matkuls = Object.values(appData.mataKuliah);
    select.innerHTML = '<option value="" disabled selected>— Pilih mata kuliah —</option>';

    if (matkuls.length === 0) {
        if (alertNoMaster) alertNoMaster.classList.remove('hidden');
        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');
        }
    } else {
        if (alertNoMaster) alertNoMaster.classList.add('hidden');
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
        }

        matkuls.forEach(mk => {
            const option = document.createElement('option');
            option.value = mk.kode;
            option.text = `${mk.kode} — ${mk.nama}`;
            option.setAttribute('data-sks', mk.sks);
            option.setAttribute('data-nama', mk.nama);
            select.appendChild(option);
        });
    }
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
    const input = document.getElementById(fieldId);
    if (!input) return true;
    const val = input.value.trim();

    if (['input-nim', 'input-nama', 'input-semester', 'input-matkul', 'input-dosen', 'nilai-tugas', 'nilai-uts', 'nilai-uas'].includes(fieldId)) {
        if (!val) { showFieldError(fieldId, 'Harap isi bagian ini.'); return false; }
    }
    if (['nilai-tugas', 'nilai-uts', 'nilai-uas'].includes(fieldId)) {
        const score = parseFloat(val);
        if (isNaN(score) || score < 0 || score > 100) {
            showFieldError(fieldId, 'Nilai harus 0 sampai 100.');
            return false;
        }
    }
    clearFieldError(fieldId);
    return true;
}

function handleFormSubmit(event) {
    event.preventDefault();

    const fields = ['input-nim', 'input-nama', 'input-semester', 'input-matkul', 'input-dosen', 'nilai-tugas', 'nilai-uts', 'nilai-uas'];
    const results = fields.map(validateNilaiField);

    if (results.includes(false)) {
        showToast('Lengkapi isian data komponen nilai.', 'error');
        return;
    }

    const nim = document.getElementById('input-nim').value.trim();
    const nama = document.getElementById('input-nama').value.trim();
    const semester = document.getElementById('input-semester').value;
    const selectMK = document.getElementById('input-matkul');
    const dosenName = document.getElementById('input-dosen').value;

    const tgs = parseFloat(document.getElementById('nilai-tugas').value) || 0;
    const uts = parseFloat(document.getElementById('nilai-uts').value) || 0;
    const uas = parseFloat(document.getElementById('nilai-uas').value) || 0;

    // Kalkulasi Akademik: Komponen Nilai
    const totalScore = (tgs * 0.3) + (uts * 0.3) + (uas * 0.4);
    const gradeLetter = convertToGradeLetter(totalScore);

    const kodeMk = selectMK.value;
    const namaMk = selectMK.options[selectMK.selectedIndex].getAttribute('data-nama');
    const sks = parseInt(document.getElementById('input-sks').value) || 2;

    if (!appData.students[nim]) {
        appData.students[nim] = { nim, nama, semesters: {} };
    } else {
        appData.students[nim].nama = nama;
    }

    if (!appData.students[nim].semesters[semester]) {
        appData.students[nim].semesters[semester] = [];
    }

    const exists = appData.students[nim].semesters[semester].find(mk => mk.kode === kodeMk);
    if (exists) {
        showToast('Mata kuliah ini sudah diinput pada semester tersebut.', 'error');
        return;
    }

    appData.students[nim].semesters[semester].push({
        kode: kodeMk,
        matkul: namaMk,
        sks: sks,
        dosen: dosenName,
        nilaiHuruf: gradeLetter,
        nilaiAngka: scale[gradeLetter] || 0
    });

    const currentIpk = calculateIPK(appData.students[nim]).toFixed(2);

    const payload = {
        id: Date.now(),
        action: 'input_nilai',
        nim: nim,
        nama: nama,
        semester: semester,
        matkul: namaMk,
        sks: sks,
        dosen: dosenName,
        nilaiHuruf: gradeLetter,
        ipk: currentIpk
    };

    sendToGoogleSheets(payload);
    sendToWhatsApp(payload);

    // Reset Form Akademik
    document.getElementById('input-matkul').value = '';
    document.getElementById('display-sks').value = '';
    document.getElementById('input-sks').value = '';
    document.getElementById('nilai-tugas').value = '';
    document.getElementById('nilai-uts').value = '';
    document.getElementById('nilai-uas').value = '';

    updateDashboard();
    showToast(`Nilai ${namaMk} (${gradeLetter}) untuk ${nama} berhasil disimpan!`);
}

// --- CALCULATIONS & STATS ---
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

function calculateAverageIPK() {
    const students = Object.values(appData.students);
    if (students.length === 0) return 0;
    let total = 0;
    students.forEach(st => {
        total += calculateIPK(st);
    });
    return total / students.length;
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
    let totalMhs = Object.keys(appData.students).length;
    let totalDosen = Object.keys(appData.dosen).length;
    let totalMatkulMaster = Object.keys(appData.mataKuliah).length;
    let totalNilai = 0;

    for (const nim in appData.students) {
        for (const sem in appData.students[nim].semesters) {
            totalNilai += appData.students[nim].semesters[sem].length;
        }
    }

    document.getElementById('stat-mhs').innerText = totalMhs;
    document.getElementById('stat-dosen').innerText = totalDosen;
    document.getElementById('stat-matkul-master').innerText = totalMatkulMaster;
    document.getElementById('stat-nilai').innerText = totalNilai;
    document.getElementById('stat-avg-ipk').innerText = calculateAverageIPK().toFixed(2);
}

// --- VIEW MANAGEMENT ---
function updateView() {
    const tbody = document.getElementById('table-mhs-body');
    const emptyState = document.getElementById('empty-state');
    if (!tbody) return;

    tbody.innerHTML = '';
    const students = Object.values(appData.students);

    if (students.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        students.forEach(student => {
            let totalSKS = 0;
            for (const sem in student.semesters) {
                student.semesters[sem].forEach(mk => totalSKS += mk.sks);
            }

            const ipk = calculateIPK(student).toFixed(2);
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
                    <span class="bg-accent-soft text-accent border-accent px-2.5 py-1 rounded-md font-semibold text-xs border font-num">${ipk}</span>
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
    const student = appData.students[nim];
    if (!student) return;

    document.getElementById('detail-nim').innerText = `NIM: ${student.nim}`;
    document.getElementById('detail-nama').innerText = student.nama;
    
    const ipk = calculateIPK(student);
    document.getElementById('detail-ipk').innerText = ipk.toFixed(2);

    let predikat = 'Kurang';
    if (ipk >= 3.51) predikat = 'Dengan Pujian (Cum Laude)';
    else if (ipk >= 3.0) predikat = 'Sangat Memuaskan';
    else if (ipk >= 2.00) predikat = 'Memuaskan';
    document.getElementById('detail-status').innerText = predikat;

    const semestersContainer = document.getElementById('detail-semesters');
    semestersContainer.innerHTML = '';

    const semKeys = Object.keys(student.semesters).sort((a, b) => parseInt(a) - parseInt(b));

    semKeys.forEach(sem => {
        const mkData = student.semesters[sem];
        const ips = calculateIPS(mkData).toFixed(2);

        let sksSem = 0;
        let rows = '';

        mkData.forEach(mk => {
            sksSem += mk.sks;
            rows += `
                <tr class="border-b border-line last:border-0 hover:bg-surface transition-colors">
                    <td class="py-3 px-4">
                        <p class="text-sm text-ink">${mk.matkul}</p>
                        <p class="text-[10px] text-muted font-num">${mk.kode || '-'} | Dosen: ${mk.dosen}</p>
                    </td>
                    <td class="py-3 px-4 text-center text-sm text-ink-soft font-num">${mk.sks}</td>
                    <td class="py-3 px-4 text-center font-bold text-accent">${mk.nilaiHuruf}</td>
                </tr>
            `;
        });

        const semHtml = `
            <div class="border border-line rounded-lg overflow-hidden">
                <div class="bg-surface p-3 px-4 flex justify-between items-center border-b border-line">
                    <h4 class="text-sm font-semibold text-ink">Semester ${sem}</h4>
                    <div class="flex items-center gap-3 text-xs font-semibold">
                        <span class="text-muted">IPS: <span class="text-accent font-num">${ips}</span></span>
                    </div>
                </div>
                <table class="w-full text-left">
                    <thead>
                        <tr class="text-muted text-[10px] uppercase border-b border-line">
                            <th class="py-2 px-4">Mata Kuliah</th>
                            <th class="py-2 text-center w-20">SKS</th>
                            <th class="py-2 text-center w-24">Nilai</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white">${rows}</tbody>
                </table>
            </div>
        `;
        semestersContainer.innerHTML += semHtml;
    });

    document.getElementById('detail-view').classList.remove('hidden');
    document.getElementById('detail-view').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeDetail() {
    document.getElementById('detail-view').classList.add('hidden');
}

// --- Live validation wiring ---
function initLiveValidation() {
    const masterFields = ['master-kode', 'master-nama', 'master-sks'];
    masterFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('blur', () => validateMasterField(id));
    });

    const nilaiFields = ['input-nim', 'input-nama', 'input-semester', 'input-matkul', 'input-dosen', 'nilai-tugas', 'nilai-uts', 'nilai-uas'];
    nilaiFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('blur', () => validateNilaiField(id));
    });
}

// Run
window.onload = () => {
    initLiveValidation();
    fetchDataFromGoogleSheets();
};
