const SUPABASE_URL = 'https://mslsgobvzzxxkwfvpjhx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbHNnb2J2enp4eGt3ZnZwamh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzAzMDEsImV4cCI6MjA5NzgwNjMwMX0.V7pUmC3En3O0pc3VamJUm9eq7cnB7UFLi333LmtnJqQ';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let bahanBakuList = [], tempKomposisiBaru = [], tempKomposisiEdit = [];
let listKategori = [], listSubKategori = [];
let assignMenuTempData = [];
let fileImportTertunda = null, jenisImportTertunda = '';
let bbCurrentPage = 1, bbItemsPerPage = 10;
let adminAktif = null;
let bbSortKey = 'nama', bbSortOrder = 'asc';
let summarySortKey = 'nama';
let summarySortAsc = true;
let cachedResepSummaryData = [];
let hppLimitThreshold = parseFloat(localStorage.getItem('fnb_hpp_limit')) || 35;
let overheadCost = parseFloat(localStorage.getItem('fnb_overhead')) || 0;
let overheadType = localStorage.getItem('fnb_overhead_type') || 'nominal';

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
    document.getElementById('summary-icon').innerText = isSuccess ? 'âœ…' : 'âš ï¸';
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

async function inisialisasiAuth() {
    document.getElementById('setting-hpp-limit').value = hppLimitThreshold;
    document.getElementById('setting-overhead-type').value = overheadType;
    toggleOverheadInputStyle();
    if (overheadType === 'nominal') {
        document.getElementById('setting-overhead').value = overheadCost.toString();
        formatRupiahInput(document.getElementById('setting-overhead'));
    } else {
        document.getElementById('setting-overhead').value = overheadCost.toString();
    }
    const { data: { session } } = await supabaseClient.auth.getSession();
    adminAktif = session?.user || null;
    renderAuthUI();
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        adminAktif = session?.user || null;
        renderAuthUI();
    });
}

function renderAuthUI() {
    const elAdmins = document.querySelectorAll('.admin-only');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const userStatus = document.getElementById('user-status');
    const btnLoginMobile = document.getElementById('btn-login-mobile');
    const btnLogoutMobile = document.getElementById('btn-logout-mobile');
    const userStatusMobile = document.getElementById('user-status-mobile');

    if (adminAktif) {
        elAdmins.forEach(el => el.classList.remove('hidden'));
        btnLogin.classList.add('hidden');
        btnLogout.classList.remove('hidden');
        btnLoginMobile.classList.add('hidden');
        btnLogoutMobile.classList.remove('hidden');
        userStatus.innerHTML = "ðŸŒŸ Admin Area";
        userStatus.classList.replace('text-gray-500', 'text-blue-600');
        userStatus.classList.replace('bg-gray-100', 'bg-blue-50');
        userStatusMobile.innerHTML = "ðŸŒŸ Admin Area";
        userStatusMobile.classList.replace('text-gray-500', 'text-blue-600');
        userStatusMobile.classList.replace('bg-gray-100', 'bg-blue-50');
    } else {
        elAdmins.forEach(el => el.classList.add('hidden'));
        btnLogin.classList.remove('hidden');
        btnLogout.classList.add('hidden');
        btnLoginMobile.classList.remove('hidden');
        btnLogoutMobile.classList.add('hidden');
        userStatus.innerHTML = "ðŸ‘¤ Guest";
        userStatus.classList.replace('text-blue-600', 'text-gray-500');
        userStatus.classList.replace('bg-blue-50', 'bg-gray-100');
        userStatusMobile.innerHTML = "ðŸ‘¤ Guest (View Only)";
        userStatusMobile.classList.replace('text-blue-600', 'text-gray-500');
        userStatusMobile.classList.replace('bg-blue-50', 'bg-gray-100');
        const activeTabEl = document.querySelector('.tab-content.active');
        if (activeTabEl && ['tab-bahan-baku', 'tab-input-hpp', 'tab-kategori', 'tab-settings', 'tab-dashboard'].includes(activeTabEl.id)) {
            switchTab('tab-direktori');
        }
    }
    if (document.getElementById('tab-summary').classList.contains('active')) {
        renderTableSummary();
    }
}

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
        window.location.reload();
    }
}

