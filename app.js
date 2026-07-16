// =========================================================================
// 1. SYSTEM AUTHENTICATION (LAMAN LOGIN)
// =========================================================================
const AUTH_CREDENTIALS = { username: 'admin', password: 'admin123' };

function checkAuthStatus() {
    if (sessionStorage.getItem('sinilai_auth') === 'authenticated') {
        injectLoginScreen(true);
        fetchDataFromGoogleSheets();
    } else {
        injectLoginScreen(false);
    }
}

function injectLoginScreen(isAuthenticated) {
    let loginEl = document.getElementById('login-overlay-screen');
    if (isAuthenticated) { if (loginEl) loginEl.remove(); return; }
    if (!loginEl) {
        loginEl = document.createElement('div');
        loginEl.id = 'login-overlay-screen';
        loginEl.className = 'fixed inset-0 bg-zinc-900 z-50 flex items-center justify-center p-4 selection:bg-accent-soft selection:text-accent';
        loginEl.innerHTML = `
            <div class="bg-white w-full max-w-sm rounded-xl border border-zinc-200 shadow-xl p-6 md:p-8 space-y-6">
                <div class="text-center">
                    <div class="bg-[#1D4E89] text-white w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-3"><i class="fas fa-graduation-cap text-xl"></i></div>
                    <h2 class="text-xl font-bold text-zinc-900 tracking-tight">SiNilai Pro</h2>
                    <p class="text-xs text-zinc-500 mt-1">Sistem Manajemen Akademik & Nilai</p>
                </div>
                <form id="form-login-system" class="space-y-4">
                    <div id="login-error-msg" class="hidden text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-md flex items-center gap-2"><i class="fas fa-circle-exclamation"></i><span>Kredensial salah.</span></div>
                    <div>
                        <label class="block text-xs font-semibold text-zinc-600 mb-1.5">Username</label>
                        <input type="text" id="login-username" required class="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:border-[#1D4E89]">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-zinc-600 mb-1.5">Password</label>
                        <input type="password" id="login-password" required class="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-md focus:outline-none focus:border-[#1D4E89]">
                    </div>
                    <button type="submit" class="w-full bg-[#1D4E89] hover:bg-[#163B68] text-white text-sm font-medium py-2.5 px-4 rounded-md transition-colors"><i class="fas fa-sign-in-alt mr-2"></i> Masuk</button>
                </form>
            </div>`;
        document.body.appendChild(loginEl);
        document.getElementById('form-login-system').addEventListener('submit', (e) => {
            e.preventDefault();
            if (document.getElementById('login-username').value.trim() === AUTH_CREDENTIALS.username && document.getElementById('login-password').value === AUTH_CREDENTIALS.password) {
                sessionStorage.setItem('sinilai_auth', 'authenticated');
                injectLoginScreen(true);
                fetchDataFromGoogleSheets();
                showToast('Login berhasil!', 'success');
            } else { document.getElementById('login-error-msg').classList.remove('hidden'); }
        });
    }
}

function handleLogout() { sessionStorage.removeItem('sinilai_auth'); location.reload(); }

// =========================================================================
// 2. DATA MANAGEMENT & CORE VARIABLES
// =========================================================================
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyziWKgKXyBjr_OmBxiQ31PxdjtZuZ7f1VKp0HtlunzKA6uAts-I87sCoMqsIQphB7-vQ/exec';

let appData = { mataKuliah: {}, students: {}, dosen: {} };
const scale = { 'A': 4.0, 'B+': 3.5, 'B': 3.0, 'C+': 2.5, 'C': 2.0, 'D': 1.0, 'E': 0.0 };

// Variabel bantu untuk menyimpan status edit
let editState = { dosenNidn: null, matkulKode: null, nilaiIndex: null, nilaiNim: null, nilaiSemester: null };

