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

let currentUser = null;
let appSettings = {
  hpp_limit: 35,
  overhead_type: 'nominal',  // 'nominal' atau 'persen'
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

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) { alert(message); return; }
    const styles = {
        success: 'bg-emerald-600 border-emerald-800',
        error: 'bg-red-600 border-red-800',
        info: 'bg-blue-600 border-blue-800'
    };
    const icons = { success: '✅', error: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast-item ${styles[type] || styles.success} text-white px-5 py-4 rounded-xl shadow-2xl border-b-4 flex items-start gap-3 max-w-sm`;
    toast.innerHTML = `<span class="text-xl leading-none">${icons[type] || icons.success}</span><span class="text-sm font-semibold leading-snug pt-0.5">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    }, 3800);
}

function toggleOverheadInputStyle() {
    const type = document.getElementById('setting-overhead-type').value;
    const symbol = document.getElementById('overhead-addon-symbol');
    const input = document.getElementById('setting-overhead');
    const helper = document.getElementById('overhead-helper-text');
    document.querySelectorAll('.overhead-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
    if (type === 'persen') {
        symbol.innerText = '%';
        input.placeholder = 'ex: 5';
        if (helper) helper.innerText = 'Contoh: jika diisi 5, maka HPP bahan akan ditambah 5% dari nilainya sebagai biaya overhead.';
    } else {
        symbol.innerText = 'Rp';
        input.placeholder = '0';
        if (helper) helper.innerText = 'Nilai ini akan ditambahkan secara tetap (flat) ke HPP setiap porsi resep.';
    }
}

function setOverheadType(type) {
    document.getElementById('setting-overhead-type').value = type;
    toggleOverheadInputStyle();
}

function updateOverheadStatusBadge() {
    const badge = document.getElementById('overhead-status-badge');
    if (!badge) return;
    if (appSettings.overhead_value > 0) {
        const display = appSettings.overhead_type === 'persen'
            ? `${appSettings.overhead_value}% / porsi`
            : `${formatRp(appSettings.overhead_value)} / porsi`;
        badge.innerHTML = `✅ Tersimpan: ${display}`;
        badge.className = 'text-xs font-bold px-3 py-1.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm whitespace-nowrap';
    } else {
        badge.innerHTML = `⚪ Belum diatur`;
        badge.className = 'text-xs font-bold px-3 py-1.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200 shadow-sm whitespace-nowrap';
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

// ---------- LOGIN SCREEN ----------
function showLoginScreen() {
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('login-overlay').style.opacity = '1';
    document.getElementById('app-wrapper').classList.add('hidden');
}

function hideLoginScreen() {
    document.getElementById('login-overlay').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('app-wrapper').classList.remove('hidden');
    }, 300);
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
        showLoginScreen();
        await loadAppSettings();
    }
    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
            await fetchUserRoleAndSettings(session.user);
        } else {
            currentUser = null;
            showLoginScreen();
            await loadAppSettings();
        }
    });
}

async function fetchUserRoleAndSettings(user) {
    showLoading();
    
    const { data: roleData, error: roleErr } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

    console.log('roleData dari DB:', roleData);

    let role = 'staff';
    if (roleErr) {
        console.error('Error ambil role:', roleErr);
        const { error: insertErr } = await supabaseClient
            .from('user_roles')
            .insert([{ user_id: user.id, role: 'staff' }]);
        if (insertErr) console.error('Gagal insert role default:', insertErr);
        role = 'staff';
    } else if (!roleData) {
        const { error: insertErr } = await supabaseClient
            .from('user_roles')
            .insert([{ user_id: user.id, role: 'staff' }]);
        if (insertErr) console.error('Gagal insert role default:', insertErr);
        role = 'staff';
    } else {
        role = roleData.role;
    }

    currentUser = { id: user.id, email: user.email, role };
    console.log('currentUser final:', currentUser);

    await loadAppSettings();
    updateUIByRole();
    hideLoginScreen();
    hideLoading();
}

// ---------- LOAD SETTINGS DARI DATABASE ----------
async function loadAppSettings() {
    try {
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
        console.log('appSettings setelah load:', appSettings);
    } catch (e) {
        console.error('Error loadAppSettings:', e);
    }
}

// ---------- SIMPAN SETTINGS KE DATABASE ----------
async function simpanSettings() {
    if (!hasRole('head_bar')) {
        showToast('Hanya Head/Executive yang dapat mengubah pengaturan.', 'error');
        return;
    }
    const limitVal = parseFloat(document.getElementById('setting-hpp-limit').value);
    const ovhType = document.getElementById('setting-overhead-type').value;
    const inputOvh = document.getElementById('setting-overhead').value;
    const overheadVal = ovhType === 'nominal' ? getNilaiAsli(inputOvh) : (parseFloat(inputOvh) || 0);

    if (!limitVal || limitVal <= 0 || limitVal > 100) {
        showToast('Masukkan persentase HPP limit yang valid (1-100).', 'error');
        return;
    }
    if (ovhType === 'persen' && overheadVal > 100) {
        showToast('Persentase overhead tidak boleh lebih dari 100%.', 'error');
        return;
    }

    const btn = document.getElementById('btn-simpan-settings');
    const btnText = document.getElementById('btn-simpan-settings-text');
    if (btn) { btn.disabled = true; btn.classList.add('opacity-60', 'cursor-not-allowed'); }
    if (btnText) btnText.innerHTML = '<span class="btn-mini-spinner"></span>Menyimpan...';
    showLoading();

    const updates = [
        { key: 'hpp_limit', value: String(limitVal) },
        { key: 'overhead_type', value: ovhType },
        { key: 'overhead_value', value: String(overheadVal) }
    ];

    let gagalUpdate = false, errMsg = '';
    for (const u of updates) {
        const { error, data } = await supabaseClient
            .from('app_settings')
            .update({ value: u.value, updated_at: new Date() })
            .eq('key', u.key)
            .select();
        if (error) { gagalUpdate = true; errMsg = error.message; break; }
        if (!data || data.length === 0) {
            gagalUpdate = true;
            errMsg = `Baris dengan key "${u.key}" belum ada di tabel app_settings. Jalankan SQL seed terlebih dahulu di Supabase SQL Editor.`;
            break;
        }
    }

    hideLoading();
    if (btn) { btn.disabled = false; btn.classList.remove('opacity-60', 'cursor-not-allowed'); }
    if (btnText) btnText.innerHTML = '💾 Simpan Pengaturan';

    if (gagalUpdate) {
        console.error('Gagal simpan settings:', errMsg);
        showToast('Gagal menyimpan pengaturan: ' + errMsg, 'error');
        return;
    }

    await loadAppSettings();
    updateUIByRole();
    showToast('Pengaturan biaya overhead & batas HPP berhasil disimpan ke database untuk semua pengguna.', 'success');
}

// ---------- LOGIN / LOGOUT ----------
async function loginAdmin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-submit-login');
    if (!email || !password) return alert("Masukkan email dan password!");
    btn.innerText = "Memverifikasi...";
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    btn.innerText = "Masuk";
    if (error) {
        alert("Gagal Login: " + error.message);
    } else {
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
    }
}

async function logoutAdmin() {
    if (!confirm("Apakah Anda yakin ingin keluar?")) return;
    showLoading();
    await supabaseClient.auth.signOut();
    hideLoading();
}

