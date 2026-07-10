// --- Data Management ---
const STORAGE_KEY = 'SistemNilaiData_v2'; // Changed key to avoid conflict with old data structure

function getData() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { mataKuliah: {}, students: {} };
}

function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
    document.getElementById('sec-dashboard').classList.add('hidden');
    document.getElementById('sec-dashboard').classList.remove('block');
    document.getElementById('sec-master').classList.add('hidden');
    document.getElementById('sec-master').classList.remove('block');
    document.getElementById('sec-input').classList.add('hidden');
    document.getElementById('sec-input').classList.remove('block');
    document.getElementById('sec-view').classList.add('hidden');
    document.getElementById('sec-view').classList.remove('block');
    
    // Remove active class from all nav items
    document.getElementById('nav-dashboard').classList.remove('nav-active');
    document.getElementById('nav-master').classList.remove('nav-active');
    document.getElementById('nav-input').classList.remove('nav-active');
    document.getElementById('nav-view').classList.remove('nav-active');

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
        iconEl.innerHTML = '<i class="fas fa-exclamation-circle text-xl text-red-400"></i>';
    } else {
        iconEl.innerHTML = '<i class="fas fa-check-circle text-xl text-green-400"></i>';
    }
    
    toast.classList.remove('translate-y-full', 'opacity-0');
    
    setTimeout(() => {
        toast.classList.add('translate-y-full', 'opacity-0');
    }, 3000);
}

