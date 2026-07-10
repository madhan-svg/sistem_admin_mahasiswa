// --- Data Management ---
const STORAGE_KEY = 'SistemNilaiData';

function getData() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : { students: {} };
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
function switchTab(tabId) {
    // Hide all sections
    document.getElementById('sec-dashboard').classList.add('hidden');
    document.getElementById('sec-input').classList.add('hidden');
    document.getElementById('sec-view').classList.add('hidden');
    
    // Remove active class from all nav items
    document.getElementById('nav-dashboard').classList.remove('nav-active');
    document.getElementById('nav-input').classList.remove('nav-active');
    document.getElementById('nav-view').classList.remove('nav-active');

    // Show selected section
    document.getElementById(`sec-${tabId}`).classList.remove('hidden');
    document.getElementById(`nav-${tabId}`).classList.add('nav-active');

    // Trigger updates
    if (tabId === 'dashboard') updateDashboard();
    if (tabId === 'view') updateView();
    
    // Hide detail view when switching away from view tab
    if (tabId !== 'view') closeDetail();
}

// --- Form Handling ---
function handleFormSubmit(event) {
    event.preventDefault();
    
    const nim = document.getElementById('input-nim').value.trim();
    const nama = document.getElementById('input-nama').value.trim();
    const semester = document.getElementById('input-semester').value;
    const matkul = document.getElementById('input-matkul').value.trim();
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
        // Update name just in case it was typed differently
        data.students[nim].nama = nama; 
    }

    // Initialize semester if not exists
    if (!data.students[nim].semesters[semester]) {
        data.students[nim].semesters[semester] = [];
    }

    // Add subject
    data.students[nim].semesters[semester].push({
        matkul, sks, nilaiHuruf, nilaiAngka
    });

    saveData(data);
    
    // Reset specific fields but keep nim/nama/semester for faster multiple inputs
    document.getElementById('input-matkul').value = '';
    document.getElementById('input-sks').value = '';
    document.getElementById('input-nilai').value = '';
    document.getElementById('input-matkul').focus();

    showToast('Data nilai berhasil disimpan!');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').innerText = message;
    
    toast.classList.remove('translate-y-full', 'opacity-0');
    
    setTimeout(() => {
        toast.classList.add('translate-y-full', 'opacity-0');
    }, 3000);
}

// --- Calculations & Updates ---
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
    let totalMatkul = 0;
    let totalNilai = 0;

    for (const nim in data.students) {
        for (const sem in data.students[nim].semesters) {
            const matkuls = data.students[nim].semesters[sem];
            totalMatkul += matkuls.length; // rough estimate of entries
            totalNilai += matkuls.length;
        }
    }

    document.getElementById('stat-mhs').innerText = totalMhs;
    document.getElementById('stat-matkul').innerText = totalMatkul; // Assuming each entry is a subject
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
            
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 border-b';
            tr.innerHTML = `
                <td class="p-4 font-medium text-gray-800">${student.nim}</td>
                <td class="p-4">${student.nama}</td>
                <td class="p-4">${totalSKS}</td>
                <td class="p-4 font-bold ${ipk >= 3.0 ? 'text-green-600' : (ipk >= 2.0 ? 'text-yellow-600' : 'text-red-600')}">${ipk}</td>
                <td class="p-4 text-center">
                    <button onclick="viewDetail('${student.nim}')" class="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded text-sm font-medium transition-colors">
                        <i class="fas fa-eye mr-1"></i> Detail
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
            rows += `
                <tr class="border-b last:border-0 hover:bg-gray-50">
                    <td class="py-2 px-3">${mk.matkul}</td>
                    <td class="py-2 px-3 text-center">${mk.sks}</td>
                    <td class="py-2 px-3 text-center font-medium">${mk.nilaiHuruf}</td>
                    <td class="py-2 px-3 text-center text-gray-500">${mk.nilaiAngka.toFixed(2)}</td>
                </tr>
            `;
        });

        const semHtml = `
            <div class="border rounded-lg overflow-hidden mb-4">
                <div class="bg-gray-100 p-3 flex justify-between items-center border-b">
                    <h4 class="font-bold text-gray-700">Semester ${sem}</h4>
                    <div class="flex space-x-4 text-sm">
                        <span>Total SKS: <span class="font-bold">${sksSem}</span></span>
                        <span>IPS: <span class="font-bold text-blue-600">${ips}</span></span>
                    </div>
                </div>
                <table class="w-full text-sm text-left">
                    <thead class="bg-gray-50 text-gray-600 border-b">
                        <tr>
                            <th class="py-2 px-3 font-semibold">Mata Kuliah</th>
                            <th class="py-2 px-3 font-semibold text-center w-20">SKS</th>
                            <th class="py-2 px-3 font-semibold text-center w-24">Nilai</th>
                            <th class="py-2 px-3 font-semibold text-center w-24">Bobot</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
        semestersContainer.innerHTML += semHtml;
    });

    document.getElementById('detail-view').classList.remove('hidden');
    // Scroll to detail view
    document.getElementById('detail-view').scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function closeDetail() {
    document.getElementById('detail-view').classList.add('hidden');
}

function clearAllData() {
    if(confirm('Apakah Anda yakin ingin menghapus SEMUA data mahasiswa dan nilai? Aksi ini tidak dapat dibatalkan.')) {
        localStorage.removeItem(STORAGE_KEY);
        updateDashboard();
        updateView();
        closeDetail();
        showToast('Semua data berhasil dihapus.');
    }
}

// Init
window.onload = () => {
    updateDashboard();
};