// ---------- UI UPDATE BERDASARKAN ROLE ----------
function updateUIByRole() {
    console.log('=== updateUIByRole dipanggil ===');
    console.log('currentUser:', currentUser);
    console.log('appSettings:', appSettings);

    const isLoggedIn = !!currentUser;
    const role = currentUser?.role || 'guest';

    const validRoles = ['staff', 'admin', 'senior_bar', 'head_bar'];
    if (isLoggedIn && !validRoles.includes(role)) {
        console.warn('Role tidak valid, diubah ke staff');
        currentUser.role = 'staff';
    }

    // ---- Tab mapping ----
    const allTabs = ['tab-direktori', 'tab-summary', 'tab-dashboard', 'tab-bahan-baku', 'tab-input', 'tab-kategori', 'tab-data-penjualan', 'tab-settings'];
    const tabMap = {
        staff: ['tab-direktori', 'tab-summary'],
        admin: ['tab-direktori', 'tab-summary', 'tab-dashboard', 'tab-bahan-baku'],
        senior_bar: ['tab-direktori', 'tab-summary', 'tab-dashboard', 'tab-bahan-baku', 'tab-input', 'tab-kategori', 'tab-data-penjualan'],
        head_bar: ['tab-direktori', 'tab-summary', 'tab-dashboard', 'tab-bahan-baku', 'tab-input', 'tab-kategori', 'tab-data-penjualan', 'tab-settings']
    };
    const allowed = tabMap[role] || tabMap.staff;

    // Sembunyikan semua tab
    allTabs.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); el.classList.remove('active'); }
    });

    // Tampilkan yang diizinkan
    allowed.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('hidden'); }
    });
    const firstTab = allowed[0] || 'tab-direktori';
    const firstEl = document.getElementById(firstTab);
    if (firstEl) firstEl.classList.add('active');

    // ---- Render navbar ----
    const navbar = document.getElementById('navbar-tabs');
    const tabNames = {
        'tab-direktori': '📑 Directory Menu',
        'tab-summary': '📊 Summary HPP',
        'tab-dashboard': '📈 Dashboard',
        'tab-bahan-baku': '📦 Bahan Baku',
        'tab-input': '✍️ Input Data',
        'tab-kategori': '🏷️ Kategori',
        'tab-data-penjualan': '📋 Data Penjualan',
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
    const statusDiv = document.createElement('div');
    statusDiv.className = 'flex flex-col gap-3 pb-5 mb-3 border-b border-gray-100';
    const statusSpan = document.createElement('span');
    statusSpan.className = 'text-sm font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg text-center shadow-inner';
    statusSpan.innerText = isLoggedIn ? `🌟 ${role.toUpperCase()} (${currentUser.email})` : '👤 Guest';
    statusDiv.appendChild(statusSpan);

    if (isLoggedIn) {
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:shadow-lg transition-shadow text-center';
        logoutBtn.innerText = 'Logout Admin';
        logoutBtn.onclick = () => { toggleMobileMenu(); logoutAdmin(); };
        statusDiv.appendChild(logoutBtn);
    }
    mobileMenuList.appendChild(statusDiv);

    allowed.forEach(id => {
        const btn = document.createElement('button');
        btn.className = `btn-tab-mobile text-gray-600 font-semibold text-left py-3 px-4 rounded-xl hover:bg-gray-100 transition-colors ${id === firstTab ? 'bg-blue-50 text-blue-700 font-bold' : ''}`;
        btn.innerText = tabNames[id] || id;
        btn.onclick = () => { switchTab(id); toggleMobileMenu(); };
        mobileMenuList.appendChild(btn);
    });

    // ---- Role-based visibility ----
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

    // ---- Status bar di navbar ----
    const userStatus = document.getElementById('user-status');
    if (isLoggedIn) {
        userStatus.innerHTML = `🌟 ${role.toUpperCase()}`;
        userStatus.className = 'text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full shadow-inner border border-blue-200';
    } else {
        userStatus.innerHTML = '👤 Guest';
        userStatus.className = 'text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full shadow-inner border border-gray-200';
    }

    // ---- ISI SETTINGS FORM DARI appSettings ----
    document.getElementById('setting-hpp-limit').value = appSettings.hpp_limit;
    setOverheadType(appSettings.overhead_type);
    if (appSettings.overhead_type === 'nominal') {
        document.getElementById('setting-overhead').value = appSettings.overhead_value.toString();
        formatRupiahInput(document.getElementById('setting-overhead'));
    } else {
        document.getElementById('setting-overhead').value = appSettings.overhead_value.toString();
    }
    updateOverheadStatusBadge();

    // ---- Inisialisasi dropdown bulan/tahun ----
    initBulanTahunDropdowns();
    loadMenuDropdownPenjualan();

    // ---- Load data untuk tab yang aktif ----
    if (document.getElementById('tab-bahan-baku').classList.contains('active')) {
        bbCurrentPage = 1;
        loadBahanBaku();
    }
    if (document.getElementById('tab-input').classList.contains('active')) {
        loadDropdownBahanBaku('baru');
        // Set default sub tab ke HPP
        switchInputSubTab('hpp');
    }
    // Selalu refresh data resep
    loadDirektori();

    console.log('=== updateUIByRole selesai, role sekarang:', role);
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
    document.querySelectorAll('.btn-tab').forEach(btn => btn.classList.remove('active'));
    const activeNav = Array.from(document.querySelectorAll('.btn-tab')).find(btn => {
        const onclickAttr = btn.getAttribute('onclick');
        return onclickAttr && onclickAttr.includes(`'${tabId}'`);
    });
    if (activeNav) activeNav.classList.add('active');

    // ---- Jika pindah ke tab Settings, reload ulang nilai dari appSettings ----
    if (tabId === 'tab-settings') {
        document.getElementById('setting-hpp-limit').value = appSettings.hpp_limit;
        setOverheadType(appSettings.overhead_type);
        if (appSettings.overhead_type === 'nominal') {
            document.getElementById('setting-overhead').value = appSettings.overhead_value.toString();
            formatRupiahInput(document.getElementById('setting-overhead'));
        } else {
            document.getElementById('setting-overhead').value = appSettings.overhead_value.toString();
        }
        updateOverheadStatusBadge();
    }

    // ---- Load data sesuai tab ----
    if (tabId === 'tab-bahan-baku') { bbCurrentPage = 1; loadBahanBaku(); }
    if (tabId === 'tab-input') { loadDropdownBahanBaku('baru'); switchInputSubTab('hpp'); }
    if (tabId === 'tab-direktori' || tabId === 'tab-summary' || tabId === 'tab-dashboard') loadDirektori();
    if (tabId === 'tab-summary') renderTableSummary();
    if (tabId === 'tab-data-penjualan') loadDataPenjualan();
    if (tabId === 'tab-dashboard') {
        // Update engineering setelah loadDirektori selesai
        setTimeout(updateDashboardEngineering, 500);
    }
}

// ==================== FUNGSI BAHAN BAKU ====================
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

// ---------- FUNGSI KATEGORI ----------
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
        const isAlreadyInTarget = currentVal === namaTarget;
        const isChecked = isAlreadyInTarget ? 'checked disabled' : '';
        let badgeHTML = '';
        if (isAlreadyInTarget) {
            badgeHTML = `<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded border border-green-200">Sudah Masuk Kategori Ini</span>`;
        } else if (currentVal !== 'Uncategorized' && currentVal !== '-') {
            badgeHTML = `<span class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200 max-w-[120px] truncate">Saat ini: ${currentVal}</span>`;
        } else {
            badgeHTML = `<span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded border border-gray-300">Uncategorized</span>`;
        }
        listContainer.innerHTML += `
            <label class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl hover:bg-blue-50 cursor-pointer transition-colors ${isAlreadyInTarget ? 'opacity-60' : ''}">
                <div class="flex items-center gap-3">
                    <input type="checkbox" class="assign-checkbox w-5 h-5 text-blue-600 rounded focus:ring-blue-500" value="${menu.id}" data-current="${currentVal}" ${isChecked}>
                    <span class="font-bold text-gray-700">${menu.nama}</span>
                </div>
                ${badgeHTML}
            </label>
        `;
    });
}

function filterAssignMenu() { renderAssignMenuList(); }

async function simpanAssignMenu() {
    if (!hasRole('senior_bar')) return alert('Akses ditolak.');
    const jenis = document.getElementById('assign-target-jenis').value;
    const namaTarget = document.getElementById('assign-target-nama').value;
    const targetField = jenis === 'Kategori' ? 'kategori' : 'sub_kategori';
    const checkboxes = document.querySelectorAll('.assign-checkbox:checked:not(:disabled)');
    let menusToMove = [];
    let conflictMenus = [];
    checkboxes.forEach(cb => {
        const menuId = cb.value;
        const currentVal = cb.getAttribute('data-current');
        const menuData = assignMenuTempData.find(m => m.id == menuId);
        menusToMove.push(menuId);
        if (currentVal !== 'Uncategorized' && currentVal !== '-' && currentVal !== namaTarget) {
            conflictMenus.push(`- ${menuData.nama} (Awalnya: ${currentVal})`);
        }
    });
    if (menusToMove.length === 0) return alert("Tidak ada menu baru yang dipilih untuk dipindahkan.");
    if (conflictMenus.length > 0) {
        let warnText = conflictMenus.slice(0, 10).join('\n');
        if (conflictMenus.length > 10) warnText += `\n... dan ${conflictMenus.length - 10} menu lainnya.`;
        if (!confirm(`Beberapa menu sudah memiliki ${jenis} lain sebelumnya:\n\n${warnText}\n\nYakin ingin menimpanya dan memindahkan mereka ke "${namaTarget}"?`)) return;
    }
    showLoading();
    let updatePayload = {};
    updatePayload[targetField] = namaTarget;
    const { error } = await supabaseClient.from('resep').update(updatePayload).in('id', menusToMove);
    hideLoading();
    if (error) { alert("Gagal memindahkan menu."); } else {
        alert("Update Berhasil! Menu sudah dipindahkan.");
        closeModal('modal-assign-menu');
        loadDirektori();
    }
}

// ---------- DROPDOWN BAHAN BAKU UNTUK RESEP ----------
async function loadDropdownBahanBaku(targetElement) {
    const { data } = await supabaseClient.from('bahan_baku').select('*').order('nama');
    bahanBakuList = data || [];
    const prefix = targetElement === 'edit' ? 'edit-r-' : 'r-';
    const ul = document.getElementById(prefix + 'dropdown-list');
    ul.innerHTML = '';
    if (bahanBakuList.length === 0) {
        ul.innerHTML = '<li class="p-4 text-gray-400 text-sm italic text-center">Belum ada bahan di database</li>';
    } else {
        bahanBakuList.forEach(bb => {
            ul.innerHTML += `<li class="p-3 border-b border-gray-100 cursor-pointer hover:bg-blue-50 text-sm bb-item flex justify-between items-center transition-colors" onclick="pilihBahanBaku('${targetElement}', '${bb.id}', '${bb.nama.replace(/'/g, "\\'")}', ${bb.harga}, '${bb.satuan}')"><div class="font-bold text-gray-700">${bb.nama}</div><div class="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-md">${formatRp(bb.harga)} <span class="text-gray-500 font-normal">/ ${bb.satuan}</span></div></li>`;
        });
    }
}

function bukaDropdownBB(mode) {
    const prefix = mode === 'edit' ? 'edit-r-' : 'r-';
    document.getElementById(prefix + 'dropdown-list').classList.remove('hidden');
    filterDropdownBB(mode);
}