function convertToGradeLetter(score) {
    if (score >= 85) return 'A'; if (score >= 75) return 'B+'; if (score >= 68) return 'B';
    if (score >= 60) return 'C+'; if (score >= 50) return 'C'; if (score >= 40) return 'D'; return 'E';
}

function sendToGoogleSheets(payload) {
    fetch(GOOGLE_SHEETS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
    .catch(err => console.error("Sheets Sync Error:", err));
}

function sendToWhatsApp(payload) {
    fetch('http://localhost:3000/send-wa', { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) })
    .catch(err => console.error("WA Server Error:", err));
}

async function fetchDataFromGoogleSheets() {
    const overlay = document.getElementById('loading-overlay');
    try {
        const response = await fetch(GOOGLE_SHEETS_URL);
        const data = await response.json();
        appData = { mataKuliah: {}, students: {}, dosen: {} };

        if (data.mataKuliah) data.mataKuliah.forEach(mk => appData.mataKuliah[mk.kode] = { kode: mk.kode, nama: mk.nama, sks: parseInt(mk.sks) });
        if (data.dosen) data.dosen.forEach(ds => appData.dosen[ds.nidn] = { nidn: ds.nidn, nama: ds.nama });
        if (data.students) {
            data.students.forEach(row => {
                const nim = row.nim, semester = row.semester;
                if (!appData.students[nim]) appData.students[nim] = { nim: nim, nama: row.nama, semesters: {} };
                if (!appData.students[nim].semesters[semester]) appData.students[nim].semesters[semester] = [];
                const findMK = Object.values(appData.mataKuliah).find(m => m.nama === row.matkul);
                appData.students[nim].semesters[semester].push({
                    kode: findMK ? findMK.kode : 'MK-', matkul: row.matkul, sks: parseInt(row.sks), dosen: row.dosen || 'Dosen Pengampu',
                    nilaiHuruf: row.nilaiHuruf, nilaiAngka: scale[row.nilaiHuruf] || 0,
                    nilaiTugas: row.nilaiTugas || 0, nilaiUts: row.nilaiUts || 0, nilaiUas: row.nilaiUas || 0
                });
            });
        }
        refreshAllViews();
    } catch (error) { showToast('Gagal memuat data online. Menggunakan data lokal.', 'error'); }
    if (overlay) { overlay.classList.add('hidden'); }
}

function refreshAllViews() {
    updateDashboard(); updateMasterView(); updateDosenView(); populateMatkulDropdown(); populateDosenDropdown(); updateView();
}

// =========================================================================
// 3. NAVIGATION & UI UTILITIES
// =========================================================================
let isMobileMenuOpen = false;
function toggleMobileMenu() {
    const nav = document.getElementById('sidebar-nav');
    isMobileMenuOpen = !isMobileMenuOpen;
    isMobileMenuOpen ? nav.classList.remove('hidden') : nav.classList.add('hidden');
}

function switchTab(tabId) {
    ['dashboard', 'dosen', 'master', 'input', 'view'].forEach(id => {
        if (document.getElementById(`sec-${id}`)) document.getElementById(`sec-${id}`).classList.add('hidden');
        if (document.getElementById(`nav-${id}`)) document.getElementById(`nav-${id}`).classList.remove('nav-active');
    });
    if (document.getElementById(`sec-${tabId}`)) document.getElementById(`sec-${tabId}`).classList.remove('hidden');
    if (document.getElementById(`nav-${tabId}`)) document.getElementById(`nav-${tabId}`).classList.add('nav-active');
    if (window.innerWidth < 768 && isMobileMenuOpen) toggleMobileMenu();
    refreshAllViews(); closeDetail();
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast'), msgEl = document.getElementById('toast-msg'), iconEl = document.getElementById('toast-icon');
    msgEl.innerText = message;
    iconEl.innerHTML = type === 'error' ? '<i class="fas fa-circle-exclamation text-danger-line"></i>' : '<i class="fas fa-check-circle text-success-line"></i>';
    toast.classList.remove('translate-y-full', 'opacity-0');
    clearTimeout(window.toastT); window.toastT = setTimeout(() => toast.classList.add('translate-y-full', 'opacity-0'), 3000);
}

