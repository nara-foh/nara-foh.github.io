const SUPABASE_URL = 'https://mslsgobvzzxxkwfvpjhx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbHNnb2J2enp4eGt3ZnZwamh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzAzMDEsImV4cCI6MjA5NzgwNjMwMX0.V7pUmC3En3O0pc3VamJUm9eq7cnB7UFLi333LmtnJqQ';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let bahanBakuList = [], tempKomposisiBaru = [], tempKomposisiEdit = [];
let listKategori = [], listSubKategori = [];
let assignMenuTempData = [];
let fileImportTertunda = null, jenisImportTertunda = '';
let bbCurrentPage = 1, bbItemsPerPage = 10;
let bbSortKey = 'nama', bbSortOrder = 'asc';
let summarySortKey = 'nama';
let summarySortAsc = true;
let cachedResepSummaryData = [];

// ---------- GLOBAL STATE ----------
let currentUser = null;          // { id, email, role }
let appSettings = {
  hpp_limit: 35,
  overhead_type: 'nominal',
  overhead_value: 0
};

// ---------- HELPERS ----------
const formatRp = (angka) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(angka);

function formatRupiahInput(element) {
    let val = element.value.replace(/[^,\d]/g, '').toString();
    let split = val.split(',');
    let sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa);
    let ribuan = split[0].substr(sisa).match(/\d{3}/gi);
    if (ribuan) {
        let separator = sisa ? '.' : '';
        rupiah += separator + ribuan.join('.');
    }
    rupiah = split[1] != undefined ? rupiah + ',' + split[1] : rupiah;
    element.value = rupiah;
}

function getNilaiAsli(stringInput) {
    return parseFloat(String(stringInput).replace(/[^0-9]/g, '')) || 0;
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function toggleOverheadInputStyle() {
    const type = document.getElementById('setting-overhead-type').value;
    const symbol = document.getElementById('overhead-addon-symbol');
    const input = document.getElementById('setting-overhead');
    if (type === 'persen') {
        symbol.innerText = '%';
        input.placeholder = 'ex: 5';
    } else {
        symbol.innerText = 'Rp';
        input.placeholder = '0';
    }
}

function handleOverheadInputFormatting(element) {
    const type = document.getElementById('setting-overhead-type').value;
    if (type === 'nominal') {
        formatRupiahInput(element);
    }
}

function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

function showSummaryModal(isSuccess, title, successCount, failCount) {
    document.getElementById('summary-icon').innerText = isSuccess ? '✅' : '⚠️';
    document.getElementById('summary-title').innerText = title;
    document.getElementById('summary-success').innerText = successCount;
    document.getElementById('summary-fail').innerText = failCount;
    document.getElementById('modal-summary').classList.remove('hidden');
}

function getCardGradient(str) {
    const gradients = ['from-slate-800 to-slate-900', 'from-blue-800 to-indigo-900', 'from-emerald-800 to-teal-900', 'from-rose-800 to-pink-900', 'from-amber-800 to-orange-900', 'from-purple-800 to-fuchsia-900', 'from-cyan-800 to-blue-900', 'from-red-800 to-rose-900', 'from-lime-800 to-green-900'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const overlay = document.getElementById('mobile-overlay');
    if (menu.classList.contains('translate-x-full')) {
        menu.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.remove('opacity-0'), 10);
    } else {
        menu.classList.add('translate-x-full');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

function toggleKebabMenu(event, menuId) {
    event.stopPropagation();
    const targetMenu = document.getElementById(menuId);
    const isHidden = targetMenu.classList.contains('hidden');
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
    if (isHidden) targetMenu.classList.remove('hidden');
}

// ---------- ROLE HELPER ----------
function hasRole(minRole) {
    if (!currentUser) return false;
    const hierarchy = { staff: 1, admin: 2, senior_bar: 3, head_bar: 4 };
    return (hierarchy[currentUser.role] || 0) >= (hierarchy[minRole] || 0);
}

// ---------- AUTH & SESSION ----------
async function inisialisasiAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
        await fetchUserRoleAndSettings(session.user);
    } else {
        currentUser = null;
        await loadAppSettings(); // tetap ambil settings (untuk guest sekalipun)
        updateUIByRole();
    }
    // Listen auth changes
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
            await fetchUserRoleAndSettings(session.user);
        } else {
            currentUser = null;
            await loadAppSettings();
            updateUIByRole();
        }
    });
}