function filterDropdownBB(mode) {
    const prefix = mode === 'edit' ? 'edit-r-' : 'r-';
    const inputVal = document.getElementById(prefix + 'pilih-bb').value.toLowerCase();
    const ul = document.getElementById(prefix + 'dropdown-list');
    const items = ul.getElementsByTagName('li');
    for (let i = 0; i < items.length; i++) {
        if (items[i].classList.contains('bb-item')) {
            const txt = items[i].textContent || items[i].innerText;
            items[i].style.display = txt.toLowerCase().indexOf(inputVal) > -1 ? "" : "none";
        }
    }
}

function pilihBahanBaku(mode, id, nama, harga, satuan) {
    const prefix = mode === 'edit' ? 'edit-r-' : 'r-';
    document.getElementById(prefix + 'pilih-bb').value = nama;
    document.getElementById(prefix + 'bb-selected-id').value = id;
    document.getElementById(prefix + 'bb-selected-nama').value = nama;
    document.getElementById(prefix + 'bb-selected-harga').value = harga;
    document.getElementById(prefix + 'bb-selected-satuan').value = satuan;
    document.getElementById(prefix + 'dropdown-list').classList.add('hidden');
}

// ---------- KOMPOSISI ----------
function addTempKomposisi(mode) {
    const prefix = mode === 'edit' ? 'edit-r-' : 'r-';
    const id = document.getElementById(prefix + 'bb-selected-id').value;
    const nama = document.getElementById(prefix + 'bb-selected-nama').value;
    const harga = parseFloat(document.getElementById(prefix + 'bb-selected-harga').value);
    const satuan = document.getElementById(prefix + 'bb-selected-satuan').value;
    const qty = parseFloat(document.getElementById(prefix + 'qty-bb').value);
    if (!id || !qty) return alert("Pilih bahan dari dropdown dan isi Qty!");
    const dataArr = mode === 'edit' ? tempKomposisiEdit : tempKomposisiBaru;
    if (dataArr.some(item => item.bahan_baku_id == id)) return alert("Bahan sudah masuk daftar!");
    dataArr.push({ bahan_baku_id: id, nama: nama, satuan: satuan, qty: qty, subtotal: harga * qty });
    document.getElementById(prefix + 'pilih-bb').value = '';
    document.getElementById(prefix + 'bb-selected-id').value = '';
    document.getElementById(prefix + 'qty-bb').value = '';
    renderKomposisi(mode);
}

function removeTempKomposisi(mode, index) {
    if (mode === 'edit') tempKomposisiEdit.splice(index, 1);
    else tempKomposisiBaru.splice(index, 1);
    renderKomposisi(mode);
}

function renderKomposisi(mode) {
    const prefix = mode === 'edit' ? 'edit-' : '';
    const dataArr = mode === 'edit' ? tempKomposisiEdit : tempKomposisiBaru;
    const tbody = document.getElementById(prefix + 'temp-komposisi-list');
    tbody.innerHTML = '';
    dataArr.forEach((item, idx) => {
        tbody.innerHTML += `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="p-3 font-semibold text-gray-700">${item.nama}</td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <input type="number" step="any" value="${item.qty}" class="w-20 p-1 border border-gray-300 rounded-lg text-center text-sm outline-none focus:ring-2 focus:ring-blue-400" oninput="directUpdateQtyKomposisi('${mode}', ${idx}, this.value)" />
                        <span class="text-xs font-bold text-gray-400">${item.satuan}</span>
                    </div>
                </td>
                <td class="p-3 text-blue-600 font-bold text-right" id="${prefix}subtotal-cell-${idx}">${formatRp(item.subtotal)}</td>
                <td class="p-3 text-center"><button onclick="removeTempKomposisi('${mode}', ${idx})" class="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors font-bold text-lg leading-none">×</button></td>
            </tr>
        `;
    });
    updateKalkulasiHPP(mode);
}

function directUpdateQtyKomposisi(mode, idx, value) {
    const dataArr = mode === 'edit' ? tempKomposisiEdit : tempKomposisiBaru;
    const currentQty = parseFloat(value) || 0;
    if (dataArr[idx]) {
        const matchingBB = bahanBakuList.find(b => b.id == dataArr[idx].bahan_baku_id);
        const baseHarga = matchingBB ? matchingBB.harga : (dataArr[idx].subtotal / (dataArr[idx].qty || 1));
        dataArr[idx].qty = currentQty;
        dataArr[idx].subtotal = baseHarga * currentQty;
        const prefix = mode === 'edit' ? 'edit-' : '';
        const subtotalCell = document.getElementById(`${prefix}subtotal-cell-${idx}`);
        if (subtotalCell) subtotalCell.innerText = formatRp(dataArr[idx].subtotal);
        updateKalkulasiHPP(mode);
    }
}

// ---------- KALKULASI HPP (TERMASUK OVERHEAD) ----------
function updateKalkulasiHPP(mode) {
    const prefix = mode === 'edit' ? 'edit-r-' : 'r-';
    const dataArr = mode === 'edit' ? tempKomposisiEdit : tempKomposisiBaru;
    const elHargaJual = document.getElementById(prefix + 'harga-jual');
    const elYield = document.getElementById(prefix + 'yield');
    if (elHargaJual && !elHargaJual.hasAttribute('data-bound')) { elHargaJual.addEventListener('input', () => updateKalkulasiHPP(mode)); elHargaJual.setAttribute('data-bound', 'true'); }
    if (elYield && !elYield.hasAttribute('data-bound')) { elYield.addEventListener('input', () => updateKalkulasiHPP(mode)); elYield.setAttribute('data-bound', 'true'); }

    const hargaJual = getNilaiAsli(elHargaJual.value);
    const yieldPorsi = parseFloat(elYield.value) || 1;
    const totalBahanPokok = dataArr.reduce((sum, item) => sum + item.subtotal, 0);
    const costPerPorsiBase = (totalBahanPokok / yieldPorsi);

    // ---- HITUNG OVERHEAD ----
    const overhead = appSettings.overhead_type === 'persen' 
        ? (costPerPorsiBase * (appSettings.overhead_value / 100)) 
        : appSettings.overhead_value;

    const hppPerPorsi = costPerPorsiBase + overhead;
    const marginValue = hargaJual - hppPerPorsi;
    const hppValue = hargaJual > 0 ? (hppPerPorsi / hargaJual) * 100 : 0;

    document.getElementById(prefix + 'total-cost').innerText = formatRp(hppPerPorsi);
    if (mode !== 'edit') document.getElementById(prefix + 'target-jual').innerText = formatRp(hargaJual);

    const elMargin = document.getElementById(prefix + 'margin');
    elMargin.innerText = formatRp(marginValue);
    elMargin.className = marginValue < 0 ? 'font-bold text-red-400' : 'font-bold text-emerald-400';
    const elHPP = document.getElementById(prefix + 'persentase');
    elHPP.innerText = hppValue.toFixed(2) + '%';
    elHPP.className = hppValue > appSettings.hpp_limit ? 'font-black text-lg text-red-500' : 'font-black text-lg text-emerald-400';
}

// ---------- SIMPAN RESEP ----------
async function simpanResepFinal() {
    if (!hasRole('senior_bar')) return alert('Akses ditolak.');
    let nama = document.getElementById('r-nama').value.trim();
    let kategori = document.getElementById('r-kategori').value;
    let sub = document.getElementById('r-sub').value;
    const harga_jual = getNilaiAsli(document.getElementById('r-harga-jual').value);
    const yield_porsi = parseFloat(document.getElementById('r-yield').value) || 1;
    if (!kategori || kategori === '') kategori = 'Uncategorized';
    if (!sub || sub === '') sub = 'Uncategorized';
    if (!nama || tempKomposisiBaru.length === 0) return alert("Lengkapi data menu dan minimal 1 resep bahan!");
    showLoading();
    const { data: resepData, error: resepErr } = await supabaseClient.from('resep').insert([{ nama, kategori, sub_kategori: sub, harga_jual, yield: yield_porsi }]).select();
    if (resepErr) { hideLoading(); return alert("Gagal menyimpan resep baru."); }
    const { error: detailErr } = await supabaseClient.from('resep_detail').insert(tempKomposisiBaru.map(item => ({ resep_id: resepData[0].id, bahan_baku_id: item.bahan_baku_id, qty: item.qty })));
    hideLoading();
    if (!detailErr) {
        alert("Resep Berhasil Disimpan!");
        document.getElementById('r-nama').value = '';
        document.getElementById('r-kategori').value = 'Uncategorized';
        document.getElementById('r-sub').value = 'Uncategorized';
        document.getElementById('r-harga-jual').value = '';
        document.getElementById('r-yield').value = '1';
        tempKomposisiBaru = [];
        renderKomposisi('baru');
        switchTab('tab-direktori');
    }
}

async function duplikasiResepCard(id, namaMenu) {
    if (!hasRole('senior_bar')) return alert('Akses ditolak.');
    if (!confirm(`Apakah Anda yakin ingin menduplikasi resep "${namaMenu}"?`)) return;
    showLoading();
    try {
        const { data: mainResep, error: errResep } = await supabaseClient.from('resep').select('*').eq('id', id).single();
        if (errResep || !mainResep) throw new Error("Gagal mengunduh struktur menu master.");
        const { data: detailResep, error: errDetail } = await supabaseClient.from('resep_detail').select('*').eq('resep_id', id);
        if (errDetail) throw new Error("Gagal mengunduh komposisi bahan resep baku.");
        const cloneNama = `copy - ${mainResep.nama}`;
        const { data: insertedResep, error: errInsert } = await supabaseClient.from('resep').insert([{
            nama: cloneNama,
            kategori: mainResep.kategori,
            sub_kategori: mainResep.sub_kategori,
            harga_jual: mainResep.harga_jual,
            yield: mainResep.yield
        }]).select();
        if (errInsert || !insertedResep) throw new Error("Gagal membuat duplikasi profile resep.");
        if (detailResep && detailResep.length > 0) {
            const batchDetails = detailResep.map(d => ({
                resep_id: insertedResep[0].id,
                bahan_baku_id: d.bahan_baku_id,
                qty: d.qty
            }));
            const { error: errBatch } = await supabaseClient.from('resep_detail').insert(batchDetails);
            if (errBatch) throw new Error("Gagal mengkloning rincian gramasi bahan baku.");
        }
        alert(`Sukses! Berhasil menduplikasi menu "${cloneNama}".`);
        loadDirektori();
    } catch (err) {
        alert(err.message);
    } finally {
        hideLoading();
    }
}

