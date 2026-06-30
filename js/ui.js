import { currentUser, appSettings, currentTheme } from './config.js';
import { hasRole, getCurrentUser, logoutAdmin } from './auth.js';
import { loadBahanBaku, renderTabelBahanBaku } from './bahanBaku.js';
import { loadKategoriDB, renderTabelManajemenKategori } from './kategori.js';
import { loadDirektori, renderTableSummary } from './resep.js';
import { loadDataPenjualan, renderTablePenjualanInput, initBulanTahunDropdowns, loadMenuDropdownPenjualan, populateKategoriFilterPenjualan } from './penjualan.js';
import { populateDiscountDropdowns } from './discount.js';
import { updateDashboardEngineering } from './dashboard.js';

// ===== UI HELPERS =====
export function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

export function showToast(message, type = 'success') {
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

export function showLoading() { 
    document.getElementById('loading-overlay').classList.remove('hidden'); 
}

export function hideLoading() { 
    document.getElementById('loading-overlay').classList.add('hidden'); 
}

export function showSummaryModal(isSuccess, title, successCount, failCount) {
    document.getElementById('summary-icon').innerText = isSuccess ? '✅' : '⚠️';
    document.getElementById('summary-title').innerText = title;
    document.getElementById('summary-success').innerText = successCount;
    document.getElementById('summary-fail').innerText = failCount;
    document.getElementById('modal-summary').classList.remove('hidden');
}

export function showLoginScreen() {
    document.getElementById('login-overlay').classList.remove('hidden');
    document.getElementById('login-overlay').style.opacity = '1';
    document.getElementById('app-wrapper').classList.add('hidden');
}

export function hideLoginScreen() {
    document.getElementById('login-overlay').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('app-wrapper').classList.remove('hidden');
    }, 300);
}

// ===== TOGGLE MOBILE MENU =====
export function toggleMobileMenu() {
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

// ===== TOGGLE KEBBAB MENU =====
export function toggleKebabMenu(event, menuId) {
    event.stopPropagation();
    const targetMenu = document.getElementById(menuId);
    const isHidden = targetMenu.classList.contains('hidden');
    document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
    if (isHidden) targetMenu.classList.remove('hidden');
}

// ===== SWITCH TAB =====
export function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
        el.classList.add('hidden');
    });
    const target = document.getElementById(tabId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
    currentActiveTab = tabId;
    try { sessionStorage.setItem('activeTab', tabId); } catch(e) {}

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
        loadTheme();
    }
    if (tabId === 'tab-bahan-baku') { bbCurrentPage = 1; loadBahanBaku(); }
    if (tabId === 'tab-hpp') { loadDropdownBahanBaku('baru'); }
    if (tabId === 'tab-direktori' || tabId === 'tab-hpp' || tabId === 'tab-dashboard') loadDirektori();
    if (tabId === 'tab-hpp') renderTableSummary();
    if (tabId === 'tab-data-penjualan') {
        loadDataPenjualan();
        renderTablePenjualanInput();
    }
    if (tabId === 'tab-dashboard') {
        setTimeout(updateDashboardEngineering, 500);
    }
    if (tabId === 'tab-discount-calculator') {
        populateDiscountDropdowns();
    }
}