async function fetchUserRoleAndSettings(user) {
    showLoading();
    // 1. Ambil role
    const { data: roleData, error: roleErr } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

    let role = 'staff';
    if (roleErr || !roleData) {
        // Belum ada role -> buat default 'staff'
        const { error: insertErr } = await supabaseClient
            .from('user_roles')
            .insert([{ user_id: user.id, role: 'staff' }]);
        if (insertErr) console.error('Gagal insert role default:', insertErr);
        role = 'staff';
    } else {
        role = roleData.role;
    }

    currentUser = { id: user.id, email: user.email, role };

    // 2. Ambil settings dari DB
    await loadAppSettings();

    // 3. Update UI
    updateUIByRole();
    hideLoading();
}

async function loadAppSettings() {
    const { data, error } = await supabaseClient
        .from('app_settings')
        .select('key, value');
    if (error) {
        console.error('Gagal ambil settings:', error);
        return;
    }
    const map = {};
    data.forEach(row => { map[row.key] = row.value; });
    appSettings.hpp_limit = parseFloat(map.hpp_limit) || 35;
    appSettings.overhead_type = map.overhead_type || 'nominal';
    appSettings.overhead_value = parseFloat(map.overhead_value) || 0;
}

async function simpanSettings() {
    if (!hasRole('head_bar')) {
        alert('Hanya Head/Executive yang dapat mengubah pengaturan.');
        return;
    }
    const limitVal = parseFloat(document.getElementById('setting-hpp-limit').value);
    const ovhType = document.getElementById('setting-overhead-type').value;
    const inputOvh = document.getElementById('setting-overhead').value;
    const overheadVal = ovhType === 'nominal' ? getNilaiAsli(inputOvh) : (parseFloat(inputOvh) || 0);

    if (limitVal <= 0 || limitVal > 100) {
        alert('Masukkan persentase HPP limit yang valid (1-100)');
        return;
    }

    showLoading();
    const updates = [
        { key: 'hpp_limit', value: String(limitVal) },
        { key: 'overhead_type', value: ovhType },
        { key: 'overhead_value', value: String(overheadVal) }
    ];
    for (let u of updates) {
        await supabaseClient
            .from('app_settings')
            .update({ value: u.value, updated_at: new Date() })
            .eq('key', u.key);
    }
    await loadAppSettings(); // refresh local
    updateUIByRole();
    hideLoading();
    alert('Pengaturan berhasil diperbarui untuk semua pengguna.');
    loadDirektori();
}

// ---------- LOGIN / LOGOUT ----------
async function loginAdmin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-submit-login');
    if (!email || !password) return alert("Masukkan email dan password!");
    btn.innerText = "Memverifikasi...";
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    btn.innerText = "Autentikasi";
    if (error) {
        alert("Gagal Login: " + error.message);
    } else {
        closeModal('modal-login');
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        // Session akan di-handle oleh onAuthStateChange
    }
}

async function logoutAdmin() {
    if (!confirm("Apakah Anda yakin ingin keluar?")) return;
    showLoading();
    await supabaseClient.auth.signOut();
    hideLoading();
    // UI akan di-update oleh onAuthStateChange
}