// ---------- LOAD DIREKTORI & SUMMARY ----------
async function loadDirektori() {
    // Pastikan settings selalu terbaru
    await loadAppSettings();

    const { data: bbData } = await supabaseClient.from('bahan_baku').select('*');
    if (bbData) bahanBakuList = bbData;

    const { data, error } = await supabaseClient.from('resep').select(`id, nama, kategori, sub_kategori, harga_jual, yield, resep_detail (qty, bahan_baku_id, bahan_baku (nama, satuan, harga))`);
    if (error) return;

    cachedResepSummaryData = data.map(menu => {
        let totalBiayaBahan = 0, komposisiHTML = '';
        (menu.resep_detail || []).forEach(det => {
            if (det.bahan_baku) {
                totalBiayaBahan += det.qty * det.bahan_baku.harga;
                komposisiHTML += `<li class="flex justify-between items-start text-[15px] py-1.5 border-b border-gray-100 last:border-0"><span class="text-gray-600 font-medium pr-4 break-words w-2/3 leading-snug">- ${det.bahan_baku.nama}</span> <span class="font-bold text-gray-800 whitespace-nowrap text-right w-1/3">${det.qty} ${det.bahan_baku.satuan}</span></li>`;
            }
        });
        const currentYield = menu.yield || 1;
        const costPerPorsiBase = (totalBiayaBahan / currentYield);

        // ---- HITUNG OVERHEAD ----
        const overhead = appSettings.overhead_type === 'persen' 
            ? (costPerPorsiBase * (appSettings.overhead_value / 100)) 
            : appSettings.overhead_value;

        const hppPerPorsi = costPerPorsiBase + overhead;

        return {
            ...menu,
            yield: currentYield,
            totalCost: hppPerPorsi,
            margin: menu.harga_jual - hppPerPorsi,
            hppPersen: menu.harga_jual > 0 ? (hppPerPorsi / menu.harga_jual) * 100 : 0,
            komposisiHTML,
            overhead: overhead,
            overheadType: appSettings.overhead_type,
            overheadValue: appSettings.overhead_value
        };
    });

    renderCatalogDirektori();
    renderTableSummary();
    renderDashboardAnalitika();

    // Update engineering jika tab dashboard aktif
    if (document.getElementById('tab-dashboard').classList.contains('active')) {
        updateDashboardEngineering();
    }
}

