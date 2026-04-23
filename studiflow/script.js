// --- Pendaftaran Service Worker untuk Notifikasi Latar Belakang ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('Service Worker terdaftar!'))
    .catch(err => console.log('Gagal daftar Service Worker', err));
}

// Fungsi Meminta Izin Notifikasi
function requestNotifPermission() {
    if (!("Notification" in window)) {
        alert("Browser kamu tidak mendukung notifikasi.");
        return;
    }
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            alert("Notifikasi aktif! Kamu akan diingatkan saat deadline tiba.");
            document.getElementById('notif-btn').style.display = 'none';
        }
    });
}

// Fungsi Mengirim Notifikasi lewat Service Worker
function sendNotification(title, message) {
    if (Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
                body: message,
                icon: 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png'
            });
        });
    }
}

// --- Inisialisasi Data dari LocalStorage ---
let tasks = JSON.parse(localStorage.getItem('sf_tasks')) || [];
let materials = JSON.parse(localStorage.getItem('sf_materials')) || [];
let events = JSON.parse(localStorage.getItem('sf_events')) || [];
let countdownInterval;

// Fungsi Navigasi Tab
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    btnElement.classList.add('active');
}

// --- FUNGSI TUGAS ---
function saveTasks() { localStorage.setItem('sf_tasks', JSON.stringify(tasks)); }