// ---------- UI UPDATE BERDASARKAN ROLE ----------
function updateUIByRole() {
    const isLoggedIn = !!currentUser;
    const role = currentUser?.role || 'guest';

    // ---- Sembunyikan semua tab dulu ----
    const allTabs = ['tab-direktori', 'tab-summary', 'tab-dashboard', 'tab-bahan-baku', 'tab-input-hpp', 'tab-kategori', 'tab-settings'];
    const tabMap = {
        guest: ['tab-direktori', 'tab-summary'],
        staff: ['tab-direktori', 'tab-summary'],
        admin: ['tab-direktori', 'tab-summary', 'tab-dashboard', 'tab-bahan-baku'],
        senior_bar: ['tab-direktori', 'tab-summary', 'tab-dashboard', 'tab-bahan-baku', 'tab-input-hpp', 'tab-kategori'],
        head_bar: ['tab-direktori', 'tab-summary', 'tab-dashboard', 'tab-bahan-baku', 'tab-input-hpp', 'tab-kategori', 'tab-settings']
    };
    const allowed = tabMap[role] || tabMap.guest;

    // Sembunyikan semua
    allTabs.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); el.classList.remove('active'); }
    });

    // Tampilkan yang diizinkan
    allowed.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('hidden'); }
    });
    // Aktifkan tab pertama yang diizinkan
    const firstTab = allowed[0] || 'tab-direktori';
    const firstEl = document.getElementById(firstTab);
    if (firstEl) firstEl.classList.add('active');

    // ---- Render navbar tabs ----
    const navbar = document.getElementById('navbar-tabs');
    const tabNames = {
        'tab-direktori': '📑 Directory Menu',
        'tab-summary': '📊 Summary HPP',
        'tab-dashboard': '📈 Dashboard',
        'tab-bahan-baku': '📦 Bahan Baku',
        'tab-input-hpp': '✍️ Input Resep',
        'tab-kategori': '🏷️ Kategori',
        'tab-settings': '⚙️ Settings'
    };
    navbar.innerHTML = '';
    allowed.forEach(id => {
        const btn = document.createElement('button');
        btn.className = `btn-tab ${id === firstTab ? 'active' : ''}`;
        btn.innerText = tabNames[id] || id;
        btn.onclick = () => switchTab(id);
        navbar.appendChild(btn);
    });

    // ---- Mobile menu ----
    const mobileMenuList = document.getElementById('mobile-menu-list');
    mobileMenuList.innerHTML = '';
    // Status user
    const statusDiv = document.createElement('div');
    statusDiv.className = 'flex flex-col gap-3 pb-5 mb-3 border-b border-gray-100';
    const statusSpan = document.createElement('span');
    statusSpan.id = 'user-status-mobile';
    if (isLoggedIn) {
        statusSpan.className = 'text-sm font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg text-center shadow-inner';
        statusSpan.innerText = `🌟 ${role.toUpperCase()} (${currentUser.email})`;
    } else {
        statusSpan.className = 'text-sm font-bold text-gray-500 bg-gray-100 border border-gray-200 px-3 py-2 rounded-lg text-center shadow-inner';
        statusSpan.innerText = '👤 Guest (View Only)';
    }
    statusDiv.appendChild(statusSpan);

    if (isLoggedIn) {
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:shadow-lg transition-shadow text-center';
        logoutBtn.innerText = 'Logout Admin';
        logoutBtn.onclick = () => { toggleMobileMenu(); logoutAdmin(); };
        statusDiv.appendChild(logoutBtn);
    } else {
        const loginBtn = document.createElement('button');
        loginBtn.className = 'bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:shadow-lg transition-shadow text-center';
        loginBtn.innerText = 'Admin Login';
        loginBtn.onclick = () => { toggleMobileMenu(); document.getElementById('modal-login').classList.remove('hidden'); };
        statusDiv.appendChild(loginBtn);
    }
    mobileMenuList.appendChild(statusDiv);

    allowed.forEach(id => {
        const btn = document.createElement('button');
        btn.className = `btn-tab-mobile text-gray-600 font-semibold text-left py-3 px-4 rounded-xl hover:bg-gray-100 transition-colors ${id === firstTab ? 'bg-blue-50 text-blue-700 font-bold' : ''}`;
        btn.innerText = tabNames[id] || id;
        btn.onclick = () => { switchTab(id); toggleMobileMenu(); };
        mobileMenuList.appendChild(btn);
    });

    // ---- Tampilkan/sembunyikan elemen berdasarkan role ----
    document.querySelectorAll('.role-admin').forEach(el => {
        el.classList.toggle('hidden', !hasRole('admin'));
    });
    document.querySelectorAll('.role-senior').forEach(el => {
        el.classList.toggle('hidden', !hasRole('senior_bar'));
    });
    document.querySelectorAll('.role-head').forEach(el => {
        el.classList.toggle('hidden', !hasRole('head_bar'));
    });

    // ---- Settings readonly message ----
    const msg = document.getElementById('settings-readonly-msg');
    if (msg) {
        if (isLoggedIn && !hasRole('head_bar')) {
            msg.classList.remove('hidden');
        } else {
            msg.classList.add('hidden');
        }
    }

    // ---- Status bar ----
    const userStatus = document.getElementById('user-status');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    if (isLoggedIn) {
        userStatus.innerHTML = `🌟 ${role.toUpperCase()}`;
        userStatus.className = 'text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full shadow-inner border border-blue-200';
        btnLogin.classList.add('hidden');
        btnLogout.classList.remove('hidden');
    } else {
        userStatus.innerHTML = '👤 Guest';
        userStatus.className = 'text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full shadow-inner border border-gray-200';
        btnLogin.classList.remove('hidden');
        btnLogout.classList.add('hidden');
    }

    // ---- Isi settings form dengan nilai dari DB ----
    document.getElementById('setting-hpp-limit').value = appSettings.hpp_limit;
    document.getElementById('setting-overhead-type').value = appSettings.overhead_type;
    toggleOverheadInputStyle();
    if (appSettings.overhead_type === 'nominal') {
        document.getElementById('setting-overhead').value = appSettings.overhead_value.toString();
        formatRupiahInput(document.getElementById('setting-overhead'));
    } else {
        document.getElementById('setting-overhead').value = appSettings.overhead_value.toString();
    }

    // ---- Load data jika tab aktif ----
    if (document.getElementById('tab-bahan-baku').classList.contains('active')) {
        bbCurrentPage = 1;
        loadBahanBaku();
    }
    if (document.getElementById('tab-input-hpp').classList.contains('active')) {
        loadDropdownBahanBaku('baru');
    }
    loadDirektori(); // selalu refresh data
}