// ---------- RENDER DIRECTORY (RECIPE CARD) ----------
function renderCatalogDirektori() {
    let processedData = [...cachedResepSummaryData];
    const searchKey = document.getElementById('search-resep').value.toLowerCase();
    const filterKat = document.getElementById('filter-kategori-direktori').value;
    if (filterKat !== 'all') {
        processedData = processedData.filter(m => m.kategori === filterKat);
    }
    if (searchKey) processedData = processedData.filter(m => m.nama.toLowerCase().includes(searchKey) || (m.kategori && m.kategori.toLowerCase().includes(searchKey)) || (m.sub_kategori && m.sub_kategori.toLowerCase().includes(searchKey)));

    const wrapper = document.getElementById('recipe-wrapper');
    wrapper.innerHTML = '';
    if (processedData.length === 0) { wrapper.innerHTML = `<div class="w-full text-center py-20 text-gray-400 italic">Data resep menu kosong atau tidak ditemukan.</div>`; return; }

    const groupedData = {};
    processedData.forEach(menu => {
        const kat = menu.kategori && menu.kategori !== '-' ? menu.kategori.toUpperCase() : 'UNCATEGORIZED';
        const sub = menu.sub_kategori && menu.sub_kategori !== '-' ? menu.sub_kategori : 'Uncategorized';
        if (!groupedData[kat]) groupedData[kat] = {};
        if (!groupedData[kat][sub]) groupedData[kat][sub] = [];
        groupedData[kat][sub].push(menu);
    });

    const canEdit = hasRole('senior_bar');
    Object.keys(groupedData).sort().forEach(kat => {
        let html = `<div class="mb-12"><h2 class="text-3xl font-black text-gray-800 mb-6 border-b-4 border-blue-600 inline-block pr-8 pb-1 tracking-tight uppercase">${kat}</h2>`;
        Object.keys(groupedData[kat]).sort().forEach(sub => {
            const cardBgColor = getCardGradient(sub);
            html += `<div class="mb-10"><h3 class="text-lg font-bold text-gray-700 mb-5 flex items-center"><span class="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm uppercase tracking-wider border border-blue-200 shadow-sm">${sub}</span></h3><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">`;

            groupedData[kat][sub].forEach(menu => {
                let hppColor = menu.hppPersen > appSettings.hpp_limit ? 'text-red-500' : 'text-emerald-600';
                let marginColor = menu.margin < 0 ? 'text-red-500' : 'text-emerald-600';

                let ovhText = '';
                if (menu.overheadValue > 0) {
                    if (menu.overheadType === 'persen') {
                        ovhText = `<div class="text-xs text-gray-400 mt-0.5">+ Overhead: ${menu.overheadValue}% dari HPP bahan</div>`;
                    } else {
                        ovhText = `<div class="text-xs text-gray-400 mt-0.5">+ Overhead: ${formatRp(menu.overhead)}</div>`;
                    }
                }

                html += `
                    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible relative hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group flex flex-col">
                        ${canEdit ? `<div class="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="toggleKebabMenu(event, 'drop-r-${menu.id}')" class="kebab-btn bg-white/90 backdrop-blur hover:bg-white text-gray-800 w-8 h-8 rounded-lg font-bold shadow-md border border-gray-200">⋮</button>
                            <div id="drop-r-${menu.id}" class="dropdown-menu hidden absolute right-0 mt-1 bg-white shadow-xl rounded-xl border border-gray-100 w-36 py-2 text-sm text-gray-700 z-30">
                                <button onclick="bukaModalEditResep(${JSON.stringify(menu).replace(/"/g, '&quot;')})" class="w-full text-left px-4 py-2 hover:bg-blue-50 font-bold text-blue-600">📝 Edit</button>
                                <button onclick="duplikasiResepCard(${menu.id}, '${menu.nama.replace(/'/g, "\\'")}')" class="w-full text-left px-4 py-2 hover:bg-amber-50 font-bold text-amber-600">📋 Duplicate</button>
                                <button onclick="aksiHapusResep(${menu.id}, '${menu.nama}')" class="w-full text-left px-4 py-2 hover:bg-red-50 font-bold text-red-600 border-t border-gray-100">🗑️ Hapus</button>
                            </div>
                        </div>` : ''}
                        <div class="bg-gradient-to-br ${cardBgColor} text-white p-5 rounded-t-2xl relative">
                            <h3 class="text-xl font-black tracking-wide pr-8 leading-tight break-words">${menu.nama}</h3>
                            <div class="absolute bottom-5 right-5 text-xs font-semibold bg-white/20 px-2 py-1 rounded backdrop-blur">YIELD: ${menu.yield}</div>
                        </div>
                        <div class="p-5 md:p-6 flex-grow flex flex-col">
                            <ul class="mb-5 h-72 md:h-80 overflow-y-auto custom-scrollbar flex-grow pr-2">${menu.komposisiHTML || '<li class="text-sm text-gray-400 italic">Tanpa komposisi</li>'}</ul>
                            <div class="bg-gray-50 p-4 rounded-xl text-[15px] space-y-2 border border-gray-100 mt-auto">
                                <div class="flex justify-between items-center"><span class="text-gray-500 font-medium">Harga Jual:</span><span class="font-bold text-gray-800">${formatRp(menu.harga_jual)}</span></div>
                                <div class="flex justify-between items-start border-t border-gray-200 pt-2">
                                    <span class="text-gray-500 font-medium">HPP / Porsi:</span>
                                    <div class="text-right">
                                        <span class="font-bold text-gray-800 block">${formatRp(menu.totalCost)}</span>
                                        ${ovhText}
                                    </div>
                                </div>
                                <div class="flex justify-between items-center border-t border-gray-200 pt-2"><span class="text-gray-500 font-medium">Margin:</span><span class="font-bold ${marginColor}">${formatRp(menu.margin)}</span></div>
                                <div class="flex justify-between items-center"><span class="text-gray-500 font-medium">% HPP:</span><span class="font-black text-lg ${hppColor}">${menu.hppPersen.toFixed(2)}%</span></div>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `</div></div>`;
        });
        html += `</div>`;
        wrapper.innerHTML += html;
    });
}

// ---------- SUMMARY TABLE ----------
function renderTableSummary() {
    const tbody = document.getElementById('table-summary-body');
    if (!tbody) return;

    let sData = [...cachedResepSummaryData];
    const searchVal = document.getElementById('search-summary').value.toLowerCase();
    const filterKat = document.getElementById('filter-summary-kat').value;
    if (searchVal) sData = sData.filter(m => m.nama.toLowerCase().includes(searchVal));
    if (filterKat !== 'all') sData = sData.filter(m => m.kategori === filterKat);

    sData.sort((a, b) => {
        let valA = a[summarySortKey] !== undefined ? a[summarySortKey] : '';
        let valB = b[summarySortKey] !== undefined ? b[summarySortKey] : '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return summarySortAsc ? -1 : 1;
        if (valA > valB) return summarySortAsc ? 1 : -1;
        return 0;
    });

    tbody.innerHTML = '';
    if (sData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center p-8 text-gray-400 italic">Tidak ada resep data summary.</td></tr>`;
        return;
    }

    const canEditResep = hasRole('senior_bar');

    const thCheckbox = document.getElementById('th-checkbox-summary');
    const btnMassal = document.getElementById('btn-delete-massal');
    if (thCheckbox) {
        if (canEditResep) thCheckbox.classList.remove('hidden');
        else thCheckbox.classList.add('hidden');
    }
    if (btnMassal) {
        if (canEditResep) btnMassal.classList.remove('hidden');
        else btnMassal.classList.add('hidden');
    }

    sData.forEach(m => {
        let textHppColor = m.hppPersen > appSettings.hpp_limit ? 'text-red-600 font-black' : 'text-emerald-600 font-bold';
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';

        let html = '';
        if (canEditResep) {
            html += `<td class="p-4 w-8 text-center"><input type="checkbox" class="summary-checkbox rounded border-gray-300 text-blue-600 focus:ring-blue-400" value="${m.id}" /></td>`;
        }
        html += `
            <td class="p-4 font-bold text-gray-800">${m.nama}</td>
            <td class="p-4 text-gray-600 text-xs font-semibold"><span class="bg-gray-100 border px-2 py-1 rounded-md">${m.kategori}</span></td>
            <td class="p-4 text-gray-500 text-xs">${m.sub_kategori}</td>
            <td class="p-4 text-right font-semibold text-gray-700">${formatRp(m.harga_jual)}</td>
            <td class="p-4 text-right font-semibold text-blue-600">${formatRp(m.totalCost)}</td>
            <td class="p-4 text-center ${textHppColor}">${m.hppPersen.toFixed(1)}%</td>
            <td class="p-4 text-right font-bold ${m.margin < 0 ? 'text-red-500':'text-emerald-600'}">${formatRp(m.margin)}</td>
        `;
        html += `<td class="p-4 text-center"><div class="relative inline-block">`;
        if (canEditResep) {
            html += `
                <button onclick="toggleKebabMenu(event, 'drop-summary-${m.id}')" class="kebab-btn bg-white hover:bg-gray-200 text-gray-600 w-8 h-8 rounded-lg font-bold shadow-sm border border-gray-200 transition-colors">⋮</button>
                <div id="drop-summary-${m.id}" class="dropdown-menu hidden absolute right-10 top-0 mt-1 bg-white shadow-xl rounded-xl border border-gray-100 w-36 py-2 text-sm text-gray-700 z-[70] overflow-hidden">
                    <button onclick="infoResepCard(${m.id})" class="w-full block text-left px-4 py-2 hover:bg-blue-50 font-bold text-blue-600">ℹ️ Info</button>
                    <button onclick="bukaModalEditResep(${JSON.stringify(m).replace(/"/g, '&quot;')})" class="w-full block text-left px-4 py-2 hover:bg-blue-50 font-bold text-blue-600 border-t border-gray-100">📝 Edit</button>
                    <button onclick="aksiHapusResep(${m.id}, '${m.nama}')" class="w-full block text-left px-4 py-2 hover:bg-red-50 font-bold text-red-600 border-t border-gray-100 mt-1">🗑️ Hapus</button>
                </div>
            `;
        } else {
            html += `
                <button onclick="toggleKebabMenu(event, 'drop-summary-${m.id}')" class="kebab-btn bg-white hover:bg-gray-200 text-gray-600 w-8 h-8 rounded-lg font-bold shadow-sm border border-gray-200 transition-colors">⋮</button>
                <div id="drop-summary-${m.id}" class="dropdown-menu hidden absolute right-10 top-0 mt-1 bg-white shadow-xl rounded-xl border border-gray-100 w-36 py-2 text-sm text-gray-700 z-[70] overflow-hidden">
                    <button onclick="infoResepCard(${m.id})" class="w-full block text-left px-4 py-2 hover:bg-blue-50 font-bold text-blue-600">ℹ️ Info</button>
                </div>
            `;
        }
        html += `</div></td>`;
        row.innerHTML = html;
        tbody.appendChild(row);
    });

    document.querySelectorAll('#summary-table .sortable').forEach(th => {
        const key = th.dataset.sort;
        const icon = th.querySelector('.sort-icon');
        if (key === summarySortKey) {
            icon.textContent = summarySortAsc ? '▲' : '▼';
        } else {
            icon.textContent = '▽';
        }
    });

    const selectAll = document.getElementById('select-all-summary');
    if (selectAll) selectAll.checked = false;
}

function infoResepCard(id) {
    const menu = cachedResepSummaryData.find(m => m.id === id);
    if (!menu) return alert('Data tidak ditemukan');
    document.getElementById('info-resep-nama').innerText = menu.nama;
    let ovhText = '';
    if (menu.overheadValue > 0) {
        ovhText = menu.overheadType === 'persen' 
            ? `<p><strong>Overhead:</strong> ${menu.overheadValue}% dari HPP bahan</p>` 
            : `<p><strong>Overhead:</strong> ${formatRp(menu.overhead)}</p>`;
    }
    let detailHtml = `
        <p><strong>Kategori:</strong> ${menu.kategori}</p>
        <p><strong>Sub Kategori:</strong> ${menu.sub_kategori}</p>
        <p><strong>Harga Jual:</strong> ${formatRp(menu.harga_jual)}</p>
        <p><strong>Yield (Porsi):</strong> ${menu.yield}</p>
        <p><strong>HPP / Porsi:</strong> ${formatRp(menu.totalCost)}</p>
        ${ovhText}
        <p><strong>Margin:</strong> ${formatRp(menu.margin)}</p>
        <p><strong>% HPP:</strong> ${menu.hppPersen.toFixed(1)}%</p>
        <hr class="my-3" />
        <p class="font-bold">Komposisi Bahan:</p>
        <ul class="list-disc pl-5 space-y-1">${menu.komposisiHTML || '<li class="text-gray-400 italic">Tidak ada</li>'}</ul>
    `;
    document.getElementById('info-resep-detail').innerHTML = detailHtml;
    document.getElementById('modal-info-resep').classList.remove('hidden');
}

function toggleSelectAllSummary() {
    const checked = document.getElementById('select-all-summary').checked;
    document.querySelectorAll('.summary-checkbox').forEach(cb => cb.checked = checked);
}

async function hapusMassalResep() {
    if (!hasRole('senior_bar')) return alert('Akses ditolak.');
    const checkboxes = document.querySelectorAll('.summary-checkbox:checked');
    if (checkboxes.length === 0) return alert('Pilih minimal satu menu yang akan dihapus.');
    const ids = Array.from(checkboxes).map(cb => cb.value);
    const namaMenus = ids.map(id => {
        const menu = cachedResepSummaryData.find(m => m.id == id);
        return menu ? menu.nama : id;
    }).join('\n- ');
    if (!confirm(`Anda yakin akan menghapus ${ids.length} menu berikut?\n- ${namaMenus}\n\nTindakan ini tidak dapat dibatalkan.`)) return;
    showLoading();
    const { error } = await supabaseClient.from('resep').delete().in('id', ids);
    hideLoading();
    if (error) {
        alert('Gagal menghapus beberapa menu. Mungkin ada yang terkait dengan data lain.');
    } else {
        alert('Berhasil menghapus menu terpilih.');
        loadDirektori();
    }
}

// ---------- DASHBOARD ----------
function renderDashboardAnalitika() {
    if (!document.getElementById('dash-total-menu')) return;

    const countMenu = cachedResepSummaryData.length;
    const countBB = bahanBakuList.length;

    let totalSumHpp = 0, criticalCount = 0;
    cachedResepSummaryData.forEach(m => {
        totalSumHpp += m.hppPersen;
        if (m.hppPersen > appSettings.hpp_limit) criticalCount++;
    });

    const avgHpp = countMenu > 0 ? (totalSumHpp / countMenu) : 0;

    document.getElementById('dash-total-menu').innerText = countMenu;
    document.getElementById('dash-total-bb').innerText = countBB;
    document.getElementById('dash-avg-hpp').innerText = avgHpp.toFixed(1) + '%';
    document.getElementById('dash-alert-hpp').innerText = criticalCount;

    const topMarginBody = document.getElementById('dash-top-margin');
    let marginSorted = [...cachedResepSummaryData].sort((a, b) => b.margin - a.margin).slice(0, 5);
    topMarginBody.innerHTML = '';
    if (marginSorted.length === 0) topMarginBody.innerHTML = `<tr><td class="text-center p-4 italic text-gray-400">Data menu belum siap.</td></tr>`;
    marginSorted.forEach(m => {
        topMarginBody.innerHTML += `
            <tr class="py-2 flex justify-between items-center text-sm">
                <td class="font-bold text-gray-700">${m.nama}</td>
                <td class="font-black text-emerald-600 text-right">${formatRp(m.margin)} <span class="text-xs font-normal text-gray-400">profit</span></td>
            </tr>
        `;
    });

    const criticalBody = document.getElementById('dash-critical-hpp');
    let criticalSorted = cachedResepSummaryData.filter(m => m.hppPersen > appSettings.hpp_limit).sort((a, b) => b.hppPersen - a.hppPersen);
    criticalBody.innerHTML = '';
    if (criticalSorted.length === 0) {
        criticalBody.innerHTML = `<tr><td class="p-4 text-center text-xs text-emerald-600 font-bold bg-emerald-50 rounded-xl border border-emerald-100">✨ Selamat! Seluruh resep terkendali aman di bawah threshold ${appSettings.hpp_limit}%.</td></tr>`;
    } else {
        criticalSorted.forEach(m => {
            criticalBody.innerHTML += `
                <tr class="py-2 flex justify-between items-center text-sm">
                    <td class="font-bold text-gray-700">${m.nama}</td>
                    <td class="font-black text-red-600 text-right">${m.hppPersen.toFixed(1)}% <span class="text-xs font-normal text-gray-400">HPP</span></td>
                </tr>
            `;
        });
    }
}

// ---------- AKSI HAPUS RESEP ----------
async function aksiHapusResep(id, nama) {
    if (!hasRole('senior_bar')) return alert('Akses ditolak.');
    if (confirm(`Yakin hapus resep "${nama}"?`)) {
        showLoading();
        await supabaseClient.from('resep').delete().eq('id', id);
        hideLoading();
        loadDirektori();
    }
}

// ---------- EDIT RESEP ----------
async function bukaModalEditResep(menuObj) {
    if (!hasRole('senior_bar')) return alert('Akses ditolak.');
    await loadDropdownBahanBaku('edit');
    document.getElementById('edit-r-pilih-bb').value = '';
    document.getElementById('edit-r-bb-selected-id').value = '';
    document.getElementById('edit-r-qty-bb').value = '';
    document.getElementById('edit-r-id').value = menuObj.id;
    document.getElementById('edit-r-nama').value = menuObj.nama;
    document.getElementById('edit-r-kategori').value = menuObj.kategori || 'Uncategorized';
    document.getElementById('edit-r-sub').value = menuObj.sub_kategori || 'Uncategorized';
    document.getElementById('edit-r-harga-jual').value = menuObj.harga_jual.toString();
    formatRupiahInput(document.getElementById('edit-r-harga-jual'));
    document.getElementById('edit-r-yield').value = menuObj.yield || 1;
    tempKomposisiEdit = menuObj.resep_detail.map(det => {
        if (!det.bahan_baku) return null;
        return { bahan_baku_id: det.bahan_baku_id, nama: det.bahan_baku.nama, satuan: det.bahan_baku.satuan, qty: det.qty, subtotal: det.qty * det.bahan_baku.harga };
    }).filter(item => item !== null);
    renderKomposisi('edit');
    document.getElementById('modal-edit-resep').classList.remove('hidden');
}

async function simpanEditResep() {
    if (!hasRole('senior_bar')) return alert('Akses ditolak.');
    const resepId = document.getElementById('edit-r-id').value;
    const nama = document.getElementById('edit-r-nama').value.trim();
    let kategori = document.getElementById('edit-r-kategori').value;
    let sub = document.getElementById('edit-r-sub').value;
    const harga_jual = getNilaiAsli(document.getElementById('edit-r-harga-jual').value);
    const yield_porsi = parseFloat(document.getElementById('edit-r-yield').value) || 1;
    if (!kategori || kategori === '') kategori = 'Uncategorized';
    if (!sub || sub === '') sub = 'Uncategorized';
    if (!nama || tempKomposisiEdit.length === 0) return alert("Nama dan komposisi wajib diisi!");
    showLoading();
    await supabaseClient.from('resep').update({ nama, kategori, sub_kategori: sub, harga_jual, yield: yield_porsi }).eq('id', resepId);
    await supabaseClient.from('resep_detail').delete().eq('resep_id', resepId);
    await supabaseClient.from('resep_detail').insert(tempKomposisiEdit.map(item => ({ resep_id: resepId, bahan_baku_id: item.bahan_baku_id, qty: item.qty })));
    hideLoading();
    closeModal('modal-edit-resep');
    loadDirektori();
}

// ---------- IMPORT / EXPORT ----------
function initiateImport(event, type) {
    fileImportTertunda = event.target.files[0];
    if (!fileImportTertunda) return;
    jenisImportTertunda = type;
    document.getElementById('modal-import-option').classList.remove('hidden');
}

function batalImport() {
    fileImportTertunda = null;
    jenisImportTertunda = '';
    document.getElementById('import-bb-file').value = '';
    document.getElementById('import-resep-file').value = '';
    if (document.getElementById('import-kat-file')) document.getElementById('import-kat-file').value = '';
    closeModal('modal-import-option');
}

function jalankanImport(mode) {
    closeModal('modal-import-option');
    showLoading();
    if (jenisImportTertunda === 'bb') eksekusiImportBahanBaku(mode);
    else if (jenisImportTertunda === 'resep') eksekusiImportResep(mode);
    else eksekusiImportKategori(mode);
}

function downloadTemplateBahanBaku() {
    const ws = XLSX.utils.json_to_sheet([{ "Nama Bahan": "Susu UHT", "Satuan Beli": "Karton", "Harga Beli": 240000, "Nilai Konversi (Yield)": 12000, "Satuan Pemakaian Resep": "ml" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Bahan_Baku.xlsx");
}

function exportBahanBakuToExcel() {
    const ws = XLSX.utils.json_to_sheet(bahanBakuList.map(i => ({ "ID": i.id, "Nama Bahan": i.nama, "Satuan Beli": i.satuan_beli, "Harga Beli": i.harga_beli, "Konversi": i.nilai_konversi, "Satuan Resep": i.satuan, "Harga per Satuan": i.harga })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, "BahanBaku_Export.xlsx");
}

function eksekusiImportBahanBaku(mode) {
    if (!hasRole('admin')) { hideLoading(); alert('Akses ditolak.'); batalImport(); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const rows = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).Sheets[XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).SheetNames[0]]);
            const cleanData = rows.map(r => {
                const h = parseFloat(r["Harga Beli"] || 0);
                const k = parseFloat(r["Nilai Konversi (Yield)"] || 1);
                return { nama: String(r["Nama Bahan"]).trim(), satuan_beli: r["Satuan Beli"], harga_beli: h, nilai_konversi: k, satuan: r["Satuan Pemakaian Resep"], harga: h / k };
            }).filter(r => r.nama && r.nama !== "undefined");
            if (cleanData.length === 0) { hideLoading(); alert("Data kosong!"); batalImport(); return; }
            let successCount = 0;
            let failCount = 0;
            if (mode === 'replace') {
                const { error: delError } = await supabaseClient.from('bahan_baku').delete().neq('id', 0);
                if (delError && delError.code === '23503') { hideLoading(); alert("GAGAL: Bahan baku sedang dipakai di Resep."); batalImport(); return; }
                const { error: insError } = await supabaseClient.from('bahan_baku').insert(cleanData);
                if (insError) { failCount = cleanData.length; } else { successCount = cleanData.length; }
            } else {
                const { data: ext } = await supabaseClient.from('bahan_baku').select('*');
                const nMap = {};
                ext.forEach(i => nMap[i.nama.toLowerCase()] = i.id);
                for (let r of cleanData) {
                    const eId = nMap[r.nama.toLowerCase()];
                    if (eId) {
                        const { error } = await supabaseClient.from('bahan_baku').update(r).eq('id', eId);
                        if (error) failCount++;
                        else successCount++;
                    } else {
                        const { error } = await supabaseClient.from('bahan_baku').insert([r]);
                        if (error) failCount++;
                        else successCount++;
                    }
                }
            }
            hideLoading();
            loadBahanBaku();
            batalImport();
            showSummaryModal(failCount === 0, 'Import Bahan Baku Selesai', successCount, failCount);
        } catch (err) {
            hideLoading();
            alert("Terjadi kesalahan sistem saat membaca Excel.");
            batalImport();
        }
    };
    reader.readAsArrayBuffer(fileImportTertunda);
}

function downloadTemplateKategori() {
    const ws = XLSX.utils.json_to_sheet([{ "Nama": "Coffee Series", "Jenis": "Kategori" }, { "Nama": "Espresso Based", "Jenis": "Sub-Kategori" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Kategori");
    XLSX.writeFile(wb, "Template_Kategori_Master.xlsx");
}

function exportKategoriToExcel() {
    const listGabung = [
        ...listKategori.map(k => ({ "ID": k.id, "Nama": k.nama, "Jenis": "Kategori" })),
        ...listSubKategori.map(s => ({ "ID": s.id, "Nama": s.nama, "Jenis": "Sub-Kategori" }))
    ];
    const ws = XLSX.utils.json_to_sheet(listGabung);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kategori_DB");
    XLSX.writeFile(wb, "Kategori_Export.xlsx");
}

function eksekusiImportKategori(mode) {
    if (!hasRole('senior_bar')) { hideLoading(); alert('Akses ditolak.'); batalImport(); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const rows = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).Sheets[XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).SheetNames[0]]);
            const cleanData = rows.map(r => ({ nama: String(r["Nama"] || "").trim(), jenis: String(r["Jenis"] || "").trim() })).filter(r => r.nama && (r.jenis === 'Kategori' || r.jenis === 'Sub-Kategori'));
            if (cleanData.length === 0) { hideLoading(); alert("Data Excel kosong / tidak valid!"); batalImport(); return; }
            if (mode === 'replace') await supabaseClient.from('kategori_db').delete().neq('id', 0);
            let successCount = 0;
            let failCount = 0;
            const { data: ext } = await supabaseClient.from('kategori_db').select('*');
            const mapCheck = {};
            ext.forEach(x => mapCheck[`${x.nama.toLowerCase()}-${x.jenis.toLowerCase()}`] = x.id);
            for (let r of cleanData) {
                const uniqueKey = `${r.nama.toLowerCase()}-${r.jenis.toLowerCase()}`;
                if (mapCheck[uniqueKey]) {
                    successCount++;
                } else {
                    const { error } = await supabaseClient.from('kategori_db').insert([r]);
                    if (error) failCount++;
                    else successCount++;
                }
            }
            hideLoading();
            batalImport();
            await loadKategoriDB();
            showSummaryModal(failCount === 0, 'Import Kategori Master Selesai', successCount, failCount);
        } catch (err) {
            hideLoading();
            alert("Gagal mengolah file kategori.");
            batalImport();
        }
    };
    reader.readAsArrayBuffer(fileImportTertunda);
}