function showFieldError(id, msg) {
    if (document.getElementById(id)) document.getElementById(id).classList.add('invalid');
    const err = document.querySelector(`.field-error[data-for="${id}"]`);
    if (err) { err.querySelector('span').innerText = msg; err.classList.add('show'); }
}
function clearFieldError(id) {
    if (document.getElementById(id)) document.getElementById(id).classList.remove('invalid');
    const err = document.querySelector(`.field-error[data-for="${id}"]`);
    if (err) err.classList.remove('show');
}

// =========================================================================
// 4. MODULE: DOSEN (EDIT & HAPUS)
// =========================================================================
function handleDosenSubmit(e) {
    e.preventDefault();
    const nidn = document.getElementById('dosen-nidn').value.trim(), nama = document.getElementById('dosen-nama').value.trim();
    if (!nidn || !nama) return showToast('Lengkapi data dosen!', 'error');

    let action = 'master_dosen';
    if (editState.dosenNidn) {
        if (editState.dosenNidn !== nidn) delete appData.dosen[editState.dosenNidn];
        action = 'edit_dosen';
        editState.dosenNidn = null;
    }

    appData.dosen[nidn] = { nidn, nama };
    sendToGoogleSheets({ id: Date.now(), action, nidn, namaDosen: nama });
    document.getElementById('form-dosen').reset();
    document.getElementById('dosen-nidn').disabled = false;
    updateDosenView(); updateDashboard();
    showToast('Data dosen berhasil disimpan!');
}

function editDosen(nidn) {
    const ds = appData.dosen[nidn];
    if (!ds) return;
    document.getElementById('dosen-nidn').value = ds.nidn;
    document.getElementById('dosen-nidn').disabled = true; // Kunci primary key saat edit
    document.getElementById('dosen-nama').value = ds.nama;
    editState.dosenNidn = nidn;
    showToast('Silakan ubah nama dosen pada form input.');
}

function deleteDosen(nidn) {
    if (confirm('Hapus dosen ini?')) {
        sendToGoogleSheets({ id: Date.now(), action: 'delete_dosen', nidn });
        delete appData.dosen[nidn];
        updateDosenView(); updateDashboard();
        showToast('Dosen berhasil dihapus.');
    }
}