// ---------- SWITCH TAB ----------
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
        el.classList.add('hidden');
    });
    const target = document.getElementById(tabId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
    // Update active class di navbar
    document.querySelectorAll('.btn-tab').forEach(btn => btn.classList.remove('active'));
    const activeNav = Array.from(document.querySelectorAll('.btn-tab')).find(btn => {
        const onclickAttr = btn.getAttribute('onclick');
        return onclickAttr && onclickAttr.includes(`'${tabId}'`);
    });
    if (activeNav) activeNav.classList.add('active');

    // Muat data sesuai tab
    if (tabId === 'tab-bahan-baku') { bbCurrentPage = 1; loadBahanBaku(); }
    if (tabId === 'tab-input-hpp') loadDropdownBahanBaku('baru');
    if (tabId === 'tab-direktori' || tabId === 'tab-summary' || tabId === 'tab-dashboard') loadDirektori();
    if (tabId === 'tab-summary') renderTableSummary();
}

// ==================== FUNGSI LAINNYA (tidak berubah banyak, hanya tambahan pengecekan role) ====================

// [Semua fungsi dari kode asli, dengan penyesuaian role pada aksi kritis]
// Saya akan menulis ulang beberapa fungsi penting, tapi karena panjang, saya tulis ringkas.
// Untuk file final, saya sertakan semua fungsi yang sudah dimodifikasi.

// ---------- BAHAN BAKU ----------
function kalkulasiHargaSatuBB(mode) {
    const prefix = mode === 'edit' ? 'edit-bb-' : 'bb-';
    const hrgBeli = getNilaiAsli(document.getElementById(prefix + 'harga-beli').value);
    const konversi = parseFloat(document.getElementById(prefix + 'konversi').value) || 1;
    const satuan = document.getElementById(prefix + 'satuan-resep').value || '-';
    document.getElementById(prefix + 'harga-final').innerText = `${formatRp(hrgBeli / (konversi > 0 ? konversi : 1))} / ${satuan}`;
}

function sortBahanBaku(key, order) {
    bbSortKey = key;
    bbSortOrder = order;
    bbCurrentPage = 1;
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
    renderTabelBahanBaku();
}

async function loadBahanBaku() {
    const { data, error } = await supabaseClient.from('bahan_baku').select('*');
    if (!error) { bahanBakuList = data; renderTabelBahanBaku(); }
}

function updatePaginationBB() {
    bbCurrentPage = 1;
    const val = document.getElementById('bb-per-page').value;
    bbItemsPerPage = val === 'all' ? bahanBakuList.length : parseInt(val);
    renderTabelBahanBaku();
}

function ubahHalamanBB(page) {
    bbCurrentPage = page;
    renderTabelBahanBaku();
}