function downloadTemplateResep() {
    const ws = XLSX.utils.json_to_sheet([{ "Nama Menu": "Iced Choco Banana", "Kategori": "Beverage", "Sub Kategori": "Non-Coffee", "Harga Jual": 28000, "Yield (Porsi)": 1, "Nama Bahan Baku": "Fresh Milk UHT", "Qty": 160 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Resep.xlsx");
}

async function exportResepToExcel() {
    const { data } = await supabaseClient.from('resep').select(`nama,kategori,sub_kategori,harga_jual,yield,resep_detail(qty,bahan_baku(nama,satuan,harga))`);
    let rec = [];
    data.forEach(m => m.resep_detail.forEach(d => rec.push({ "Menu": m.nama, "Kategori": m.kategori, "Sub Kategori": m.sub_kategori, "Harga Jual": m.harga_jual, "Yield (Porsi)": m.yield || 1, "Nama Bahan Baku": d.bahan_baku?.nama, "Qty": d.qty, "Satuan": d.bahan_baku?.satuan, "Biaya Total": d.qty * (d.bahan_baku?.harga || 0) })));
    const ws = XLSX.utils.json_to_sheet(rec);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resep");
    XLSX.writeFile(wb, "Resep_Export.xlsx");
}

function eksekusiImportResep(mode) {
    if (!hasRole('senior_bar')) { hideLoading(); alert('Akses ditolak.'); batalImport(); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const rows = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).Sheets[XLSX.read(new Uint8Array(e.target.result), { type: 'array' }).SheetNames[0]]);
            if (rows.length === 0) { hideLoading(); alert("Data Excel kosong!"); batalImport(); return; }
            if (mode === 'replace') await supabaseClient.from('resep').delete().neq('id', 0);
            const { data: bbData } = await supabaseClient.from('bahan_baku').select('*');
            const bbMap = {};
            bbData.forEach(b => bbMap[b.nama.toLowerCase().trim()] = b.id);
            let grp = {};
            rows.forEach(r => {
                const m = r["Menu"] || r["Nama Menu"];
                if (!m) return;
                if (!grp[m]) grp[m] = { nama: m, kategori: r["Kategori"] || "Uncategorized", sub_kategori: r["Sub Kategori"] || "Uncategorized", harga_jual: parseFloat(r["Harga Jual"] || 0), yield_porsi: parseFloat(r["Yield (Porsi)"] || 1), ing: [] };
                const mId = bbMap[String(r["Nama Bahan Baku"] || r["Bahan"] || "").toLowerCase().trim()];
                if (mId) grp[m].ing.push({ bahan_baku_id: mId, qty: parseFloat(r["Qty"] || 0) });
            });
            let successCount = 0;
            let failCount = 0;
            for (let k in grp) {
                if (grp[k].ing.length === 0) { failCount++; continue; }
                let rId;
                let hasError = false;
                if (mode === 'modify') {
                    const { data: cR } = await supabaseClient.from('resep').select('id').eq('nama', grp[k].nama).single();
                    if (cR) {
                        rId = cR.id;
                        await supabaseClient.from('resep').update({ kategori: grp[k].kategori, sub_kategori: grp[k].sub_kategori, harga_jual: grp[k].harga_jual, yield: grp[k].yield_porsi }).eq('id', rId);
                        await supabaseClient.from('resep_detail').delete().eq('resep_id', rId);
                    }
                }
                if (!rId) {
                    const { data: nR, error: resepErr } = await supabaseClient.from('resep').insert([{ nama: grp[k].nama, kategori: grp[k].kategori, sub_kategori: grp[k].sub_kategori, harga_jual: grp[k].harga_jual, yield: grp[k].yield_porsi }]).select();
                    if (resepErr) { hasError = true; } else { rId = nR[0].id; }
                }
                if (rId && !hasError) {
                    const { error: detailErr } = await supabaseClient.from('resep_detail').insert(grp[k].ing.map(i => ({ resep_id: rId, bahan_baku_id: i.bahan_baku_id, qty: i.qty })));
                    if (detailErr) hasError = true;
                }
                if (hasError) failCount++;
                else successCount++;
            }
            hideLoading();
            batalImport();
            loadDirektori();
            showSummaryModal(failCount === 0, 'Import Resep Selesai', successCount, failCount);
        } catch (err) {
            hideLoading();
            alert("Terjadi kesalahan saat mengelola resep!");
            batalImport();
        }
    };
    reader.readAsArrayBuffer(fileImportTertunda);
}