async function logoutAdmin() {
    const confirmLogout = confirm("Apakah Anda yakin ingin keluar dari sistem?");
    if (!confirmLogout) return;
    showLoading();
    await supabaseClient.auth.signOut();
    hideLoading();
    window.location.reload();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active', 'hidden'));
    document.querySelectorAll('.tab-content').forEach(el => {
        if (el.id !== tabId) el.classList.add('hidden');
    });
    document.querySelectorAll('.btn-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.btn-tab-mobile').forEach(el => {
        el.classList.remove('bg-blue-50', 'text-blue-700', 'font-bold');
        el.classList.add('text-gray-600', 'font-semibold');
    });
    document.getElementById(tabId).classList.add('active');
    document.getElementById(tabId).classList.remove('hidden');
    document.getElementById('btn-' + tabId).classList.add('active');
    const mobileBtn = document.getElementById('btn-' + tabId + '-mobile');
    if (mobileBtn) {
        mobileBtn.classList.remove('text-gray-600', 'font-semibold');
        mobileBtn.classList.add('bg-blue-50', 'text-blue-700', 'font-bold');
    }
    if (tabId === 'tab-bahan-baku') { bbCurrentPage = 1; loadBahanBaku(); }
    if (tabId === 'tab-input-hpp') loadDropdownBahanBaku('baru');
    if (tabId === 'tab-direktori' || tabId === 'tab-summary' || tabId === 'tab-dashboard') loadDirektori();
    if (tabId === 'tab-summary') renderTableSummary();
}

function simpanSettings() {
    const limitVal = parseFloat(document.getElementById('setting-hpp-limit').value);
    const ovhType = document.getElementById('setting-overhead-type').value;
    const inputOvh = document.getElementById('setting-overhead').value;
    const overheadVal = ovhType === 'nominal' ? getNilaiAsli(inputOvh) : (parseFloat(inputOvh) || 0);

    if (limitVal > 0 && limitVal <= 100) {
        hppLimitThreshold = limitVal;
        overheadCost = overheadVal;
        overheadType = ovhType;
        localStorage.setItem('fnb_hpp_limit', limitVal);
        localStorage.setItem('fnb_overhead', overheadVal);
        localStorage.setItem('fnb_overhead_type', ovhType);
        alert('Pengaturan preferensi berhasil diperbarui!');
        loadDirektori();
    } else {
        alert('Masukkan angka persentase hpp limit yang valid (1-100)');
    }
}

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

    const generateHTML = (list, jenis) => {
        if (list.length === 0) return `<li class="text-sm text-gray-400 italic p-3 text-center border border-dashed rounded-lg">Belum ada data</li>`;
        return list.map(k => `
            <li class="flex justify-between items-center bg-gray-50 border border-gray-100 p-3 rounded-lg relative hover:bg-white transition-colors">
                <span class="font-semibold text-gray-700 truncate pr-4">${k.nama}</span>
                <div class="relative">
                    <button onclick="toggleKebabMenu(event, 'drop-kat-${k.id}')" class="bg-white hover:bg-gray-200 text-gray-600 w-8 h-8 rounded-lg font-bold shadow-sm border border-gray-200 transition-colors">â‹®</button>
                    <div id="drop-kat-${k.id}" class="dropdown-menu hidden absolute right-0 mt-1 bg-white shadow-xl rounded-xl border border-gray-100 w-44 py-2 text-sm text-gray-700 z-50 overflow-hidden">
                        <button onclick="bukaModalFormKategori('${jenis}', 'edit', ${k.id}, '${k.nama.replace(/'/g, "\\'")}')" class="w-full text-left px-4 py-2 hover:bg-blue-50 font-bold text-blue-600">ðŸ“ Edit Nama</button>
                        <button onclick="bukaModalAssignMenu('${jenis}', '${k.nama.replace(/'/g, "\\'")}')" class="w-full text-left px-4 py-2 hover:bg-green-50 font-bold text-green-600 border-b border-gray-100">âž• Tambahkan Menu</button>
                        <button onclick="hapusKategoriManajemen(${k.id}, '${jenis}', '${k.nama.replace(/'/g, "\\'")}')" class="w-full text-left px-4 py-2 hover:bg-red-50 font-bold text-red-600 mt-1">ðŸ—‘ï¸ Hapus Master</button>
                    </div>
                </div>
            </li>
        `).join('');
    };
    ulKat.innerHTML = generateHTML(listKategori, 'Kategori');
    ulSub.innerHTML = generateHTML(listSubKategori, 'Sub-Kategori');
}

