// --- Fungsi Utilitas ---
function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${type === 'error' ? '⚠️' : '✅'} &nbsp; ${escapeHTML(message)}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Fungsi Set Tanggal Hari Ini sebagai Default
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = ['deadlineDate', 'eventDate'];
    dateInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = today;
            el.min = today; // Mencegah pilih tanggal lampau
        }
    });
}

// --- Pendaftaran Service Worker untuk Notifikasi Latar Belakang ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('Service Worker terdaftar!'))
    .catch(err => console.log('Gagal daftar Service Worker', err));
}

// Fungsi Meminta Izin Notifikasi
function requestNotifPermission() {
    if (!("Notification" in window)) {
        showToast("Browser kamu tidak mendukung notifikasi.", "error");
        return;
    }
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            showToast("Notifikasi aktif! Kamu akan diingatkan saat deadline tiba.", "success");
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
let courses = JSON.parse(localStorage.getItem('sf_courses')) || ["Umum", "Algoritma", "Basis Data"]; // Default matkul
let countdownInterval;
let lastAddedId = null; // Track item baru untuk animasi

// --- FUNGSI MATA KULIAH ---
function saveCourses() { localStorage.setItem('sf_courses', JSON.stringify(courses)); }

function renderCourseSelects() {
    const selects = ['courseName', 'matCourse'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const oldVal = el.value;
        el.innerHTML = '<option value="" disabled selected>Pilih Mata Kuliah...</option>';
        courses.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            el.appendChild(opt);
        });
        if (courses.includes(oldVal)) el.value = oldVal;
    });
}

function promptAddCourse() {
    const name = prompt("Masukkan nama Mata Kuliah baru:");
    if (name && name.trim() !== "") {
        const trimmed = name.trim();
        if (!courses.includes(trimmed)) {
            courses.push(trimmed);
            saveCourses();
            renderCourseSelects();
            // Juga set pilihan ke matkul yang baru dibuat
            document.getElementById('courseName').value = trimmed;
            document.getElementById('matCourse').value = trimmed;
            showToast(`Mata Kuliah "${trimmed}" berhasil ditambahkan!`, 'success');
        } else {
            showToast("Mata Kuliah sudah ada!", "error");
        }
    }
}

// Fungsi Navigasi Tab Utama
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.menu-bar .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    btnElement.classList.add('active');
}

// Fungsi Navigasi Form (Tugas / Materi)
function changeAkademikForm(formId, btnElement) {
    // Sembunyikan semua form di dalam tab akademik
    const forms = ['form-tugas', 'form-materi'];
    forms.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    
    // Tampilkan form yang dipilih
    const targetForm = document.getElementById(`form-${formId}`);
    if (targetForm) {
        targetForm.style.display = 'flex';
    }
    
    // Update status active pada tombol
    if (btnElement) {
        const parent = btnElement.closest('.form-toggle-row');
        if (parent) {
            parent.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            btnElement.classList.add('active');
        }
    }
}

// --- FUNGSI STATISTIK RINGKAS ---
function updateStats() {
    const elTugas = document.getElementById('stat-tugas');
    if (elTugas) {
        elTugas.textContent = tasks.length;
        document.getElementById('stat-materi').textContent = materials.length;
        document.getElementById('stat-urgent').textContent = tasks.filter(t => t.priority === 'tinggi').length;
    }
}

// --- FUNGSI TUGAS ---
function saveTasks() { localStorage.setItem('sf_tasks', JSON.stringify(tasks)); }