function renderTabelBahanBaku() {
    const searchQuery = document.getElementById('search-bb').value.toLowerCase();
    let filteredData = bahanBakuList.filter(item => item.nama.toLowerCase().includes(searchQuery));
    filteredData.sort((a, b) => {
        let valA = a[bbSortKey] !== null && a[bbSortKey] !== undefined ? a[bbSortKey] : '';
        let valB = b[bbSortKey] !== null && b[bbSortKey] !== undefined ? b[bbSortKey] : '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return bbSortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return bbSortOrder === 'asc' ? 1 : -1;
        return 0;
    });
    const totalData = filteredData.length;
    const isAll = document.getElementById('bb-per-page').value === 'all';
    let limit = isAll ? totalData : bbItemsPerPage;
    if (limit === 0) limit = 1;
    const totalPages = Math.ceil(totalData / limit);
    const startIndex = (bbCurrentPage - 1) * limit;
    const endIndex = startIndex + limit;
    const pageData = filteredData.slice(startIndex, endIndex);
    const tbody = document.getElementById('table-bahan-baku');
    tbody.innerHTML = '';
    if (totalData === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-gray-400 italic">Bahan baku tidak ditemukan.</td></tr>`;
    } else {
        pageData.forEach(item => {
            const canEdit = hasRole('admin');
            tbody.innerHTML += `<tr class="border-b border-gray-100 hover:bg-blue-50/30 transition-colors relative"><td class="p-4 font-bold text-gray-700 truncate max-w-xs border-r">${item.nama}</td><td class="p-3 border-l text-gray-500 bg-gray-50/50">${item.satuan_beli || '-'}</td><td class="p-3 border-r font-semibold text-gray-700 bg-gray-50/50">${item.harga_beli ? formatRp(item.harga_beli) : '-'}</td><td class="p-3 text-gray-500">${item.nilai_konversi || 1} ${item.satuan}</td><td class="p-3 text-blue-700 font-black">${formatRp(item.harga)} <span class="text-xs text-gray-400 font-normal">/ ${item.satuan}</span></td><td class="p-3 text-center border-l ${canEdit ? '' : 'hidden'}"><button onclick="toggleKebabMenu(event, 'drop-bb-${item.id}')" class="bg-gray-100 hover:bg-gray-200 text-gray-600 w-8 h-8 rounded-lg font-bold transition-colors">⋮</button><div id="drop-bb-${item.id}" class="dropdown-menu hidden absolute right-12 mt-1 bg-white shadow-xl rounded-xl border border-gray-100 w-32 py-2 z-20"><button onclick="bukaModalEditBB(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="w-full text-left px-4 py-2 hover:bg-blue-50 font-semibold text-blue-600">📝 Edit</button><button onclick="aksiHapusBahanBaku(${item.id}, '${item.nama}')" class="w-full text-left px-4 py-2 hover:bg-red-50 font-semibold text-red-600">🗑️ Hapus</button></div></td></tr>`;
        });
    }
    document.getElementById('bb-info-halaman').innerText = `Menampilkan ${totalData > 0 ? startIndex + 1 : 0} - ${Math.min(endIndex, totalData)} dari ${totalData} data`;
    let btnHTML = '';
    if (!isAll && totalPages > 1) {
        btnHTML += `<button onclick="ubahHalamanBB(${Math.max(1, bbCurrentPage - 1)})" class="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 font-medium ${bbCurrentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}">Prev</button>`;
        for (let i = 1; i <= totalPages; i++) {
            if (i === bbCurrentPage || i === 1 || i === totalPages || (i >= bbCurrentPage - 1 && i <= bbCurrentPage + 1)) {
                let active = i === bbCurrentPage ? 'bg-blue-600 text-white border-blue-600 shadow' : 'hover:bg-gray-100 text-gray-700 border-gray-200';
                btnHTML += `<button onclick="ubahHalamanBB(${i})" class="px-3 py-1.5 border rounded-lg font-medium ${active}">${i}</button>`;
            } else if (i === 2 || i === totalPages - 1) {
                btnHTML += `<span class="px-2 text-gray-400">...</span>`;
            }
        }
        btnHTML += `<button onclick="ubahHalamanBB(${Math.min(totalPages, bbCurrentPage + 1)})" class="px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-100 font-medium ${bbCurrentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}">Next</button>`;
    }
    document.getElementById('bb-pagination-controls').innerHTML = btnHTML;
}