function updateDosenView() {
    const tbody = document.getElementById('table-dosen-body');
    if (!tbody) return; tbody.innerHTML = '';
    Object.values(appData.dosen).forEach(ds => {
        tbody.innerHTML += `
            <tr class="hover:bg-surface transition-colors">
                <td class="p-3 px-5 text-sm font-semibold text-ink font-num">${ds.nidn}</td>
                <td class="p-3 text-sm text-ink-soft">${ds.nama}</td>
                <td class="p-3 px-5 text-center flex justify-center gap-2">
                    <button onclick="editDosen('${ds.nidn}')" class="text-accent hover:bg-accent-soft p-1.5 rounded"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteDosen('${ds.nidn}')" class="text-danger hover:bg-danger-soft p-1.5 rounded"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    });
}

function populateDosenDropdown() {
    const select = document.getElementById('input-dosen'); if (!select) return;
    select.innerHTML = '<option value="" disabled selected>Pilih Dosen</option>';
    Object.values(appData.dosen).forEach(ds => select.innerHTML += `<option value="${ds.nama}">${ds.nama}</option>`);
}

// =========================================================================
// 5. MODULE: MATA KULIAH (EDIT & HAPUS)
// =========================================================================
function handleMasterSubmit(e) {
    e.preventDefault();
    const kode = document.getElementById('master-kode').value.trim().toUpperCase();
    const nama = document.getElementById('master-nama').value.trim();
    const sks = parseInt(document.getElementById('master-sks').value);
    if (!kode || !nama || isNaN(sks)) return showToast('Lengkapi data matakuliah!', 'error');

    let action = 'master_matkul';
    if (editState.matkulKode) {
        if (editState.matkulKode !== kode) delete appData.mataKuliah[editState.matkulKode];
        action = 'edit_matkul';
        editState.matkulKode = null;
    }

    appData.mataKuliah[kode] = { kode, nama, sks };
    sendToGoogleSheets({ id: Date.now(), action, kode, namaMK: nama, sks });
    document.getElementById('form-master').reset();
    document.getElementById('master-kode').disabled = false;
    updateMasterView(); updateDashboard();
    showToast('Mata kuliah berhasil disimpan!');
}

function editMaster(kode) {
    const mk = appData.mataKuliah[kode]; if (!mk) return;
    document.getElementById('master-kode').value = mk.kode;
    document.getElementById('master-kode').disabled = true;
    document.getElementById('master-nama').value = mk.nama;
    document.getElementById('master-sks').value = mk.sks;
    editState.matkulKode = kode;
    showToast('Silakan sesuaikan data pada formulir.');
}

/* Penambahan fungsi hapus data mata kuliah */
function deleteMaster(kode) {
    if (confirm('Hapus mata kuliah ini dari master kurikulum?')) {
        sendToGoogleSheets({ id: Date.now(), action: 'delete_matkul', kode });
        delete appData.mataKuliah[kode];
        updateMasterView(); updateDashboard();
        showToast('Mata kuliah berhasil dihapus.', 'success');
    }
}

function updateMasterView() {
    const tbody = document.getElementById('table-master-body'); if (!tbody) return; tbody.innerHTML = '';
    Object.values(appData.mataKuliah).forEach(mk => {
        tbody.innerHTML += `
            <tr class="hover:bg-surface transition-colors">
                <td class="p-3 px-5 text-sm font-semibold text-ink font-num">${mk.kode}</td>
                <td class="p-3 text-sm text-ink-soft">${mk.nama}</td>
                <td class="p-3 text-center text-sm font-num">${mk.sks}</td>
                <td class="p-3 px-5 text-center flex justify-center gap-2">
                    <button onclick="editMaster('${mk.kode}')" class="text-accent hover:bg-accent-soft p-1.5 rounded"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteMaster('${mk.kode}')" class="text-danger hover:bg-danger-soft p-1.5 rounded"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
    });
}

function populateMatkulDropdown() {
    const select = document.getElementById('input-matkul'); if (!select) return;
    select.innerHTML = '<option value="" disabled selected>— Pilih mata kuliah —</option>';
    Object.values(appData.mataKuliah).forEach(mk => {
        select.innerHTML += `<option value="${mk.kode}" data-sks="${mk.sks}" data-nama="${mk.nama}">${mk.kode} — ${mk.nama}</option>`;
    });
}

function updateSksDisplay() {
    const select = document.getElementById('input-matkul');
    if (select.selectedIndex > 0) {
        const opt = select.options[select.selectedIndex];
        document.getElementById('display-sks').value = `${opt.getAttribute('data-sks')} SKS`;
        document.getElementById('input-sks').value = opt.getAttribute('data-sks');
    }
}