function bukaModalFormKategori(jenis, mode, id = null, oldName = '') {
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
            tbody.innerHTML += `<tr class="border-b border-gray-100 hover:bg-blue-50/30 transition-colors relative"><td class="p-4 font-bold text-gray-700 truncate max-w-xs border-r">${item.nama}</td><td class="p-3 border-l text-gray-500 bg-gray-50/50">${item.satuan_beli || '-'}</td><td class="p-3 border-r font-semibold text-gray-700 bg-gray-50/50">${item.harga_beli ? formatRp(item.harga_beli) : '-'}</td><td class="p-3 text-gray-500">${item.nilai_konversi || 1} ${item.satuan}</td><td class="p-3 text-blue-700 font-black">${formatRp(item.harga)} <span class="text-xs text-gray-400 font-normal">/ ${item.satuan}</span></td><td class="p-3 text-center border-l admin-only ${adminAktif ? '' : 'hidden'}"><button onclick="toggleKebabMenu(event, 'drop-bb-${item.id}')" class="bg-gray-100 hover:bg-gray-200 text-gray-600 w-8 h-8 rounded-lg font-bold transition-colors">â‹®</button><div id="drop-bb-${item.id}" class="dropdown-menu hidden absolute right-12 mt-1 bg-white shadow-xl rounded-xl border border-gray-100 w-32 py-2 z-20"><button onclick="bukaModalEditBB(${JSON.stringify(item).replace(/"/g, '&quot;')})" class="w-full text-left px-4 py-2 hover:bg-blue-50 font-semibold text-blue-600">ðŸ“ Edit</button><button onclick="aksiHapusBahanBaku(${item.id}, '${item.nama}')" class="w-full text-left px-4 py-2 hover:bg-red-50 font-semibold text-red-600">ðŸ—‘ï¸ Hapus</button></div></td></tr>`;
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
    renderAuthUI();
}

async function tambahBahanBaku() {
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
                <td class="p-3 text-center"><button onclick="removeTempKomposisi('${mode}', ${idx})" class="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors font-bold text-lg leading-none">Ã—</button></td>
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
    const hitungOverheadValue = overheadType === 'persen' ? (costPerPorsiBase * (overheadCost / 100)) : overheadCost;
    const hppPerPorsi = costPerPorsiBase + hitungOverheadValue;
    const marginValue = hargaJual - hppPerPorsi;
    const hppValue = hargaJual > 0 ? (hppPerPorsi / hargaJual) * 100 : 0;

    document.getElementById(prefix + 'total-cost').innerText = formatRp(hppPerPorsi);
    if (mode !== 'edit') document.getElementById(prefix + 'target-jual').innerText = formatRp(hargaJual);

    const elMargin = document.getElementById(prefix + 'margin');
    elMargin.innerText = formatRp(marginValue);
    elMargin.className = marginValue < 0 ? 'font-bold text-red-400' : 'font-bold text-emerald-400';
    const elHPP = document.getElementById(prefix + 'persentase');
    elHPP.innerText = hppValue.toFixed(2) + '%';
    elHPP.className = hppValue > hppLimitThreshold ? 'font-black text-lg text-red-500' : 'font-black text-lg text-emerald-400';
}