async function tambahBahanBaku() {
    if (!hasRole('admin')) return alert('Akses ditolak.');
    const nama = document.getElementById('bb-nama').value.trim();
    const satuanBeli = document.getElementById('bb-satuan-beli').value.trim();
    const hargaBeli = getNilaiAsli(document.getElementById('bb-harga-beli').value);
    const konversi = parseFloat(document.getElementById('bb-konversi').value);
    const satuanResep = document.getElementById('bb-satuan-resep').value.trim();
    if (!nama || !satuanBeli || !hargaBeli || !konversi || !satuanResep) return alert("Lengkapi semua kolom!");
    showLoading();
    const { error } = await supabaseClient.from('bahan_baku').insert([{ nama, satuan_beli: satuanBeli, harga_beli: hargaBeli, nilai_konversi: konversi, satuan: satuanResep, harga: (hargaBeli / konversi) }]);
    hideLoading();
    if (error) alert("Gagal menyimpan bahan baku!");
    else {
        alert("Berhasil ditambahkan!");
        ['nama', 'satuan-beli', 'harga-beli', 'konversi', 'satuan-resep'].forEach(id => document.getElementById('bb-' + id).value = '');
        kalkulasiHargaSatuBB('baru');
        loadBahanBaku();
    }
}

async function aksiHapusBahanBaku(id, nama) {
    if (!hasRole('admin')) return alert('Akses ditolak.');
    if (confirm(`Yakin hapus "${nama}"?`)) {
        showLoading();
        const { error } = await supabaseClient.from('bahan_baku').delete().eq('id', id);
        hideLoading();
        if (error) {
            if (error.code === '23503') alert(`DITOLAK: "${nama}" masih digunakan dalam resep.`);
            else alert("Gagal hapus.");
        } else loadBahanBaku();
    }
}

function bukaModalEditBB(item) {
    if (!hasRole('admin')) return alert('Akses ditolak.');
    document.getElementById('edit-bb-id').value = item.id;
    document.getElementById('edit-bb-nama').value = item.nama;
    document.getElementById('edit-bb-satuan-beli').value = item.satuan_beli || '';
    document.getElementById('edit-bb-harga-beli').value = item.harga_beli ? item.harga_beli.toString() : '';
    formatRupiahInput(document.getElementById('edit-bb-harga-beli'));
    document.getElementById('edit-bb-konversi').value = item.nilai_konversi || '';
    document.getElementById('edit-bb-satuan-resep').value = item.satuan;
    kalkulasiHargaSatuBB('edit');
    document.getElementById('modal-edit-bb').classList.remove('hidden');
}

async function simpanEditBahanBaku() {
    if (!hasRole('admin')) return alert('Akses ditolak.');
    const id = document.getElementById('edit-bb-id').value;
    const nama = document.getElementById('edit-bb-nama').value.trim();
    const satuanBeli = document.getElementById('edit-bb-satuan-beli').value.trim();
    const hargaBeli = getNilaiAsli(document.getElementById('edit-bb-harga-beli').value);
    const konversi = parseFloat(document.getElementById('edit-bb-konversi').value);
    const satuanResep = document.getElementById('edit-bb-satuan-resep').value.trim();
    if (!nama || !hargaBeli) return alert("Lengkapi data!");
    showLoading();
    const { error } = await supabaseClient.from('bahan_baku').update({ nama, satuan_beli: satuanBeli, harga_beli: hargaBeli, nilai_konversi: konversi, satuan: satuanResep, harga: (hargaBeli / konversi) }).eq('id', id);
    hideLoading();
    if (error) alert("Gagal memperbarui data!");
    else { closeModal('modal-edit-bb'); loadBahanBaku(); loadDirektori(); }
}

// ---------- KATEGORI ----------
async function loadKategoriDB() {
    const { data, error } = await supabaseClient.from('kategori_db').select('*').order('nama');
    if (!error && data) {
        listKategori = data.filter(d => d.jenis === 'Kategori');
        listSubKategori = data.filter(d => d.jenis === 'Sub-Kategori');
        renderDropdownKategori();
        renderTabelManajemenKategori();
        populateFilterKategoriDirektori();
    }
}

function renderDropdownKategori() {
    const optKat = '<option value="Uncategorized">-- Pilih Kategori --</option>' + listKategori.map(k => `<option value="${k.nama}">${k.nama}</option>`).join('');
    const optSub = '<option value="Uncategorized">-- Pilih Sub-Kategori --</option>' + listSubKategori.map(k => `<option value="${k.nama}">${k.nama}</option>`).join('');
    ['r-kategori', 'edit-r-kategori'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).innerHTML = optKat; });
    ['r-sub', 'edit-r-sub'].forEach(id => { if (document.getElementById(id)) document.getElementById(id).innerHTML = optSub; });
    const fSum = document.getElementById('filter-summary-kat');
    if (fSum) {
        fSum.innerHTML = '<option value="all">Semua Kategori</option>' + listKategori.map(k => `<option value="${k.nama}">${k.nama}</option>`).join('');
    }
}