// =========================================================================
// 6. MODULE: KOMPONEN NILAI MAHASISWA (EDIT & HAPUS)
// =========================================================================
function handleFormSubmit(e) {
    e.preventDefault();
    const nim = document.getElementById('input-nim').value.trim(), nama = document.getElementById('input-nama').value.trim(), semester = document.getElementById('input-semester').value;
    const selectMK = document.getElementById('input-matkul'), dosen = document.getElementById('input-dosen').value;
    const tgs = parseFloat(document.getElementById('nilai-tugas').value) || 0, uts = parseFloat(document.getElementById('nilai-uts').value) || 0, uas = parseFloat(document.getElementById('nilai-uas').value) || 0;

    if (!nim || !nama || !semester || !selectMK.value || !dosen) return showToast('Harap lengkapi formulir nilai!', 'error');

    const total = (tgs * 0.3) + (uts * 0.3) + (uas * 0.4), grade = convertToGradeLetter(total);
    const kodeMk = selectMK.value, namaMk = selectMK.options[selectMK.selectedIndex].getAttribute('data-nama');
    const sks = parseInt(document.getElementById('input-sks').value) || 2;

    // Jika dalam mode edit, hapus entri nilai lama terlebih dahulu sebelum menimpa dengan yang baru
    if (editState.nilaiIndex !== null) {
        const st = appData.students[editState.nilaiNim];
        if (st && st.semesters[editState.nilaiSemester]) {
            st.semesters[editState.nilaiSemester].splice(editState.nilaiIndex, 1);
            if (st.semesters[editState.nilaiSemester].length === 0) delete st.semesters[editState.nilaiSemester];
        }
        editState = { dosenNidn: null, matkulKode: null, nilaiIndex: null, nilaiNim: null, nilaiSemester: null };
        document.getElementById('input-nim').disabled = false;
        document.getElementById('input-semester').disabled = false;
    }

    if (!appData.students[nim]) appData.students[nim] = { nim, nama, semesters: {} };
    if (!appData.students[nim].semesters[semester]) appData.students[nim].semesters[semester] = [];

    appData.students[nim].semesters[semester].push({
        kode: kodeMk, matkul: namaMk, sks: sks, dosen, nilaiHuruf: grade, nilaiAngka: scale[grade] || 0, nilaiTugas: tgs, nilaiUts: uts, nilaiUas: uas
    });

    sendToGoogleSheets({ id: Date.now(), action: 'input_nilai', nim, nama, semester, matkul: namaMk, sks, dosen, nilaiHuruf: grade, ipk: calculateIPK(appData.students[nim]).toFixed(2) });
    
    document.getElementById('form-nilai').reset();
    document.getElementById('display-sks').value = '';
    showToast('Rekor kompetensi nilai mahasiswa berhasil disimpan!');
    switchTab('view');
}

function editNilai(nim, sem, idx) {
    const st = appData.students[nim]; if (!st || !st.semesters[sem] || !st.semesters[sem][idx]) return;
    const mk = st.semesters[sem][idx];

    switchTab('input');
    document.getElementById('input-nim').value = st.nim;
    document.getElementById('input-nim').disabled = true; // Kunci relasi mahasiswa saat mengubah komponen nilai
    document.getElementById('input-nama').value = st.nama;
    document.getElementById('input-semester').value = sem;
    document.getElementById('input-semester').disabled = true;

    document.getElementById('input-matkul').value = mk.kode;
    updateSksDisplay();
    document.getElementById('input-dosen').value = mk.dosen;
    document.getElementById('nilai-tugas').value = mk.nilaiTugas || 0;
    document.getElementById('nilai-uts').value = mk.nilaiUts || 0;
    document.getElementById('nilai-uas').value = mk.nilaiUas || 0;

    editState.nilaiNim = nim; editState.nilaiSemester = sem; editState.nilaiIndex = idx;
    showToast('Modifikasi nilai komponen aktif.');
}

// =========================================================================
// 7. STATISTICS & METRICS CALCULATOR
// =========================================================================
function calculateIPK(student) {
    let b = 0, s = 0;
    for (const sm in student.semesters) { student.semesters[sm].forEach(m => { b += (m.sks * m.nilaiAngka); s += m.sks; }); }
    return s === 0 ? 0 : (b / s);
}
function calculateIPS(semData) {
    let b = 0, s = 0; semData.forEach(m => { b += (m.sks * m.nilaiAngka); s += m.sks; });
    return s === 0 ? 0 : (b / s);
}
function calculateAverageIPK() {
    const sts = Object.values(appData.students); if (sts.length === 0) return 0;
    let t = 0; sts.forEach(s => t += calculateIPK(s)); return t / sts.length;
}