async function simpanResepFinal() {
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

async function loadDirektori() {
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
        const hitungOverheadValue = overheadType === 'persen' ? (costPerPorsiBase * (overheadCost / 100)) : overheadCost;
        const hppPerPorsi = costPerPorsiBase + hitungOverheadValue;
        return {
            ...menu,
            yield: currentYield,
            totalCost: hppPerPorsi,
            margin: menu.harga_jual - hppPerPorsi,
            hppPersen: menu.harga_jual > 0 ? (hppPerPorsi / menu.harga_jual) * 100 : 0,
            komposisiHTML
        };
    });

    renderCatalogDirektori();
    renderTableSummary();
    renderDashboardAnalitika();
}

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

    Object.keys(groupedData).sort().forEach(kat => {
        let html = `<div class="mb-12"><h2 class="text-3xl font-black text-gray-800 mb-6 border-b-4 border-blue-600 inline-block pr-8 pb-1 tracking-tight uppercase">${kat}</h2>`;
        Object.keys(groupedData[kat]).sort().forEach(sub => {
            const cardBgColor = getCardGradient(sub);
            html += `<div class="mb-10"><h3 class="text-lg font-bold text-gray-700 mb-5 flex items-center"><span class="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm uppercase tracking-wider border border-blue-200 shadow-sm">${sub}</span></h3><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">`;

            groupedData[kat][sub].forEach(menu => {
                let hppColor = menu.hppPersen > hppLimitThreshold ? 'text-red-500' : 'text-emerald-600';
                let marginColor = menu.margin < 0 ? 'text-red-500' : 'text-emerald-600';
                let ovhText = overheadCost > 0 ? `<div class="text-xs text-gray-400 mt-0.5">+ Overhead: ${overheadType === 'persen' ? overheadCost + '%' : formatRp(overheadCost)}</div>` : '';

                html += `
                    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-visible relative hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group flex flex-col">
                        <div class="absolute top-3 right-3 z-20 admin-only ${adminAktif ? '' : 'hidden'}">
                            <button onclick="toggleKebabMenu(event, 'drop-r-${menu.id}')" class="kebab-btn bg-white hover:bg-gray-100 text-gray-800 w-9 h-9 rounded-lg font-bold text-lg shadow-md border border-gray-200 flex items-center justify-center">â‹®</button>
                            <div id="drop-r-${menu.id}" class="dropdown-menu hidden absolute right-full top-0 mr-2 bg-white shadow-xl rounded-xl border border-gray-100 w-36 py-2 text-sm text-gray-700 z-50">
                                <button onclick="bukaModalEditResep(${JSON.stringify(menu).replace(/"/g, '&quot;')})" class="w-full text-left px-4 py-2 hover:bg-blue-50 font-bold text-blue-600">ðŸ“ Edit</button>
                                <button onclick="duplikasiResepCard(${menu.id}, '${menu.nama.replace(/'/g, "\\'")}')" class="w-full text-left px-4 py-2 hover:bg-amber-50 font-bold text-amber-600">ðŸ“‹ Duplicate</button>
                                <button onclick="aksiHapusResep(${menu.id}, '${menu.nama}')" class="w-full text-left px-4 py-2 hover:bg-red-50 font-bold text-red-600 border-t border-gray-100">ðŸ—‘ï¸ Hapus</button>
                            </div>
                        </div>
                        <div class="bg-gradient-to-br ${cardBgColor} text-white p-5 rounded-t-2xl relative">
                            <h3 class="text-xl font-black tracking-wide pr-8 leading-tight break-words">${menu.nama}</h3>
                            <div class="absolute bottom-5 right-5 text-xs font-semibold bg-white/20 px-2 py-1 rounded backdrop-blur">YIELD: ${menu.yield}</div>
                        </div>
                        <div class="p-5 md:p-6 flex-grow flex flex-col">
                            <ul class="mb-5 h-72 md:h-80 overflow-y-auto custom-scrollbar flex-grow pr-2">${menu.komposisiHTML || '<li class="text-sm text-gray-400 italic">Tanpa komposisi</li>'}</ul>
                            <div class="bg-gray-50 p-4 rounded-xl text-[15px] space-y-2 border border-gray-100 mt-auto">
                                <div class="flex justify-between items-center"><span class="text-gray-500 font-medium">Harga Jual:</span><span class="font-bold text-gray-800">${formatRp(menu.harga_jual)}</span></div>
                                <div class="flex justify-between items-start border-t border-gray-200 pt-2"><span class="text-gray-500 font-medium">HPP / Porsi:</span><div class="text-right"><span class="font-bold text-gray-800 block">${formatRp(menu.totalCost)}</span>${ovhText}</div></div>
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
    renderAuthUI();
}

// ==================== SUMMARY HPP (DENGAN CHECKBOX & AKSI DINAMIS) ======================
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

    const isAdmin = adminAktif !== null;

    const thCheckbox = document.getElementById('th-checkbox-summary');
    const btnMassal = document.getElementById('btn-delete-massal');
    if (thCheckbox) {
        if (isAdmin) thCheckbox.classList.remove('hidden');
        else thCheckbox.classList.add('hidden');
    }
    if (btnMassal) {
        if (isAdmin) btnMassal.classList.remove('hidden');
        else btnMassal.classList.add('hidden');
    }

    sData.forEach(m => {
        let textHppColor = m.hppPersen > hppLimitThreshold ? 'text-red-600 font-black' : 'text-emerald-600 font-bold';
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';

        let html = '';
        if (isAdmin) {
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
        // [PERBAIKAN 5] DROPDOWN IDENTIK DENGAN KATEGORI & DIBUAT VERTIKAL
        html += `<td class="p-4 text-center">`;
        html += `<div class="relative inline-block">`;
        if (isAdmin) {
            html += `
                <button onclick="toggleKebabMenu(event, 'drop-summary-${m.id}')" class="kebab-btn bg-white hover:bg-gray-200 text-gray-600 w-8 h-8 rounded-lg font-bold shadow-sm border border-gray-200 transition-colors">â‹®</button>
                <div id="drop-summary-${m.id}" class="dropdown-menu hidden absolute right-full top-0 mr-2 bg-white shadow-xl rounded-xl border border-gray-100 w-36 py-2 text-sm text-gray-700 z-[70] overflow-hidden">
                    <button onclick="infoResepCard(${m.id})" class="w-full block text-left px-4 py-2 hover:bg-blue-50 font-bold text-blue-600">â„¹ï¸ Info</button>
                    <button onclick="bukaModalEditResep(${JSON.stringify(m).replace(/"/g, '&quot;')})" class="w-full block text-left px-4 py-2 hover:bg-blue-50 font-bold text-blue-600 border-t border-gray-100">ðŸ“ Edit</button>
                    <button onclick="aksiHapusResep(${m.id}, '${m.nama}')" class="w-full block text-left px-4 py-2 hover:bg-red-50 font-bold text-red-600 border-t border-gray-100 mt-1">ðŸ—‘ï¸ Hapus</button>
                </div>
            `;
        } else {
            html += `
                <button onclick="toggleKebabMenu(event, 'drop-summary-${m.id}')" class="kebab-btn bg-white hover:bg-gray-200 text-gray-600 w-8 h-8 rounded-lg font-bold shadow-sm border border-gray-200 transition-colors">â‹®</button>
                <div id="drop-summary-${m.id}" class="dropdown-menu hidden absolute right-full top-0 mr-2 bg-white shadow-xl rounded-xl border border-gray-100 w-36 py-2 text-sm text-gray-700 z-[70] overflow-hidden">
                    <button onclick="infoResepCard(${m.id})" class="w-full block text-left px-4 py-2 hover:bg-blue-50 font-bold text-blue-600">â„¹ï¸ Info</button>
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
            icon.textContent = summarySortAsc ? 'â–²' : 'â–¼';
        } else {
            icon.textContent = 'â–½';
        }
    });

    const selectAll = document.getElementById('select-all-summary');
    if (selectAll) selectAll.checked = false;
}