function renderTasks() {
    updateStats();
    const list = document.getElementById('taskList');
    list.innerHTML = '';
    
    if (tasks.length === 0) {
        list.innerHTML = '<div class="empty-state"><span>☕</span><p>Santai dulu, belum ada tugas nih!</p></div>';
        clearInterval(countdownInterval);
        return;
    }

    tasks.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

    tasks.forEach((task, i) => {
        const li = document.createElement('li');
        li.className = `priority-${task.priority || 'sedang'}`;
        if (task.isNew) {
            li.classList.add('new-item-anim');
            delete task.isNew; // Hanya animasi sekali
        }
        const fDate = new Date(`${task.date}T${task.time}`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
        const safeDesc = escapeHTML(task.desc);
        const descHTML = safeDesc ? `<div class="desc-box">${safeDesc}</div>` : '';

        li.innerHTML = `
            <div class="info">
                <h3>${escapeHTML(task.name)}</h3>
                <p>📚 ${escapeHTML(task.course)} | ⏰ ${fDate} - ${task.time}</p>
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
    const priority = document.getElementById('taskPriority').value;
    const date = document.getElementById('deadlineDate').value;
    let time = document.getElementById('deadlineTime').value || "23:59";

    if (!name || !course || !date) return showToast('Isi data tugas dengan lengkap!', 'error');
    
    tasks.push({ name, course, priority, desc, date, time, isNew: true });
    saveTasks(); renderTasks();
    showToast('Tugas berhasil ditambahkan!', 'success');
    
    document.getElementById('taskName').value = ''; 
    document.getElementById('courseName').value = ''; 
    document.getElementById('taskDesc').value = '';
    setTodayDate();
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
    updateStats();
    const list = document.getElementById('materialList');
    const filterVal = document.getElementById('filterCourse').value;
    list.innerHTML = '';
    const filtered = filterVal === "Semua" ? materials : materials.filter(m => m.course === filterVal);

    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state"><span>📁</span><p>Belum ada materi tersimpan.</p></div>';
        return;
    }

    filtered.forEach((mat, i) => {
        const li = document.createElement('li');
        li.className = "materi-item";
        if (mat.isNew) {
            li.classList.add('new-item-anim');
            delete mat.isNew;
        }
        const safeDesc = escapeHTML(mat.desc);
        const descHTML = safeDesc ? `<div class="desc-box">${safeDesc}</div>` : '';
        let actionHTML = mat.sourceType === 'link' ? 
            `<p>🔗 <a href="${escapeHTML(mat.link)}" target="_blank">Buka Dokumen / Link</a></p>` : 
            `<p>📁 <strong>Nama File:</strong> <a href="${mat.fileData || '#'}" download="${escapeHTML(mat.fileName)}" style="color:#38bdf8; text-decoration: underline; cursor: pointer;">${escapeHTML(mat.fileName)}</a></p>`;

        // Cari index asli di array 'materials' untuk fungsi delete
        const originalIndex = materials.findIndex(m => m === mat);

        li.innerHTML = `
            <div class="info">
                <span style="color:#14b8a6; font-size:0.75rem; font-weight:700;">${escapeHTML(mat.course).toUpperCase()}</span>
                <h3>[${escapeHTML(mat.type)}] ${escapeHTML(mat.name)}</h3>
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
    
    let link = "", fileName = "", fileData = null;

    if (sourceType === 'link') {
        link = document.getElementById('matLink').value;
        if (!course || !name || !link) return showToast('Isi Matkul, Judul, dan Link!', 'error');
        
        materials.push({ course, name, type, desc, sourceType, link, fileName, fileData, isNew: true });
        saveMaterials(); updateCourseFilter(); renderMaterials();
        clearMatInputs();
        showToast('Materi berhasil disimpan!', 'success');
    } else {
        const fileInput = document.getElementById('matFile');
        if (!course || !name || fileInput.files.length === 0) return showToast('Isi Matkul, Judul, dan pilih File!', 'error');
        
        const file = fileInput.files[0];
        fileName = file.name;
        
        // Membaca file sebagai Base64
        const reader = new FileReader();
        reader.onload = function(e) {
            fileData = e.target.result;
            materials.push({ course, name, type, desc, sourceType, link, fileName, fileData, isNew: true });
            saveMaterials(); updateCourseFilter(); renderMaterials();
            clearMatInputs();
            showToast('Materi file berhasil disimpan!', 'success');
        };
        reader.readAsDataURL(file);
    }
}

function clearMatInputs() {
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
        if (ev.isNew) {
            li.classList.add('new-item-anim');
            delete ev.isNew;
        }
        const fDate = new Date(`${ev.date}T${ev.time}`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
        const safeDesc = escapeHTML(ev.desc);
        const descHTML = safeDesc ? `<div class="desc-box">${safeDesc}</div>` : '';

        li.innerHTML = `
            <div class="info">
                <h3>${escapeHTML(ev.name)}</h3>
                <p>📍 ${escapeHTML(ev.location)} | 🗓️ ${fDate} jam ${ev.time}</p>
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

    if (!name || !location || !date || !time) return showToast('Lengkapi data acara!', 'error');
    events.push({ name, location, desc, date, time, isNew: true });
    saveEvents(); renderEvents();
    showToast('Acara berhasil ditambahkan!', 'success');
    
    document.getElementById('eventName').value = ''; document.getElementById('eventLocation').value = ''; document.getElementById('eventDesc').value = '';
    setTodayDate();
}
function deleteEvent(i) { events.splice(i, 1); saveEvents(); renderEvents(); }

// --- Inisialisasi ---
document.getElementById('deadlineTime').value = "23:59";
if (Notification.permission === "granted") document.getElementById('notif-btn').style.display = 'none';
setTodayDate();
renderCourseSelects();
updateCourseFilter();
renderTasks();
renderMaterials();
renderEvents();