function updateDashboard() {
    let tm = Object.keys(appData.students).length, td = Object.keys(appData.dosen).length, tk = Object.keys(appData.mataKuliah).length, tn = 0;
    for (const n in appData.students) { for (const s in appData.students[n].semesters) tn += appData.students[n].semesters[s].length; }
    if(document.getElementById('stat-mhs')) document.getElementById('stat-mhs').innerText = tm;
    if(document.getElementById('stat-dosen')) document.getElementById('stat-dosen').innerText = td;
    if(document.getElementById('stat-matkul-master')) document.getElementById('stat-matkul-master').innerText = tk;
    if(document.getElementById('stat-nilai')) document.getElementById('stat-nilai').innerText = tn;
    if(document.getElementById('stat-avg-ipk')) document.getElementById('stat-avg-ipk').innerText = calculateAverageIPK().toFixed(2);
}

// =========================================================================
// 8. TRANSCRIPT REKAP & MANAGEMENT ACTIONS
// =========================================================================
function updateView() {
    const tbody = document.getElementById('table-mhs-body'); if (!tbody) return; tbody.innerHTML = '';
    Object.values(appData.students).forEach(st => {
        let sks = 0; for (const sm in st.semesters) st.semesters[sm].forEach(m => sks += m.sks);
        tbody.innerHTML += `
            <tr class="hover:bg-surface transition-colors">
                <td class="p-4 px-5">
                    <div class="flex items-center">
                        <div class="w-8 h-8 rounded-md bg-accent-soft text-accent flex items-center justify-center font-semibold text-sm mr-3 flex-shrink-0">${st.nama.charAt(0).toUpperCase()}</div>
                        <div><p class="font-medium text-ink text-sm">${st.nama}</p><p class="text-xs text-muted font-num">${st.nim}</p></div>
                    </div>
                </td>
                <td class="p-4 text-center text-sm font-num">${sks}</td>
                <td class="p-4 text-center"><span class="bg-accent-soft text-accent border border-accent px-2.5 py-1 rounded-md font-semibold text-xs font-num">${calculateIPK(st).toFixed(2)}</span></td>
                <td class="p-4 px-5 text-center flex items-center justify-center gap-2">
                    <button onclick="viewDetail('${st.nim}')" class="border border-line text-ink-soft hover:text-accent px-3 py-1.5 rounded-md text-xs font-medium"><i class="fas fa-eye"></i> Rincian</button>
                    <button onclick="deleteStudentData('${st.nim}')" class="border border-line text-zinc-400 hover:text-danger px-2.5 py-1.5 rounded-md text-xs"><i class="fas fa-trash-can"></i> Hapus Mahasiswa</button>
                </td>
            </tr>`;
    });
}

function deleteStudentData(nim) {
    if (confirm(`Hapus permanen semua data akademik milik mahasiswa dengan NIM ${nim}?`)) {
        sendToGoogleSheets({ id: Date.now(), action: 'delete_mahasiswa', nim });
        delete appData.students[nim];
        updateView(); updateDashboard(); closeDetail();
        showToast('Rekor mahasiswa berhasil dihapus.');
    }
}

function deleteSubjectFromTranscript(nim, sem, kode) {
    if (confirm(`Hapus matakuliah [${kode}] dari semester ${sem}?`)) {
        sendToGoogleSheets({ id: Date.now(), action: 'delete_nilai_matkul', nim, semester: sem, kode });
        const st = appData.students[nim];
        st.semesters[sem] = st.semesters[sem].filter(m => m.kode !== kode);
        if (st.semesters[sem].length === 0) delete st.semesters[sem];
        if (Object.keys(st.semesters).length === 0) { delete appData.students[nim]; closeDetail(); } else { viewDetail(nim); }
        updateView(); updateDashboard();
        showToast('Nilai komponen berhasil dihapus.');
    }
}