function renderTasks() {
    const list = document.getElementById('taskList');
    list.innerHTML = '';
    tasks.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

    tasks.forEach((task, i) => {
        const li = document.createElement('li');
        const fDate = new Date(`${task.date}T${task.time}`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
        const descHTML = task.desc ? `<div class="desc-box">${task.desc}</div>` : '';

        li.innerHTML = `
            <div class="info">
                <h3>${task.name}</h3>
                <p>📚 ${task.course} | ⏰ ${fDate} - ${task.time}</p>
                <div class="badge" id="cd-${i}">Waktu...</div>
                ${descHTML}
            </div>
            <button class="delete-btn" onclick="deleteTask(${i})">Selesai</button>
        `;
        list.appendChild(li);
    });

    clearInterval(countdownInterval);
    updateCountdowns();
    countdownInterval = setInterval(updateCountdowns, 1000);
}

function updateCountdowns() {
    const now = new Date().getTime();
    tasks.forEach((task, i) => {
        const badge = document.getElementById(`cd-${i}`);
        if (!badge) return;
        const targetTime = new Date(`${task.date}T${task.time}`).getTime();
        const dist = targetTime - now;

        // Picu Notifikasi jika sisa waktu tepat sekitar 10 Menit (600.000 ms)
        if (dist > 599000 && dist < 601000) { 
            sendNotification("📢 DEADLINE DEKAT!", `Tugas ${task.name} (${task.course}) tinggal 10 menit lagi!`);
        }

        if (dist < 0) {
            badge.innerHTML = "⚠️ TERLAMBAT"; badge.className = "badge overdue";
            badge.parentElement.parentElement.style.borderLeftColor = "#ef4444";
        } else {
            const d = Math.floor(dist / (1000 * 60 * 60 * 24));
            const h = Math.floor((dist % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            badge.innerHTML = `⏳ ${d}hr ${h}jm lagi`;
            badge.className = d === 0 ? "badge urgent" : "badge safe";
            if(d === 0) badge.parentElement.parentElement.style.borderLeftColor = "#f59e0b";
        }
    });
}

function addTask() {
    const name = document.getElementById('taskName').value;
    const course = document.getElementById('courseName').value;
    const desc = document.getElementById('taskDesc').value;
    const date = document.getElementById('deadlineDate').value;
    let time = document.getElementById('deadlineTime').value || "23:59";

    if (!name || !course || !date) return alert('Isi data tugas dengan lengkap!');
    
    tasks.push({ name, course, desc, date, time });
    saveTasks(); renderTasks();
    
    document.getElementById('taskName').value = ''; document.getElementById('courseName').value = ''; document.getElementById('taskDesc').value = '';
}
function deleteTask(i) { tasks.splice(i, 1); saveTasks(); renderTasks(); }

// --- FUNGSI MATERI ---
function toggleMatInput() {
    const type = document.getElementById('matSourceType').value;
    if (type === 'link') {
        document.getElementById('matLink').style.display = 'block';
        document.getElementById('matFile').style.display = 'none';
    } else {
        document.getElementById('matLink').style.display = 'none';
        document.getElementById('matFile').style.display = 'block';
    }
}

function saveMaterials() { localStorage.setItem('sf_materials', JSON.stringify(materials)); }

function updateCourseFilter() {
    const filter = document.getElementById('filterCourse');
    const courses = [...new Set(materials.map(m => m.course))]; 
    filter.innerHTML = '<option value="Semua">Tampilkan Semua Matkul</option>';
    courses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c; opt.textContent = c;
        filter.appendChild(opt);
    });
}

function renderMaterials() {
    const list = document.getElementById('materialList');
    const filterVal = document.getElementById('filterCourse').value;
    list.innerHTML = '';
    const filtered = filterVal === "Semua" ? materials : materials.filter(m => m.course === filterVal);

    filtered.forEach((mat, i) => {
        const li = document.createElement('li');
        li.className = "materi-item";
        const descHTML = mat.desc ? `<div class="desc-box">${mat.desc}</div>` : '';
        let actionHTML = mat.sourceType === 'link' ? 
            `<p>🔗 <a href="${mat.link}" target="_blank">Buka Dokumen / Link</a></p>` : 
            `<p>📁 <strong>Nama File:</strong> <span style="color:#38bdf8;">${mat.fileName}</span></p>`;

        // Cari index asli di array 'materials' untuk fungsi delete
        const originalIndex = materials.findIndex(m => m === mat);

        li.innerHTML = `
            <div class="info">
                <span style="color:#14b8a6; font-size:0.75rem; font-weight:700;">${mat.course.toUpperCase()}</span>
                <h3>[${mat.type}] ${mat.name}</h3>
                ${actionHTML}
                ${descHTML}
            </div>
            <button class="delete-btn" onclick="deleteMaterial(${originalIndex})">Hapus</button>
        `;
        list.appendChild(li);
    });
}

function addMaterial() {
    const course = document.getElementById('matCourse').value;
    const name = document.getElementById('matName').value;
    const type = document.getElementById('matType').value;
    const desc = document.getElementById('matDesc').value;
    const sourceType = document.getElementById('matSourceType').value;
    
    let link = "", fileName = "";

    if (sourceType === 'link') {
        link = document.getElementById('matLink').value;
        if (!course || !name || !link) return alert('Isi Matkul, Judul, dan Link!');
    } else {
        const fileInput = document.getElementById('matFile');
        if (!course || !name || fileInput.files.length === 0) return alert('Isi Matkul, Judul, dan pilih File!');
        fileName = fileInput.files[0].name;
    }
    
    materials.push({ course, name, type, desc, sourceType, link, fileName });
    saveMaterials(); updateCourseFilter(); renderMaterials();
    
    document.getElementById('matCourse').value = ''; document.getElementById('matName').value = ''; 
    document.getElementById('matDesc').value = ''; document.getElementById('matLink').value = ''; document.getElementById('matFile').value = '';
}
function deleteMaterial(i) { materials.splice(i, 1); saveMaterials(); updateCourseFilter(); renderMaterials(); }

// --- FUNGSI ACARA ---
function saveEvents() { localStorage.setItem('sf_events', JSON.stringify(events)); }

function renderEvents() {
    const list = document.getElementById('eventList');
    list.innerHTML = '';
    events.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

    events.forEach((ev, i) => {
        const li = document.createElement('li');
        li.className = "acara-item";
        const fDate = new Date(`${ev.date}T${ev.time}`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
        const descHTML = ev.desc ? `<div class="desc-box">${ev.desc}</div>` : '';

        li.innerHTML = `
            <div class="info">
                <h3>${ev.name}</h3>
                <p>📍 ${ev.location} | 🗓️ ${fDate} jam ${ev.time}</p>
                ${descHTML}
            </div>
            <button class="delete-btn" onclick="deleteEvent(${i})">Hapus</button>
        `;
        list.appendChild(li);
    });
}

function addEvent() {
    const name = document.getElementById('eventName').value;
    const location = document.getElementById('eventLocation').value;
    const desc = document.getElementById('eventDesc').value;
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;

    if (!name || !location || !date || !time) return alert('Lengkapi data acara!');
    events.push({ name, location, desc, date, time });
    saveEvents(); renderEvents();
    
    document.getElementById('eventName').value = ''; document.getElementById('eventLocation').value = ''; document.getElementById('eventDesc').value = '';
}
function deleteEvent(i) { events.splice(i, 1); saveEvents(); renderEvents(); }

// --- Inisialisasi ---
document.getElementById('deadlineTime').value = "23:59";
if (Notification.permission === "granted") document.getElementById('notif-btn').style.display = 'none';
updateCourseFilter();
renderTasks();
renderMaterials();
renderEvents();