function populateFilterKategoriDirektori() {
    const filterEl = document.getElementById('filter-kategori-direktori');
    if (!filterEl) return;
    const currentVal = filterEl.value;
    filterEl.innerHTML = '<option value="all">Semua Kategori</option>' + listKategori.map(k => `<option value="${k.nama}">${k.nama}</option>`).join('');
    filterEl.value = currentVal;
}

function renderTabelManajemenKategori() {
    const ulKat = document.getElementById('list-manajemen-kategori');
    const ulSub = document.getElementById('list-manajemen-sub-kategori');
    if (!ulKat || !ulSub) return;

    const canEdit = hasRole('senior_bar');
    const generateHTML = (list, jenis) => {
        if (list.length === 0) return `<li class="text-sm text-gray-400 italic p-3 text-center border border-dashed rounded-lg">Belum ada data</li>`;
        return list.map(k => `
            <li class="flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-lg relative hover:bg-white transition-colors">
                <span class="font-semibold text-gray-700 truncate pr-4">${k.nama}</span>
                ${canEdit ? `<div class="relative"><button onclick="toggleKebabMenu(event, 'drop-kat-${k.id}')" class="bg-white hover:bg-gray-200 text-gray-600 w-8 h-8 rounded-lg font-bold shadow-sm border border-gray-200 transition-colors">⋮</button>
                <div id="drop-kat-${k.id}" class="dropdown-menu hidden absolute right-0 mt-1 bg-white shadow-xl rounded-xl border border-gray-100 w-44 py-2 text-sm text-gray-700 z-50 overflow-hidden">
                    <button onclick="bukaModalFormKategori('${jenis}', 'edit', ${k.id}, '${k.nama.replace(/'/g, "\\'")}')" class="w-full text-left px-4 py-2 hover:bg-blue-50 font-bold text-blue-600">📝 Edit Nama</button>
                    <button onclick="bukaModalAssignMenu('${jenis}', '${k.nama.replace(/'/g, "\\'")}')" class="w-full text-left px-4 py-2 hover:bg-green-50 font-bold text-green-600 border-b border-gray-100">➕ Tambahkan Menu</button>
                    <button onclick="hapusKategoriManajemen(${k.id}, '${jenis}', '${k.nama.replace(/'/g, "\\'")}')" class="w-full text-left px-4 py-2 hover:bg-red-50 font-bold text-red-600 mt-1">🗑️ Hapus Master</button>
                </div></div>` : ''}
            </li>
        `).join('');
    };
    ulKat.innerHTML = generateHTML(listKategori, 'Kategori');
    ulSub.innerHTML = generateHTML(listSubKategori, 'Sub-Kategori');
}

function bukaModalFormKategori(jenis, mode, id = null, oldName = '') {
    if (!hasRole('senior_bar')) return alert('Akses ditolak.');
    document.getElementById('kat-modal-jenis').value = jenis;
    document.getElementById('kat-modal-mode').value = mode;
    document.getElementById('kat-modal-id').value = id || '';
    document.getElementById('kat-modal-oldname').value = oldName || '';
    document.getElementById('kat-modal-label').innerText = `Nama Master ${jenis}`;
    const inputEl = document.getElementById('kat-modal-input');
    if (mode === 'tambah') {
        document.getElementById('kat-modal-title').innerText = `Tambah Master ${jenis} Baru`;
        inputEl.value = '';
    } else {
        document.getElementById('kat-modal-title').innerText = `Ubah Nama ${jenis}`;
        inputEl.value = oldName;
    }
    document.getElementById('modal-kelola-kategori').classList.remove('hidden');
}