// ==================== FUNGSI PENJUALAN ====================

// Inisialisasi dropdown bulan dan tahun
function initBulanTahunDropdowns() {
    const bulanSelects = ['jual-bulan', 'filter-data-bulan', 'dash-filter-bulan'];
    const bulanNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    bulanSelects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '<option value="">Pilih Bulan</option>';
        bulanNames.forEach((name, i) => {
            el.innerHTML += `<option value="${i+1}">${name}</option>`;
        });
        // Set default untuk jual-bulan ke bulan berjalan
        if (id === 'jual-bulan') {
            el.value = new Date().getMonth() + 1;
        }
    });

    const tahunSelects = ['jual-tahun', 'filter-data-tahun', 'dash-filter-tahun'];
    const currentYear = new Date().getFullYear();
    const years = Array.from({length: 10}, (_, i) => currentYear - i);
    tahunSelects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '<option value="">Pilih Tahun</option>';
        years.forEach(y => {
            el.innerHTML += `<option value="${y}">${y}</option>`;
        });
        if (id === 'jual-tahun' || id === 'dash-filter-tahun') el.value = currentYear;
    });
}

// Load daftar menu untuk dropdown penjualan
async function loadMenuDropdownPenjualan() {
    const { data, error } = await supabaseClient.from('resep').select('id, nama, harga_jual').order('nama');
    if (error) return;
    const selects = ['jual-menu', 'filter-data-menu'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = id === 'filter-data-menu' ? '<option value="all">Semua Menu</option>' : '<option value="">-- Pilih Menu --</option>';
        data.forEach(m => {
            el.innerHTML += `<option value="${m.id}" data-harga="${m.harga_jual}">${m.nama}</option>`;
        });
    });
    // Event listener untuk isi otomatis harga jual
    const jualMenu = document.getElementById('jual-menu');
    if (jualMenu) {
        jualMenu.addEventListener('change', function() {
            const harga = this.options[this.selectedIndex]?.dataset?.harga || 0;
            const inputHarga = document.getElementById('jual-harga');
            if (inputHarga) {
                inputHarga.value = harga ? new Intl.NumberFormat('id-ID').format(harga) : '';
            }
        });
        // Trigger sekali saat load
        const harga = jualMenu.options[jualMenu.selectedIndex]?.dataset?.harga || 0;
        const inputHarga = document.getElementById('jual-harga');
        if (inputHarga) {
            inputHarga.value = harga ? new Intl.NumberFormat('id-ID').format(harga) : '';
        }
    }
}

// Simpan penjualan
async function simpanPenjualan() {
    if (!hasRole('senior_bar')) return alert('Akses ditolak.');
    const resepId = document.getElementById('jual-menu').value;
    const bulan = parseInt(document.getElementById('jual-bulan').value);
    const tahun = parseInt(document.getElementById('jual-tahun').value);
    const qty = parseInt(document.getElementById('jual-qty').value);
    const hargaJual = getNilaiAsli(document.getElementById('jual-harga').value);

    if (!resepId || !bulan || !tahun || !qty || !hargaJual) {
        return alert('Lengkapi semua data penjualan!');
    }

    showLoading();
    const { error } = await supabaseClient.from('penjualan').insert([
        { resep_id: resepId, bulan, tahun, qty, harga_jual: hargaJual }
    ]);
    hideLoading();

    if (error) {
        alert('Gagal menyimpan penjualan: ' + error.message);
    } else {
        alert('Data penjualan berhasil disimpan!');
        document.getElementById('jual-qty').value = '';
        loadDataPenjualan();
    }
}