function infoResepCard(id) {
    const menu = cachedResepSummaryData.find(m => m.id === id);
    if (!menu) return alert('Data tidak ditemukan');
    document.getElementById('info-resep-nama').innerText = menu.nama;
    let detailHtml = `
        <p><strong>Kategori:</strong> ${menu.kategori}</p>
        <p><strong>Sub Kategori:</strong> ${menu.sub_kategori}</p>
        <p><strong>Harga Jual:</strong> ${formatRp(menu.harga_jual)}</p>
        <p><strong>Yield (Porsi):</strong> ${menu.yield}</p>
        <p><strong>HPP / Porsi:</strong> ${formatRp(menu.totalCost)}</p>
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

function renderDashboardAnalitika() {
    if (!document.getElementById('dash-total-menu')) return;

    const countMenu = cachedResepSummaryData.length;
    const countBB = bahanBakuList.length;

    let totalSumHpp = 0, criticalCount = 0;
    cachedResepSummaryData.forEach(m => {
        totalSumHpp += m.hppPersen;
        if (m.hppPersen > hppLimitThreshold) criticalCount++;
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
    let criticalSorted = cachedResepSummaryData.filter(m => m.hppPersen > hppLimitThreshold).sort((a, b) => b.hppPersen - a.hppPersen);
    criticalBody.innerHTML = '';
    if (criticalSorted.length === 0) {
        criticalBody.innerHTML = `<tr><td class="p-4 text-center text-xs text-emerald-600 font-bold bg-emerald-50 rounded-xl border border-emerald-100">âœ¨ Selamat! Seluruh resep terkendali aman di bawah threshold ${hppLimitThreshold}%.</td></tr>`;
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

async function aksiHapusResep(id, nama) {
    if (confirm(`Yakin hapus resep "${nama}"?`)) {
        showLoading();
        await supabaseClient.from('resep').delete().eq('id', id);
        hideLoading();
        loadDirektori();
    }
}

async function bukaModalEditResep(menuObj) {
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
            } else if (mode === 'modify') {
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

window.onload = async () => {
    await inisialisasiAuth();
    await loadKategoriDB();
    await loadDirektori();
};