async function simpanKategoriManajemen() {
    if (!hasRole('senior_bar')) return alert('Akses ditolak.');
    const jenis = document.getElementById('kat-modal-jenis').value;
    const mode = document.getElementById('kat-modal-mode').value;
    const id = document.getElementById('kat-modal-id').value;
    const oldName = document.getElementById('kat-modal-oldname').value;
    const inputName = document.getElementById('kat-modal-input').value.trim();
    if (!inputName) return alert(`Masukkan nama ${jenis} dengan benar!`);
    showLoading();
    if (mode === 'tambah') {
        await supabaseClient.from('kategori_db').insert([{ jenis: jenis, nama: inputName }]);
        closeModal('modal-kelola-kategori');
        await loadKategoriDB();
        hideLoading();
        if (confirm(`Sukses! ${jenis} "${inputName}" berhasil dibuat.\n\nApakah Anda ingin langsung memindahkan menu ke dalam kelompok ini?`)) {
            bukaModalAssignMenu(jenis, inputName);
        }
    } else {
        if (inputName === oldName) { hideLoading(); closeModal('modal-kelola-kategori'); return; }
        await supabaseClient.from('kategori_db').update({ nama: inputName }).eq('id', id);
        const fieldTarget = jenis === 'Kategori' ? 'kategori' : 'sub_kategori';
        let updatePayload = {};
        updatePayload[fieldTarget] = inputName;
        await supabaseClient.from('resep').update(updatePayload).eq(fieldTarget, oldName);
        closeModal('modal-kelola-kategori');
        await loadKategoriDB();
        loadDirektori();
        hideLoading();
        alert(`Nama berhasil diubah! Seluruh sinkronisasi data resep aman.`);
    }
}

async function hapusKategoriManajemen(id, jenis, nama) {
    if (!hasRole('senior_bar')) return alert('Akses ditolak.');
    const targetField = jenis === 'Kategori' ? 'kategori' : 'sub_kategori';
    showLoading();
    const { data: affectedMenus } = await supabaseClient.from('resep').select('id, nama').eq(targetField, nama);
    hideLoading();
    let msgConfirm = `Anda yakin ingin menghapus ${jenis} "${nama}" secara permanen?`;
    if (affectedMenus && affectedMenus.length > 0) {
        let menuNames = affectedMenus.map(m => `- ${m.nama}`).slice(0, 10).join('\n');
        if (affectedMenus.length > 10) menuNames += `\n... dan ${affectedMenus.length - 10} menu lainnya.`;
        msgConfirm = `PERINGATAN!\nMenghapus ${jenis} "${nama}" akan mengubah ${affectedMenus.length} menu berikut menjadi "Uncategorized":\n\n${menuNames}\n\nLanjutkan penghapusan?`;
    }
    if (confirm(msgConfirm)) {
        showLoading();
        if (affectedMenus && affectedMenus.length > 0) {
            let updatePayload = {};
            updatePayload[targetField] = 'Uncategorized';
            await supabaseClient.from('resep').update(updatePayload).eq(targetField, nama);
        }
        await supabaseClient.from('kategori_db').delete().eq('id', id);
        await loadKategoriDB();
        loadDirektori();
        hideLoading();
    }
}

async function bukaModalAssignMenu(jenis, namaTarget) {
    if (!hasRole('senior_bar')) return alert('Akses ditolak.');
    document.getElementById('assign-target-nama').value = namaTarget;
    document.getElementById('assign-target-jenis').value = jenis;
    document.getElementById('assign-modal-title').innerText = `Tambah Menu ke ${namaTarget}`;
    document.getElementById('assign-modal-subtitle').innerText = `Pilih menu yang akan dipindahkan ke ${jenis} ini.`;
    document.getElementById('search-assign-menu').value = '';
    showLoading();
    const { data } = await supabaseClient.from('resep').select('id, nama, kategori, sub_kategori').order('nama');
    hideLoading();
    assignMenuTempData = data || [];
    renderAssignMenuList();
    document.getElementById('modal-assign-menu').classList.remove('hidden');
}

function renderAssignMenuList() {
    const listContainer = document.getElementById('assign-menu-list');
    const searchQ = document.getElementById('search-assign-menu').value.toLowerCase();
    const jenis = document.getElementById('assign-target-jenis').value;
    const namaTarget = document.getElementById('assign-target-nama').value;
    const targetField = jenis === 'Kategori' ? 'kategori' : 'sub_kategori';
    listContainer.innerHTML = '';
    assignMenuTempData.forEach(menu => {
        if (searchQ && !menu.nama.toLowerCase().includes(searchQ)) return;
        const currentVal = menu[targetField] || 'Uncategorized';
        const isAlreadyInTarget = currentVal