// Load data penjualan ke tabel
async function loadDataPenjualan() {
    const bulan = document.getElementById('filter-data-bulan').value;
    const tahun = document.getElementById('filter-data-tahun').value;
    const menuId = document.getElementById('filter-data-menu').value;

    let query = supabaseClient
        .from('penjualan')
        .select(`
            id,
            bulan,
            tahun,
            qty,
            harga_jual,
            resep:resep_id (id, nama, kategori, sub_kategori, harga_jual as harga_jual_resep)
        `);

    if (bulan && bulan !== 'all') query = query.eq('bulan', parseInt(bulan));
    if (tahun && tahun !== 'all') query = query.eq('tahun', parseInt(tahun));
    if (menuId && menuId !== 'all') query = query.eq('resep_id', parseInt(menuId));

    const { data, error } = await query.order('tahun', { ascending: false }).order('bulan', { ascending: false });
    if (error) {
        console.error('Error load penjualan:', error);
        return;
    }

    const tbody = document.getElementById('table-penjualan-body');
    tbody.innerHTML = '';
    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center p-8 text-gray-400 italic">Tidak ada data penjualan.</td></tr>`;
        return;
    }

    const canDelete = hasRole('senior_bar');
    const thCheck = document.querySelector('#table-penjualan thead th:first-child');
    if (thCheck) {
        if (canDelete) thCheck.classList.remove('hidden');
        else thCheck.classList.add('hidden');
    }

    data.forEach(row => {
        const menu = row.resep;
        const total = row.qty * row.harga_jual;
        const bulanName = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][row.bulan - 1] || row.bulan;

        let html = '<tr class="hover:bg-gray-50 transition-colors">';
        if (canDelete) {
            html += `<td class="p-4 w-8 text-center"><input type="checkbox" class="penjualan-checkbox rounded border-gray-300 text-blue-600 focus:ring-blue-400" value="${row.id}" /></td>`;
        }
        html += `
            <td class="p-4 font-bold text-gray-800">${menu?.nama || 'Menu dihapus'}</td>
            <td class="p-4 text-gray-600">${menu?.kategori || '-'}</td>
            <td class="p-4">${bulanName}</td>
            <td class="p-4">${row.tahun}</td>
            <td class="p-4 text-right font-semibold">${row.qty}</td>
            <td class="p-4 text-right font-semibold text-blue-600">${formatRp(row.harga_jual)}</td>
            <td class="p-4 text-right font-bold text-gray-800">${formatRp(total)}</td>
            <td class="p-4 text-center">
        `;
        if (canDelete) {
            html += `<button onclick="hapusPenjualan(${row.id})" class="text-red-500 hover:text-red-700 font-bold text-lg">✕</button>`;
        } else {
            html += `<span class="text-gray-300">-</span>`;
        }
        html += `</td></tr>`;
        tbody.innerHTML += html;
    });

    const btnMassal = document.querySelector('[onclick="hapusPenjualanTerpilih()"]');
    if (btnMassal) {
        if (canDelete) btnMassal.classList.remove('hidden');
        else btnMassal.classList.add('hidden');
    }
}

// Hapus satu penjualan
async function hapusPenjualan(id) {
    if (!hasRole('senior_bar')) return alert('Akses ditolak.');
    if (!confirm('Hapus data penjualan ini?')) return;
    showLoading();
    const { error } = await supabaseClient.from('penjualan').delete().eq('id', id);
    hideLoading();
    if (error) alert('Gagal hapus.');
    else loadDataPenjualan();
}

// Hapus massal
async function hapusPenjualanTerpilih() {
    if (!hasRole('senior_bar')) return alert('Akses ditolak.');
    const checkboxes = document.querySelectorAll('.penjualan-checkbox:checked');
    if (checkboxes.length === 0) return alert('Pilih data yang akan dihapus.');
    const ids = Array.from(checkboxes).map(cb => cb.value);
    if (!confirm(`Hapus ${ids.length} data penjualan?`)) return;
    showLoading();
    const { error } = await supabaseClient.from('penjualan').delete().in('id', ids);
    hideLoading();
    if (error) alert('Gagal hapus massal.');
    else loadDataPenjualan();
}

function toggleSelectAllPenjualan() {
    const checked = document.getElementById('select-all-penjualan').checked;
    document.querySelectorAll('.penjualan-checkbox').forEach(cb => cb.checked = checked);
}

// ==================== DASHBOARD ENGINEERING ====================

async function updateDashboardEngineering() {
    const bulan = document.getElementById('dash-filter-bulan').value;
    const tahun = document.getElementById('dash-filter-tahun').value;

    if (!bulan || !tahun) {
        document.getElementById('dash-engineering-container').innerHTML = '<p class="text-gray-400 text-center py-10">Pilih bulan dan tahun untuk melihat data engineering.</p>';
        return;
    }

    // Ambil semua penjualan untuk bulan/tahun terpilih
    const { data: penjualanData, error } = await supabaseClient
        .from('penjualan')
        .select('resep_id, qty, harga_jual')
        .eq('bulan', parseInt(bulan))
        .eq('tahun', parseInt(tahun));

    if (error) {
        console.error('Error ambil penjualan:', error);
        return;
    }

    // Kelompokkan per menu
    const salesMap = {};
    penjualanData.forEach(p => {
        if (!salesMap[p.resep_id]) salesMap[p.resep_id] = { qty: 0, totalHarga: 0 };
        salesMap[p.resep_id].qty += p.qty;
        salesMap[p.resep_id].totalHarga += p.qty * p.harga_jual;
    });

    const menus = cachedResepSummaryData;

    // Buat container per kategori
    const kategoriMap = {};
    menus.forEach(menu => {
        const kat = menu.kategori || 'Uncategorized';
        if (!kategoriMap[kat]) kategoriMap[kat] = [];
        kategoriMap[kat].push(menu);
    });

    // Hitung rata-rata penjualan per kategori (hanya untuk menu yang terjual)
    const avgSalesPerKat = {};
    Object.keys(kategoriMap).forEach(kat => {
        const menusInKat = kategoriMap[kat];
        const totalQty = menusInKat.reduce((sum, m) => sum + (salesMap[m.id]?.qty || 0), 0);
        const countSold = menusInKat.filter(m => salesMap[m.id] && salesMap[m.id].qty > 0).length;
        avgSalesPerKat[kat] = countSold > 0 ? totalQty / countSold : 0;
    });

    // Tampilkan
    const container = document.getElementById('dash-engineering-container');
    container.innerHTML = '';

    if (Object.keys(kategoriMap).length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center py-10">Belum ada kategori.</p>';
        return;
    }

    // Loop kategori
    Object.keys(kategoriMap).sort().forEach(kat => {
        const menusInKat = kategoriMap[kat];
        const avg = avgSalesPerKat[kat] || 0;

        let html = `<div class="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 class="font-bold text-lg text-gray-800 mb-3 flex items-center gap-2">
                <span class="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">${kat}</span>
                <span class="text-sm font-normal text-gray-500">Rata-rata penjualan: ${avg.toFixed(1)} porsi</span>
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        `;

        menusInKat.forEach(menu => {
            const sales = salesMap[menu.id];
            const qty = sales?.qty || 0;
            const isEngineering = (qty < avg * 0.5) && avg > 0;
            const totalRevenue = sales?.totalHarga || 0;

            html += `
                <div class="bg-white p-4 rounded-xl shadow-sm border ${isEngineering ? 'border-red-300 bg-red-50' : 'border-gray-100'}">
                    <div class="flex justify-between items-start">
                        <span class="font-bold text-gray-700">${menu.nama}</span>
                        ${isEngineering ? '<span class="text-xs font-bold bg-red-500 text-white px-2 py-0.5 rounded-full">🔧 Engineering</span>' : ''}
                    </div>
                    <div class="mt-2 space-y-1 text-sm">
                        <div class="flex justify-between"><span class="text-gray-500">Qty Terjual</span><span class="font-bold">${qty}</span></div>
                        <div class="flex justify-between"><span class="text-gray-500">Total Revenue</span><span class="font-bold">${formatRp(totalRevenue)}</span></div>
                        <div class="flex justify-between"><span class="text-gray-500">Margin / Porsi</span><span class="font-bold ${menu.margin < 0 ? 'text-red-600' : 'text-emerald-600'}">${formatRp(menu.margin)}</span></div>
                        <div class="flex justify-between"><span class="text-gray-500">% HPP</span><span class="font-bold ${menu.hppPersen > appSettings.hpp_limit ? 'text-red-500' : 'text-emerald-600'}">${menu.hppPersen.toFixed(1)}%</span></div>
                    </div>
                </div>
            `;
        });

        html += `</div></div>`;
        container.innerHTML += html;
    });
}

// ==================== SWITCH SUBTAB INPUT ====================

function switchInputSubTab(tab) {
    const hpp = document.getElementById('subtab-hpp');
    const penjualan = document.getElementById('subtab-penjualan');
    const btnHpp = document.getElementById('subtab-hpp-btn');
    const btnPenjualan = document.getElementById('subtab-penjualan-btn');

    if (tab === 'hpp') {
        hpp.classList.remove('hidden');
        penjualan.classList.add('hidden');
        btnHpp.className = 'bg-white/30 backdrop-blur border border-white/30 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-white/30 transition-colors';
        btnPenjualan.className = 'bg-white/20 backdrop-blur border border-white/30 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-white/30 transition-colors';
    } else {
        hpp.classList.add('hidden');
        penjualan.classList.remove('hidden');
        btnPenjualan.className = 'bg-white/30 backdrop-blur border border-white/30 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-white/30 transition-colors';
        btnHpp.className = 'bg-white/20 backdrop-blur border border-white/30 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-white/30 transition-colors';
        loadMenuDropdownPenjualan();
    }
}

// ---------- EVENT LISTENER ----------
document.addEventListener('click', function(e) {
    const th = e.target.closest('.sortable');
    if (th && th.closest('#summary-table')) {
        const key = th.dataset.sort;
        if (key) {
            if (summarySortKey === key) {
                summarySortAsc = !summarySortAsc;
            } else {
                summarySortKey = key;
                summarySortAsc = true;
            }
            renderTableSummary();
        }
    }
});

document.addEventListener('click', function(e) {
    if (!e.target.closest('.kebab-btn') && !e.target.closest('[onclick*="toggleKebabMenu"]')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
    }
});

// ---------- ON LOAD ----------
window.onload = async () => {
    await inisialisasiAuth();
    await loadKategoriDB();
};