// ===== UPDATE UI BY ROLE =====
export function updateUIByRole() {
    const isLoggedIn = !!currentUser;
    const role = currentUser?.role || 'guest';
    const allTabs = ['tab-dashboard', 'tab-direktori', 'tab-hpp', 'tab-bahan-baku', 'tab-kategori', 'tab-data-penjualan', 'tab-discount-calculator', 'tab-settings'];
    const tabMap = {
        staff: ['tab-dashboard', 'tab-direktori', 'tab-hpp', 'tab-settings'],
        admin: ['tab-dashboard', 'tab-direktori', 'tab-hpp', 'tab-bahan-baku', 'tab-settings'],
        senior_bar: ['tab-dashboard', 'tab-direktori', 'tab-hpp', 'tab-bahan-baku', 'tab-kategori', 'tab-data-penjualan', 'tab-discount-calculator', 'tab-settings'],
        head_bar: ['tab-dashboard', 'tab-direktori', 'tab-hpp', 'tab-bahan-baku', 'tab-kategori', 'tab-data-penjualan', 'tab-discount-calculator', 'tab-settings']
    };
    const allowed = tabMap[role] || tabMap.staff;
    const homeTab = 'tab-direktori';
    const activeTab = allowed.includes(homeTab) ? homeTab : allowed[0];
    currentActiveTab = activeTab;
    
    allTabs.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); el.classList.remove('active'); }
    });
    allowed.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('hidden'); }
    });
    const firstEl = document.getElementById(activeTab);
    if (firstEl) { firstEl.classList.add('active'); }

    // Mobile menu
    const mobileMenuList = document.getElementById('mobile-menu-list');
    mobileMenuList.innerHTML = '';
    const statusDiv = document.createElement('div');
    statusDiv.className = 'flex flex-col gap-3 pb-5 mb-3 border-b border-gray-100 dark:border-gray-700';
    const statusSpan = document.createElement('span');
    statusSpan.className = 'text-sm font-bold text-[#FF3B30] bg-[#FF3B30]/10 border border-[#FF3B30]/20 px-3 py-2 rounded-lg text-center shadow-inner';
    statusSpan.innerText = isLoggedIn ? `🌟 ${role.toUpperCase()} (${currentUser.email})` : '👤 Guest';
    statusDiv.appendChild(statusSpan);
    if (isLoggedIn) {
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'bg-[#FF3B30] text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:shadow-lg transition-shadow text-center';
        logoutBtn.innerText = 'Logout Admin';
        logoutBtn.onclick = () => { toggleMobileMenu(); logoutAdmin(); };
        statusDiv.appendChild(logoutBtn);
    }
    mobileMenuList.appendChild(statusDiv);

    const tabNames = {
        'tab-dashboard': '📈 Dashboard',
        'tab-direktori': '📑 Directory Menu',
        'tab-hpp': '📊 HPP & Summary',
        'tab-bahan-baku': '📦 Bahan Baku',
        'tab-kategori': '🏷️ Kategori',
        'tab-data-penjualan': '📋 Data Penjualan',
        'tab-discount-calculator': '🧮 Discount Calculator',
        'tab-settings': '⚙️ Settings'
    };
    allowed.forEach(id => {
        const btn = document.createElement('button');
        btn.className = `btn-tab-mobile text-gray-600 dark:text-gray-300 font-semibold text-left py-3 px-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${id === activeTab ? 'bg-blue-50 dark:bg-blue-900/20 text-[#FF3B30] font-bold' : ''}`;
        btn.innerText = tabNames[id] || id;
        btn.onclick = () => { switchTab(id); toggleMobileMenu(); };
        mobileMenuList.appendChild(btn);
    });

    document.querySelectorAll('.role-admin').forEach(el => el.classList.toggle('hidden', !hasRole('admin')));
    document.querySelectorAll('.role-senior').forEach(el => el.classList.toggle('hidden', !hasRole('senior_bar')));
    document.querySelectorAll('.role-head').forEach(el => el.classList.toggle('hidden', !hasRole('head_bar')));

    const msg = document.getElementById('settings-readonly-msg');
    if (msg) {
        if (isLoggedIn && !hasRole('head_bar')) {
            msg.classList.remove('hidden');
        } else {
            msg.classList.add('hidden');
        }
    }

    document.getElementById('setting-hpp-limit').value = appSettings.hpp_limit;
    setOverheadType(appSettings.overhead_type);
    if (appSettings.overhead_type === 'nominal') {
        document.getElementById('setting-overhead').value = appSettings.overhead_value.toString();
        formatRupiahInput(document.getElementById('setting-overhead'));
    } else {
        document.getElementById('setting-overhead').value = appSettings.overhead_value.toString();
    }
    updateOverheadStatusBadge();

    initBulanTahunDropdowns();
    loadMenuDropdownPenjualan();
    populateKategoriFilterPenjualan();
    populateDiscountDropdowns();
    loadKategoriDB();

    const savedTab = sessionStorage.getItem('activeTab');
    if (savedTab && allowed.includes(savedTab)) {
        switchTab(savedTab);
    } else {
        switchTab(activeTab);
    }

    if (document.getElementById('tab-bahan-baku').classList.contains('active')) {
        bbCurrentPage = 1;
        loadBahanBaku();
    }
    if (document.getElementById('tab-hpp').classList.contains('active')) {
        loadDropdownBahanBaku('baru');
    }
    loadDirektori();
}

