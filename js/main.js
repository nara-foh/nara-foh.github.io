// main.js
import { initSupabase, currentUser, currentActiveTab, bahanBakuList, listKategori, listSubKategori, cachedResepSummaryData } from './config.js';
import { inisialisasiAuth, loginAdmin, logoutAdmin } from './auth.js';
import { loadTheme, updateUIByRole, switchTab, toggleMobileMenu } from './ui.js';
import { loadKategoriDB } from './kategori.js';
import { loadBahanBaku } from './bahanBaku.js';
import { loadDirektori } from './resep.js';
import { loadDataPenjualan } from './penjualan.js';

// Expose functions to window for HTML onclick handlers
window.loginAdmin = loginAdmin;
window.logoutAdmin = logoutAdmin;
window.switchTab = switchTab;
window.toggleMobileMenu = toggleMobileMenu;

export async function initApp() {
    initSupabase();
    loadTheme();
    await inisialisasiAuth();
    await loadKategoriDB();
    await loadBahanBaku();

    const bulanNow = new Date().getMonth() + 1;
    const tahunNow = new Date().getFullYear();
    const bulanFilter = document.getElementById('filter-data-bulan');
    const tahunFilter = document.getElementById('filter-data-tahun');
    if (bulanFilter) bulanFilter.value = bulanNow;
    if (tahunFilter) tahunFilter.value = tahunNow;

    const savedTab = sessionStorage.getItem('activeTab');
    if (savedTab && document.getElementById(savedTab)) {
        // akan di-handle di updateUIByRole
    }

    // Event listener untuk click di luar dropdown
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.kebab-btn') && !e.target.closest('[onclick*="toggleKebabMenu"]')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.add('hidden'));
        }
    });

    // Event listener untuk sort pada summary table
    document.addEventListener('click', async function(e) {  // <--- tambahkan async
        const th = e.target.closest('.sortable');
        if (th && th.closest('#summary-table')) {
            const key = th.dataset.sort;
            if (key) {
                const { summarySortKey, summarySortAsc } = await import('./config.js');
                const { renderTableSummary } = await import('./resep.js');
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

    // Event listener untuk sort pada discount table
    document.addEventListener('click', async function(e) {  // <--- tambahkan async
        const th = e.target.closest('.sortable-disc');
        if (th && th.closest('#discount-table')) {
            const key = th.dataset.sort;
            if (key) {
                const { discountSortKey, discountSortAsc } = await import('./config.js');
                const { renderDiscountTable } = await import('./discount.js');
                if (discountSortKey === key) {
                    discountSortAsc = !discountSortAsc;
                } else {
                    discountSortKey = key;
                    discountSortAsc = true;
                }
                renderDiscountTable();
            }
        }
    });

    // Logo sebagai link ke home
    const brandLink = document.getElementById('brand-link');
    if (brandLink) {
        brandLink.addEventListener('click', function(e) {
            if (document.getElementById('login-overlay').classList.contains('hidden') === false) return;
            switchTab('tab-direktori');
            const mobileMenuList = document.getElementById('mobile-menu-list');
            if (mobileMenuList) {
                const btns = mobileMenuList.querySelectorAll('.btn-tab-mobile');
                btns.forEach(btn => {
                    btn.classList.remove('bg-blue-50', 'dark:bg-blue-900/20', 'text-[#FF3B30]', 'font-bold');
                    if (btn.innerText.includes('Directory Menu')) {
                        btn.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'text-[#FF3B30]', 'font-bold');
                    }
                });
            }
            const mobileMenu = document.getElementById('mobile-menu');
            if (!mobileMenu.classList.contains('translate-x-full')) {
                toggleMobileMenu();
            }
        });
    }

    // Mencegah refresh saat kembali ke tab
    window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
            const savedTab = sessionStorage.getItem('activeTab');
            if (savedTab && document.getElementById(savedTab)) {
                switchTab(savedTab);
            }
            const savedScroll = sessionStorage.getItem('scrollPosition');
            if (savedScroll) {
                window.scrollTo(0, parseInt(savedScroll));
            }
        }
    });

    window.addEventListener('pagehide', function() {
        try {
            sessionStorage.setItem('scrollPosition', window.scrollY.toString());
        } catch(e) {}
    });
}

// Auto-init if not called from index
document.addEventListener('DOMContentLoaded', function() {
    if (window.initApp) {
        window.initApp();
    }
});