// --- MASTER DATA LOGIC ---
function handleMasterSubmit(event) {
    event.preventDefault();
    
    const kode = document.getElementById('master-kode').value.trim().toUpperCase();
    const nama = document.getElementById('master-nama').value.trim();
    const sks = parseInt(document.getElementById('master-sks').value);
    
    const data = getData();
    
    data.mataKuliah[kode] = { kode, nama, sks };
    saveData(data);
    
    document.getElementById('master-kode').value = '';
    document.getElementById('master-nama').value = '';
    document.getElementById('master-sks').value = '';
    document.getElementById('master-kode').focus();
    
    updateMasterView();
    showToast(`Mata kuliah ${nama} ditambahkan!`);
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
            tr.className = 'hover:bg-gray-50 transition-colors';
            tr.innerHTML = `
                <td class="p-4 text-sm font-bold text-gray-700">${mk.kode}</td>
                <td class="p-4 text-sm text-gray-600">${mk.nama}</td>
                <td class="p-4 text-sm text-center font-medium">${mk.sks}</td>
                <td class="p-4 text-center">
                    <button onclick="deleteMaster('${mk.kode}')" class="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

function deleteMaster(kode) {
    if(confirm(`Yakin ingin menghapus mata kuliah ${kode}?`)) {
        const data = getData();
        delete data.mataKuliah[kode];
        saveData(data);
        updateMasterView();
        showToast('Mata kuliah dihapus.', 'success');
    }
}

// --- INPUT NILAI LOGIC ---
function populateMatkulDropdown() {
    const data = getData();
    const select = document.getElementById('input-matkul');
    const alertNoMaster = document.getElementById('alert-no-master');
    const btnSubmit = document.getElementById('btn-submit-nilai');
    
    const matkuls = Object.values(data.mataKuliah);
    
    // Clear existing options
    select.innerHTML = '<option value="" disabled selected>-- Pilih Mata Kuliah --</option>';
    
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
            option.text = `${mk.kode} - ${mk.nama}`;
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
    if(select.selectedIndex > 0) {
        const option = select.options[select.selectedIndex];
        const sks = option.getAttribute('data-sks');
        document.getElementById('display-sks').value = `${sks} SKS`;
        document.getElementById('input-sks').value = sks;
    }
}

function handleFormSubmit(event) {
    event.preventDefault();
    
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
    if(exists) {
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

    saveData(data);
    
    // Reset specific fields
    document.getElementById('input-matkul').value = '';
    document.getElementById('display-sks').value = '';
    document.getElementById('input-sks').value = '';
    document.getElementById('input-nilai').value = '';
    document.getElementById('input-matkul').focus();

    showToast('Data nilai berhasil direkam!');
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
            let ipkColor = 'text-green-600';
            let ipkBg = 'bg-green-50';
            
            if (ipk < 2.0) { ipkColor = 'text-red-600'; ipkBg = 'bg-red-50'; }
            else if (ipk < 3.0) { ipkColor = 'text-amber-600'; ipkBg = 'bg-amber-50'; }

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50/50 transition-colors';
            tr.innerHTML = `
                <td class="p-5">
                    <div class="flex items-center">
                        <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold mr-3 shadow-sm">
                            ${student.nama.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p class="font-bold text-gray-800">${student.nama}</p>
                            <p class="text-xs text-gray-500">${student.nim}</p>
                        </div>
                    </div>
                </td>
                <td class="p-5 text-center font-medium text-gray-600">${totalSKS}</td>
                <td class="p-5 text-center">
                    <span class="${ipkBg} ${ipkColor} px-3 py-1 rounded-full font-bold text-sm border border-opacity-20 border-current shadow-sm">${ipk}</span>
                </td>
                <td class="p-5 text-center">
                    <button onclick="viewDetail('${student.nim}')" class="bg-white border border-gray-200 text-gray-700 hover:text-indigo-600 hover:border-indigo-300 shadow-sm px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:shadow">
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
    const semKeys = Object.keys(student.semesters).sort((a,b) => parseInt(a) - parseInt(b));

    semKeys.forEach(sem => {
        const mkData = student.semesters[sem];
        const ips = calculateIPS(mkData).toFixed(2);
        
        let sksSem = 0;
        let rows = '';
        
        mkData.forEach(mk => {
            sksSem += mk.sks;
            let badgeColor = 'bg-green-100 text-green-700';
            if(['D','E'].includes(mk.nilaiHuruf)) badgeColor = 'bg-red-100 text-red-700';
            else if(['C','C+'].includes(mk.nilaiHuruf)) badgeColor = 'bg-amber-100 text-amber-700';

            rows += `
                <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                    <td class="py-3 px-4">
                        <p class="font-medium text-gray-700">${mk.matkul}</p>
                        <p class="text-xs text-gray-400">${mk.kode || '-'}</p>
                    </td>
                    <td class="py-3 px-4 text-center text-sm font-medium text-gray-600">${mk.sks}</td>
                    <td class="py-3 px-4 text-center">
                        <span class="${badgeColor} px-2 py-0.5 rounded text-xs font-bold">${mk.nilaiHuruf}</span>
                    </td>
                    <td class="py-3 px-4 text-center text-sm font-medium text-gray-500">${mk.nilaiAngka.toFixed(2)}</td>
                </tr>
            `;
        });

        const semHtml = `
            <div class="border border-gray-100 rounded-xl overflow-hidden mb-5 shadow-sm">
                <div class="bg-gray-50/80 p-4 flex justify-between items-center border-b border-gray-100">
                    <h4 class="font-bold text-indigo-900">Semester ${sem}</h4>
                    <div class="flex space-x-4 text-sm bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-100">
                        <span class="text-gray-500">SKS: <span class="font-bold text-gray-800">${sksSem}</span></span>
                        <span class="text-gray-300">|</span>
                        <span class="text-gray-500">IPS: <span class="font-bold text-indigo-600">${ips}</span></span>
                    </div>
                </div>
                <table class="w-full text-left">
                    <thead class="bg-white text-gray-400 text-xs uppercase border-b border-gray-100">
                        <tr>
                            <th class="py-3 px-4 font-semibold">Mata Kuliah</th>
                            <th class="py-3 px-4 font-semibold text-center w-20">SKS</th>
                            <th class="py-3 px-4 font-semibold text-center w-24">Nilai</th>
                            <th class="py-3 px-4 font-semibold text-center w-24">Bobot</th>
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
    if(confirm('Apakah Anda yakin ingin menghapus SEMUA data? Ini akan mereset Master Data & Nilai Mahasiswa.')) {
        localStorage.removeItem(STORAGE_KEY);
        
        // Return to old data key for compatibility if it existed? Better just wipe.
        updateDashboard();
        updateMasterView();
        populateMatkulDropdown();
        updateView();
        closeDetail();
        showToast('Sistem telah direset total.', 'success');
    }
}

// Init
window.onload = () => {
    updateDashboard();
    updateMasterView();
    populateMatkulDropdown();
};
