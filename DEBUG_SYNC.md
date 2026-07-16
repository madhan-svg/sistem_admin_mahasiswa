# 🔍 Debug Guide: Masalah Sinkronisasi Google Sheets

## ✅ Cek-list Diagnosis

### 1. **Verifikasi URL Apps Script**
```javascript
// Buka Console (F12) dan jalankan:
console.log("URL Target:", 'https://script.google.com/macros/s/AKfycbyziWKgKXyBjr_OmBxiQ31PxdjtZuZ7f1VKp0HtlunzKA6uAts-I87sCoMqsIQphB7-vQ/exec');

// Tes fetch manual:
fetch('https://script.google.com/macros/s/AKfycbyziWKgKXyBjr_OmBxiQ31PxdjtZuZ7f1VKp0HtlunzKA6uAts-I87sCoMqsIQphB7-vQ/exec')
  .then(r => r.json())
  .then(data => console.log('✅ Response:', data))
  .catch(err => console.error('❌ Error:', err));
```

### 2. **Kemungkinan Penyebab**
- [ ] URL Apps Script sudah expired (Apps Script script dideploy ulang menghasilkan URL baru)
- [ ] Script di Google Sheets tidak ada/dihapus
- [ ] Deployment bukan sebagai "New" tetapi "Update existing" 
- [ ] CORS diblokir oleh browser

### 3. **Langkah Perbaikan di Google Sheets**

**Step A: Buka Google Sheet > Extensions > Apps Script**

**Step B: Ganti kode Apps Script dengan yang benar:**
```javascript
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      mataKuliah: [],
      dosen: [],
      students: []
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    Logger.log("Received:", payload);
    
    // Simpan ke sheet sesuai action
    const sheet = SpreadsheetApp.getActiveSheet();
    sheet.appendRow([
      new Date(),
      payload.action,
      JSON.stringify(payload)
    ]);
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

**Step C: Deploy ulang:**
1. Klik **"Deploy"** (icon roket)
2. Pilih **"New deployment"** (jangan "Update existing")
3. Type: **Google Apps Script**
4. Execute as: **[Your email]**
5. Who has access: **Anyone**
6. **Catat URL baru yang muncul**

### 4. **Update URL di app.js**
Setelah deploy, ganti Line 60:
```javascript
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/[DEPLOYMENT_ID_BARU]/exec';
```

### 5. **Nonaktifkan WhatsApp Server (untuk saat testing)**
Ubah di Line 79 jadi:
```javascript
function sendToWhatsApp(payload) {
    // Dinonaktifkan saat debugging
    // fetch('http://localhost:3000/send-wa', { ... });
    console.log("WA Payload:", payload);
}
```

---

## 📋 Test di Browser Console

```javascript
// Test 1: GET data
await fetch('https://script.google.com/macros/s/[URL]/exec').then(r => r.json());

// Test 2: POST data
await fetch('https://script.google.com/macros/s/[URL]/exec', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: Date.now(),
    action: 'test_connection',
    message: 'Testing from console'
  })
}).then(r => r.json());
```

---

## 🆘 Jika Masih Gagal

1. **Check di Google Sheet > Extensions > Apps Script > Executions** → Lihat error log
2. **Pastikan file sudah save di browser** → Ctrl+Shift+Del cache
3. **Deploy dengan mode "Execute as: ME" bukan Anonymous**