// ===== LOAD APP SETTINGS =====
export async function loadAppSettings() {
    const { getSupabase } = await import('./config.js');
    const supabase = getSupabase();
    try {
        const { data, error } = await supabase.from('app_settings').select('key, value');
        if (error) return;
        const map = {};
        data.forEach(row => { map[row.key] = row.value; });
        appSettings.hpp_limit = parseFloat(map.hpp_limit) || 35;
        appSettings.overhead_type = map.overhead_type || 'nominal';
        appSettings.overhead_value = parseFloat(map.overhead_value) || 0;
    } catch (e) {}
}

// ===== THEME =====
export function loadTheme() {
    let theme = 'auto';
    try { theme = localStorage.getItem('preferred-theme') || 'auto'; } catch(e) {}
    applyTheme(theme);
    const btnMap = { light: 0, dark: 1, auto: 2 };
    const btns = document.querySelectorAll('.theme-btn');
    if (btns[btnMap[theme]]) {
        const btn = btns[btnMap[theme]];
        btn.classList.remove('bg-white', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300', 'border-gray-300', 'dark:border-gray-600');
        btn.classList.add('bg-[#FF3B30]', 'text-white', 'border-[#FF3B30]');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (currentTheme === 'auto') applyTheme('auto');
    });
}

export function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.classList.toggle('dark', prefersDark);
        currentTheme = 'auto';
        const status = document.getElementById('theme-status');
        if (status) status.innerHTML = `Tema aktif: <span class="font-bold text-[#FF3B30]">Otomatis (${prefersDark ? 'Gelap' : 'Terang'})</span>`;
    } else if (theme === 'dark') {
        html.classList.add('dark');
        currentTheme = 'dark';
        const status = document.getElementById('theme-status');
        if (status) status.innerHTML = `Tema aktif: <span class="font-bold text-[#FF3B30]">Gelap</span>`;
    } else {
        html.classList.remove('dark');
        currentTheme = 'light';
        const status = document.getElementById('theme-status');
        if (status) status.innerHTML = `Tema aktif: <span class="font-bold text-[#FF3B30]">Terang</span>`;
    }
    try { localStorage.setItem('preferred-theme', theme); } catch(e) {}
}

export function setTheme(theme) {
    applyTheme(theme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('bg-[#FF3B30]', 'text-white', 'border-[#FF3B30]');
        btn.classList.add('bg-white', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300', 'border-gray-300', 'dark:border-gray-600');
    });
    const btnMap = { light: 0, dark: 1, auto: 2 };
    const btns = document.querySelectorAll('.theme-btn');
    if (btns[btnMap[theme]]) {
        const btn = btns[btnMap[theme]];
        btn.classList.remove('bg-white', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-300', 'border-gray-300', 'dark:border-gray-600');
        btn.classList.add('bg-[#FF3B30]', 'text-white', 'border-[#FF3B30]');
    }
}

// ===== OVERHEAD UI =====
export function toggleOverheadInputStyle() {
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

export function setOverheadType(type) {
    document.getElementById('setting-overhead-type').value = type;
    toggleOverheadInputStyle();
}

export function updateOverheadStatusBadge() {
    const badge = document.getElementById('overhead-status-badge');
    if (!badge) return;
    if (appSettings.overhead_value > 0) {
        const display = appSettings.overhead_type === 'persen'
            ? `${appSettings.overhead_value}% / porsi`
            : `${formatRp(appSettings.overhead_value)} / porsi`;
        badge.innerHTML = `✅ Tersimpan: ${display}`;
        badge.className = 'text-xs font-bold px-3 py-1.5 rounded-full border bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 shadow-sm whitespace-nowrap';
    } else {
        badge.innerHTML = `⚪ Belum diatur`;
        badge.className = 'text-xs font-bold px-3 py-1.5 rounded-full border bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 shadow-sm whitespace-nowrap';
    }
}

export function handleOverheadInputFormatting(element) {
    const type = document.getElementById('setting-overhead-type').value;
    if (type === 'nominal') formatRupiahInput(element);
}