function viewDetail(nim) {
    const student = appData.students[nim]; if (!student) return;
    document.getElementById('detail-nim').innerText = `NIM: ${student.nim}`;
    document.getElementById('detail-nama').innerText = student.nama;
    const ipk = calculateIPK(student); document.getElementById('detail-ipk').innerText = ipk.toFixed(2);
    document.getElementById('detail-status').innerText = ipk >= 3.51 ? 'Dengan Pujian (Cum Laude)' : ipk >= 3.0 ? 'Sangat Memuaskan' : ipk >= 2.0 ? 'Memuaskan' : 'Kurang';

    const container = document.getElementById('detail-semesters'); container.innerHTML = '';
    Object.keys(student.semesters).sort((a,b)=>parseInt(a)-parseInt(b)).forEach(sem => {
        let rows = '';
        student.semesters[sem].forEach((mk, idx) => {
            rows += `
                <tr class="border-b border-line last:border-0 hover:bg-surface">
                    <td class="py-3 px-4">
                        <p class="text-sm text-ink">${mk.matkul}</p>
                        <p class="text-[10px] text-muted font-num">${mk.kode} | Dosen: ${mk.dosen}</p>
                    </td>
                    <td class="py-3 px-4 text-center text-sm font-num">${mk.sks}</td>
                    <td class="py-3 px-4 text-center font-bold text-accent">${mk.nilaiHuruf}</td>
                    <td class="py-3 px-4 text-center no-print flex justify-center gap-2">
                        <button onclick="editNilai('${student.nim}', '${sem}', ${idx})" class="text-accent hover:bg-accent-soft p-1 rounded" title="Edit Nilai Komponen"><i class="fas fa-edit text-xs"></i></button>
                        <button onclick="deleteSubjectFromTranscript('${student.nim}', '${sem}', '${mk.kode}')" class="text-danger hover:bg-danger-soft p-1 rounded" title="Hapus"><i class="fas fa-trash text-xs"></i></button>
                    </td>
                </tr>`;
        });
        container.innerHTML += `
            <div class="border border-line rounded-lg overflow-hidden">
                <div class="bg-surface p-3 px-4 flex justify-between items-center border-b border-line">
                    <h4 class="text-sm font-semibold text-ink">Semester ${sem}</h4>
                    <span class="text-xs font-semibold text-muted">IPS: <span class="text-accent font-num">${calculateIPS(student.semesters[sem]).toFixed(2)}</span></span>
                </div>
                <table class="w-full text-left">
                    <thead><tr class="text-muted text-[10px] uppercase border-b border-line"><th class="py-2 px-4">Mata Kuliah</th><th class="py-2 text-center w-20">SKS</th><th class="py-2 text-center w-24">Nilai</th><th class="py-2 text-center w-20 no-print">Aksi</th></tr></thead>
                    <tbody class="bg-white">${rows}</tbody>
                </table>
            </div>`;
    });
    document.getElementById('detail-view').classList.remove('hidden');
    document.getElementById('detail-view').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeDetail() { if(document.getElementById('detail-view')) document.getElementById('detail-view').classList.add('hidden'); }

// =========================================================================
// 9. INITIALIZER & LIFECYCLE HOOKS
// =========================================================================
window.onload = () => {
    // Hubungkan pemicu event formulir ke fungsi internal baru
    if(document.getElementById('form-dosen')) document.getElementById('form-dosen').addEventListener('submit', handleDosenSubmit);
    if(document.getElementById('form-master')) document.getElementById('form-master').addEventListener('submit', handleMasterSubmit);
    if(document.getElementById('form-nilai')) document.getElementById('form-nilai').addEventListener('submit', handleFormSubmit);
    if(document.getElementById('input-matkul')) document.getElementById('input-matkul').addEventListener('change', updateSksDisplay);
    
    checkAuthStatus();
};
