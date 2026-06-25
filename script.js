// Ganti kredensial Supabase Anda di sini
const SUPABASE_URL = 'https://mslsgobvzzxxkwfvpjhx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbHNgobvzzxxkwfvpjhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzAzMDEsImV4cCI6MjA5NzgwNjMwMX0.V7pUmC3En3O0pc3VamJUm9eq7cnB7UFLi333LmtnJqQ';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Global Sistem
let akunAktif = null; // Menyimpan objek user yang sedang login
let bahanBakuList = [], tempKomposisiBaru = [], tempKomposisiEdit = [];
let listKategori = [], listSubKategori = [];
let bbCurrentPage = 1, bbItemsPerPage = 10;
let bbSortKey = 'nama', bbSortOrder = 'asc';
let summarySortKey = 'nama', summarySortAsc = true;
let cachedResepSummaryData = [];

// Parameter Global Konfigurasi (Akan disinkronisasikan via Database)
let hppLimitThreshold = 35;
let overheadCost = 0;
let overheadType = 'percentage';

// --- SISTEM AUTENTIKASI & HIERARKI AKUN (RBAC) ---
async function handleLogin(e) {
    e.preventDefault();
    showLoading();
    const userIn = document.getElementById('login-username').value.trim();
    const passIn = document.getElementById('login-password').value.trim();

    try {
        const { data, error } = await supabaseClient
            .from('users_fnb')
            .select('*')
            .eq('username', userIn)
            .eq('password', passIn)
            .single();

        if (error || !data) {
            alert('Username atau password salah / tidak ditemukan!');
            hideLoading();
            return;
        }

        akunAktif = data;
        localStorage.setItem('fnb_logged_user', JSON.stringify(akunAktif));
        
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        // Atur UI Nama profil atas
        document.getElementById('user-display-name').innerText = akunAktif.nama;
        document.getElementById('user-display-role').innerText = akunAktif.role;

        // Ambil setelan global terbaru dari database, lalu terapkan hak akses visual & muat data
        await loadGlobalSettingsFromDB();
        applyRoleAccessControl(akunAktif.role);
        await refreshSemuaDataMaster();

    } catch (err) {
        console.error(err);
        alert('Gagal memproses login!');
    } finally {
        hideLoading();
    }
}

function handleLogout() {
    akunAktif = null;
    localStorage.removeItem('fnb_logged_user');
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('form-login').reset();
}

function checkSessionOnLoad() {
    const savedUser = localStorage.getItem('fnb_logged_user');
    if (savedUser) {
        akunAktif = JSON.parse(savedUser);
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display-name').innerText = akunAktif.nama;
        document.getElementById('user-display-role').innerText = akunAktif.role;
        
        showLoading();
        loadGlobalSettingsFromDB().then(() => {
            applyRoleAccessControl(akunAktif.role);
            refreshSemuaDataMaster().then(() => hideLoading());
        });
    }
}

function applyRoleAccessControl(role) {
    // Sembunyikan seluruh tab khusus terlebih dahulu
    document.getElementById('nav-dashboard').classList.add('hidden');
    document.getElementById('nav-bahan-baku').classList.add('hidden');
    document.getElementById('nav-input-hpp').classList.add('hidden');
    document.getElementById('nav-kategori').classList.add('hidden');
    document.getElementById('nav-settings').classList.add('hidden');

    // Sembunyikan kolom aksi manipulasi tabel resep summary secara default
    const actionCols = document.querySelectorAll('.exact-action-col');
    actionCols.forEach(el => el.classList.add('hidden'));

    // Buka akses secara progresif bertahap sesuai hirarki akun
    if (role === 'Staff') {
        switchTab('tab-direktori');
    } 
    else if (role === 'Admin') {
        document.getElementById('nav-bahan-baku').classList.remove('hidden');
        switchTab('tab-direktori');
    } 
    else if (role === 'Senior Bar') {
        document.getElementById('nav-bahan-baku').classList.remove('hidden');
        document.getElementById('nav-input-hpp').classList.remove('hidden');
        actionCols.forEach(el => el.classList.remove('hidden'));
        switchTab('tab-direktori');
    } 
    else if (role === 'Head/Executive Bar') {
        document.getElementById('nav-dashboard').classList.remove('hidden');
        document.getElementById('nav-bahan-baku').classList.remove('hidden');
        document.getElementById('nav-input-hpp').classList.remove('hidden');
        document.getElementById('nav-kategori').classList.remove('hidden');
        document.getElementById('nav-settings').classList.remove('hidden');
        actionCols.forEach(el => el.classList.remove('hidden'));
        switchTab('tab-dashboard');
    }
}

// --- MANAJEMEN SETTINGS TERPUSAT DI DATABASE ---
async function loadGlobalSettingsFromDB() {
    try {
        const { data, error } = await supabaseClient.from('settings_fnb').select('*');
        if (!error && data) {
            data.forEach(item => {
                if (item.key === 'hpp_limit') hppLimitThreshold = parseFloat(item.value) || 35;
                if (item.key === 'overhead_cost') overheadCost = parseFloat(item.value) || 0;
                if (item.key === 'overhead_type') overheadType = item.value || 'percentage';
            });
        }
        // Isi form isian di tab setting (hanya berguna untuk Head/Executive Bar)
        if (document.getElementById('setting-hpp-limit')) {
            document.getElementById('setting-hpp-limit').value = hppLimitThreshold;
            document.getElementById('setting-overhead-type').value = overheadType;
            document.getElementById('setting-overhead-cost').value = overheadCost;
        }
    } catch (e) {
        console.error("Gagal sinkronisasi pengaturan database:", e);
    }
}

async function simpanSettingsKeDB() {
    if (!akunAktif || akunAktif.role !== 'Head/Executive Bar') {
        alert('Akses Ditolak! Hanya Head/Executive Bar yang dapat merubah konfigurasi biaya overhead global.');
        return;
    }
    showLoading();
    const limitVal = document.getElementById('setting-hpp-limit').value;
    const typeVal = document.getElementById('setting-overhead-type').value;
    const costVal = document.getElementById('setting-overhead-cost').value;

    try {
        await supabaseClient.from('settings_fnb').upsert({ key: 'hpp_limit', value: String(limitVal) });
        await supabaseClient.from('settings_fnb').upsert({ key: 'overhead_type', value: String(typeVal) });
        await supabaseClient.from('settings_fnb').upsert({ key: 'overhead_cost', value: String(costVal) });
        
        // Refresh variabel global lokal aplikasi
        await loadGlobalSettingsFromDB();
        await refreshSemuaDataMaster();
        alert('Pengaturan overhead global berhasil disimpan ke database cloud! Otomatis tersinkron dengan seluruh akun staff.');
    } catch (err) {
        alert('Gagal memperbarui database pengaturan.');
    } finally {
        hideLoading();
    }
}

// --- UTILITY FORMAT RUPIAH & LOADING INDIKATOR ---
function formatRupiah(num) {
    return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}
function showLoading() { document.getElementById('loading-global').classList.remove('hidden'); }
function hideLoading() { document.getElementById('loading-global').classList.add('hidden'); }
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.btn-tab').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    // Cari tombol nav yang cocok
    const navBtn = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
    if (navBtn) navBtn.classList.add('active');
}

// --- ENGINE REFRESH & LOAD DATA DARI DATABASE ---
async function refreshSemuaDataMaster() {
    await fetchMasterKategori();
    await fetchBahanBaku();
    await loadDirektori();
    await loadSummaryHPP();
    if (akunAktif && akunAktif.role === 'Head/Executive Bar') {
        hitungDashboardStatistik();
    }
}

async function fetchMasterKategori() {
    const { data } = await supabaseClient.from('kategori_db').select('*').order('id', { ascending: true });
    if (data) {
        listKategori = [...new Set(data.map(i => i.kategori))].filter(Boolean);
        listSubKategori = data;
        
        updateKategoriDropdowns();
        renderKategoriMasterTab();
    }
}

function updateKategoriDropdowns() {
    const ddBaru = document.getElementById('input-resep-kategori');
    const ddEdit = document.getElementById('edit-form-resep-kategori');
    let opts = listKategori.map(k => `<option value="${k}">${k}</option>`).join('');
    
    if (ddBaru) {
        ddBaru.innerHTML = opts;
        updateSubKategoriDropdown('input-resep-subkategori', ddBaru.value);
    }
    if (ddEdit) {
        ddEdit.innerHTML = opts;
    }
}

function updateSubKategoriDropdown(targetId, kategoriPilihan) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const filtered = listSubKategori.filter(i => i.kategori === kategoriPilihan);
    target.innerHTML = filtered.map(i => `<option value="${i.sub_kategori}">${i.sub_kategori}</option>`).join('');
}

async function fetchBahanBaku() {
    const { data } = await supabaseClient.from('bahan_baku').select('*');
    if (data) {
        bahanBakuList = data.map(b => {
            const yieldFactor = (parseFloat(b.yield) || 100) / 100;
            const hargaDasar = (parseFloat(b.harga_beli) / (parseFloat(b.konversi) || 1)) / yieldFactor;
            return { ...b, harga_dasar: hargaDasar };
        });
        renderBahanBaku();
    }
}

// --- MODUL MANAJEMEN DATA BAHAN BAKU (TAB 4) ---
function renderBahanBaku() {
    const tbody = document.getElementById('bb-tbody');
    if (!tbody) return;
    
    let filtered = [...bahanBakuList];
    const search = document.getElementById('search-bb').value.toLowerCase();
    if (search) filtered = filtered.filter(i => i.nama.toLowerCase().includes(search));
    
    // Logic Sorting Bahan Baku
    filtered.sort((a, b) => {
        let valA = a[bbSortKey], valB = b[bbSortKey];
        if (typeof valA === 'string') return bbSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return bbSortOrder === 'asc' ? valA - valB : valB - valA;
    });

    const totalEntries = filtered.length;
    const start = (bbCurrentPage - 1) * bbItemsPerPage;
    const end = Math.min(start + bbItemsPerPage, totalEntries);
    const pageData = filtered.slice(start, end);

    document.getElementById('bb-pagination-info').innerText = `Showing ${totalEntries ? start + 1 : 0} to ${end} of ${totalEntries} entries`;

    tbody.innerHTML = pageData.map(b => `
        <tr class="hover:bg-slate-50 transition-colors border-b">
            <td class="p-4 font-bold text-gray-900">${b.nama}</td>
            <td class="p-4">${formatRupiah(b.harga_beli)}</td>
            <td class="p-4 text-xs font-semibold text-gray-400">${b.satuan_beli}</td>
            <td class="p-4 font-mono">${b.konversi}</td>
            <td class="p-4 text-xs font-bold text-blue-600">${b.satuan_resep}</td>
            <td class="p-4 text-center font-bold ${b.yield < 100 ? 'text-amber-600' : 'text-gray-500'}">${b.yield}%</td>
            <td class="p-4 text-blue-600 font-bold">${formatRupiah(b.harga_dasar)} / ${b.satuan_resep}</td>
            <td class="p-4">
                <div class="flex gap-1">
                    <button onclick="bukaEditBahanBaku(${b.id})" class="p-1 text-blue-600 hover:bg-blue-50 rounded-md">✏️</button>
                    <button onclick="hapusBahanBaku(${b.id})" class="p-1 text-red-600 hover:bg-red-50 rounded-md">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function sortBB(key) {
    if (bbSortKey === key) bbSortOrder = bbSortOrder === 'asc' ? 'desc' : 'asc';
    else { bbSortKey = key; bbSortOrder = 'asc'; }
    renderBahanBaku();
}
function changeBBPage(dir) {
    bbCurrentPage += dir;
    if (bbCurrentPage < 1) bbCurrentPage = 1;
    renderBahanBaku();
}

async function simpanBahanBakuBaru() {
    if (!akunAktif || (akunAktif.role !== 'Admin' && akunAktif.role !== 'Senior Bar' && akunAktif.role !== 'Head/Executive Bar')) {
        alert('Akses Ditolak! Akun Anda tidak memiliki otoritas merubah Database Bahan Baku.');
        return;
    }
    const nama = document.getElementById('add-bb-nama').value.trim();
    const harga_beli = parseFloat(document.getElementById('add-bb-harga').value);
    const satuan_beli = document.getElementById('add-bb-satuan-beli').value.trim();
    const konversi = parseFloat(document.getElementById('add-bb-konversi').value);
    const satuan_resep = document.getElementById('add-bb-satuan-resep').value.trim();
    const yieldVal = parseFloat(document.getElementById('add-bb-yield').value) || 100;

    if (!nama || isNaN(harga_beli) || isNaN(konversi)) { alert('Mohon isi form data bahan baku secara lengkap!'); return; }
    showLoading();
    
    await supabaseClient.from('bahan_baku').insert([{ nama, harga_beli, satuan_beli, konversi, satuan_resep, yield: yieldVal }]);
    closeModal('modal-bb-baru');
    document.getElementById('add-bb-nama').value = '';
    document.getElementById('add-bb-harga').value = '';
    document.getElementById('add-bb-konversi').value = '';
    await fetchBahanBaku();
    hideLoading();
}

function bukaEditBahanBaku(id) {
    if (!akunAktif || (akunAktif.role !== 'Admin' && akunAktif.role !== 'Senior Bar' && akunAktif.role !== 'Head/Executive Bar')) {
        alert('Akses Ditolak! Akun Anda tidak memiliki hak akses editor.');
        return;
    }
    const item = bahanBakuList.find(b => b.id === id);
    if (!item) return;
    document.getElementById('edit-bb-id').value = item.id;
    document.getElementById('edit-bb-nama').value = item.nama;
    document.getElementById('edit-bb-harga').value = item.harga_beli;
    document.getElementById('edit-bb-satuan-beli').value = item.satuan_beli;
    document.getElementById('edit-bb-konversi').value = item.konversi;
    document.getElementById('edit-bb-satuan-resep').value = item.satuan_resep;
    document.getElementById('edit-bb-yield').value = item.yield;
    openModal('modal-bb-edit');
}

async function updateBahanBakuDiDB() {
    showLoading();
    const id = document.getElementById('edit-bb-id').value;
    const nama = document.getElementById('edit-bb-nama').value.trim();
    const harga_beli = parseFloat(document.getElementById('edit-bb-harga').value);
    const satuan_beli = document.getElementById('edit-bb-satuan-beli').value.trim();
    const konversi = parseFloat(document.getElementById('edit-bb-konversi').value);
    const satuan_resep = document.getElementById('edit-bb-satuan-resep').value.trim();
    const yieldVal = parseFloat(document.getElementById('edit-bb-yield').value) || 100;

    await supabaseClient.from('bahan_baku').update({ nama, harga_beli, satuan_beli, konversi, satuan_resep, yield: yieldVal }).eq('id', id);
    closeModal('modal-bb-edit');
    await fetchBahanBaku();
    await refreshSemuaDataMaster();
    hideLoading();
}

async function hapusBahanBaku(id) {
    if (!akunAktif || (akunAktif.role !== 'Admin' && akunAktif.role !== 'Senior Bar' && akunAktif.role !== 'Head/Executive Bar')) {
        alert('Akses Ditolak!'); return;
    }
    if (confirm('Apakah Anda yakin ingin menghapus bahan baku ini dari sistem?')) {
        showLoading();
        await supabaseClient.from('bahan_baku').delete().eq('id', id);
        await fetchBahanBaku();
        await refreshSemuaDataMaster();
        hideLoading();
    }
}

// --- CORE ENGINE DIREKTORI & SUMMARY REKAP HPP (TAB 1 & TAB 2) ---
async function loadDirektori() {
    const container = document.getElementById('direktori-container');
    if (!container) return;

    const { data: resepData } = await supabaseClient.from('resep').select('*');
    const { data: detailData } = await supabaseClient.from('resep_detail').select('*, bahan_baku(*)');
    
    if (!resepData) return;

    let search = document.getElementById('search-direktori').value.toLowerCase();
    container.innerHTML = resepData.filter(r => r.nama.toLowerCase().includes(search)).map(r => {
        const subDetail = detailData.filter(d => d.resep_id === r.id);
        
        // Kalkulasi Total HPP Bahan Baku
        let totalHppBahan = 0;
        subDetail.forEach(d => {
            if (d.bahan_baku) {
                const yieldF = (parseFloat(d.bahan_baku.yield) || 100) / 100;
                const hrgDasar = (parseFloat(d.bahan_baku.harga_beli) / (parseFloat(d.bahan_baku.konversi) || 1)) / yieldF;
                totalHppBahan += hrgDasar * (parseFloat(d.qty) || 0);
            }
        });

        // Hitung biaya overhead komparatif berdasarkan setting database terbaru
        let overheadFinal = overheadType === 'percentage' ? (totalHppBahan * (overheadCost / 100)) : overheadCost;
        let hppAkumulasiTotal = totalHppBahan + overheadFinal;
        
        let rasioPersenHpp = r.harga_jual > 0 ? (hppAkumulasiTotal / r.harga_jual) * 100 : 0;
        let isOverLimit = rasioPersenHpp > hppLimitThreshold;

        return `
            <div class="bg-white rounded-2xl border p-5 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden">
                <div class="absolute top-0 left-0 w-2 h-full ${isOverLimit ? 'bg-red-500' : 'bg-emerald-500'}"></div>
                <div>
                    <div class="flex justify-between items-start">
                        <span class="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-black uppercase text-gray-500">${r.kategori}</span>
                        <span class="text-xs font-black ${isOverLimit ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'} px-2 py-0.5 rounded">HPP: ${rasioPersenHpp.toFixed(1)}%</span>
                    </div>
                    <h3 class="text-base font-black text-gray-900 mt-2 tracking-tight">${r.nama}</h3>
                    <p class="text-[11px] text-gray-400 font-bold uppercase mt-0.5">${r.sub_kategori}</p>
                </div>
                
                <div class="border-t pt-3 flex justify-between items-center">
                    <div>
                        <div class="text-[10px] text-gray-400 font-bold uppercase">Harga Menu</div>
                        <div class="text-base font-black text-blue-600">${formatRupiah(r.harga_jual)}</div>
                    </div>
                    <div class="flex gap-1">
                        <button onclick="lihatDetailResepCard(${r.id})" class="bg-slate-100 hover:bg-slate-200 text-gray-700 font-bold text-xs px-3 py-2 rounded-xl">Lihat Resep</button>
                        ${(akunAktif && (akunAktif.role === 'Senior Bar' || akunAktif.role === 'Head/Executive Bar')) ? `
                            <button onclick="bukaEditResepFormula(${r.id})" class="bg-blue-50 text-blue-600 font-bold text-xs px-2.5 py-2 rounded-xl hover:bg-blue-100">✏️</button>
                            <button onclick="hapusMenuResep(${r.id})" class="bg-red-50 text-red-600 font-bold text-xs px-2.5 py-2 rounded-xl hover:bg-red-100">🗑️</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function loadSummaryHPP() {
    const tbody = document.getElementById('summary-tbody');
    if (!tbody) return;

    const { data: resepData } = await supabaseClient.from('resep').select('*');
    const { data: detailData } = await supabaseClient.from('resep_detail').select('*, bahan_baku(*)');
    
    if (!resepData) return;

    cachedResepSummaryData = resepData.map(r => {
        const sub = detailData.filter(d => d.resep_id === r.id);
        let tHppBahan = 0;
        sub.forEach(d => {
            if (d.bahan_baku) {
                const yld = (parseFloat(d.bahan_baku.yield) || 100) / 100;
                const hBasic = (parseFloat(d.bahan_baku.harga_beli) / (parseFloat(d.bahan_baku.konversi) || 1)) / yld;
                tHppBahan += hBasic * (parseFloat(d.qty) || 0);
            }
        });

        let ovh = overheadType === 'percentage' ? (tHppBahan * (overheadCost / 100)) : overheadCost;
        let totalHppAll = tHppBahan + ovh;
        let pct = r.harga_jual > 0 ? (totalHppAll / r.harga_jual) * 100 : 0;
        let mgn = r.harga_jual - totalHppAll;

        return { id: r.id, nama: r.nama, kategori: r.kategori, hpp: totalHppAll, harga: r.harga_jual, persen: pct, margin: mgn };
    });

    renderTableSummary();
}

function renderTableSummary() {
    const tbody = document.getElementById('summary-tbody');
    
    // Sort logic
    cachedResepSummaryData.sort((a, b) => {
        let valA = a[summarySortKey], valB = b[summarySortKey];
        if (typeof valA === 'string') return summarySortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return summarySortAsc ? valA - valB : valB - valA;
    });

    tbody.innerHTML = cachedResepSummaryData.map(r => {
        let isOver = r.persen > hppLimitThreshold;
        return `
            <tr class="hover:bg-slate-50 transition-colors border-b">
                <td class="p-4 font-black text-gray-900">${r.nama}</td>
                <td class="p-4 text-xs font-bold text-gray-400 uppercase">${r.kategori}</td>
                <td class="p-4 font-mono font-bold">${formatRupiah(r.hpp)}</td>
                <td class="p-4 font-mono text-blue-600 font-bold">${formatRupiah(r.harga)}</td>
                <td class="p-4">
                    <span class="px-2.5 py-1 rounded-full text-xs font-black ${isOver ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'}">
                        ${r.persen.toFixed(1)}%
                    </span>
                </td>
                <td class="p-4 font-mono font-bold text-emerald-600">${formatRupiah(r.margin)}</td>
                <td class="p-4 exact-action-col ${(akunAktif && (akunAktif.role === 'Senior Bar' || akunAktif.role === 'Head/Executive Bar')) ? '' : 'hidden'}">
                    <div class="flex gap-1">
                        <button onclick="bukaEditResepFormula(${r.id})" class="p-1 text-blue-600 hover:bg-blue-50 rounded">✏️</button>
                        <button onclick="hapusMenuResep(${r.id})" class="p-1 text-red-600 hover:bg-red-50 rounded">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function lihatDetailResepCard(id) {
    showLoading();
    const { data: resep } = await supabaseClient.from('resep').select('*').eq('id', id).single();
    const { data: detail } = await supabaseClient.from('resep_detail').select('*, bahan_baku(*)').eq('resep_id', id);
    hideLoading();

    if (!resep) return;
    document.getElementById('info-resep-nama').innerText = resep.nama;
    document.getElementById('info-resep-kategori').innerText = resep.kategori;
    document.getElementById('info-resep-sub').innerText = resep.sub_kategori;
    document.getElementById('info-resep-harga').innerText = formatRupiah(resep.harga_jual);

    let tBahan = 0;
    let listHtml = detail.map(d => {
        if (!d.bahan_baku) return '';
        const yld = (parseFloat(d.bahan_baku.yield) || 100) / 100;
        const basic = (parseFloat(d.bahan_baku.harga_beli) / (parseFloat(d.bahan_baku.konversi) || 1)) / yld;
        const subTotal = basic * parseFloat(d.qty);
        tBahan += subTotal;
        return `
            <li class="p-2.5 flex justify-between hover:bg-gray-50">
                <div>
                    <span class="font-bold text-gray-900">${d.bahan_baku.nama}</span>
                    <div class="text-[10px] text-gray-400 font-medium">Kuantitas: ${d.qty} ${d.bahan_baku.satuan_resep}</div>
                </div>
                <div class="font-mono font-bold text-gray-700">${formatRupiah(subTotal)}</div>
            </li>
        `;
    }).join('');

    let finalOvh = overheadType === 'percentage' ? (tBahan * (overheadCost / 100)) : overheadCost;
    let totalAll = tBahan + finalOvh;
    let rasio = resep.harga_jual > 0 ? (totalAll / resep.harga_jual) * 100 : 0;

    document.getElementById('info-resep-rasio').innerText = `${rasio.toFixed(1)}%`;
    document.getElementById('info-resep-rasio').className = `font-black ${rasio > hppLimitThreshold ? 'text-red-600' : 'text-emerald-600'}`;
    
    listHtml += `
        <li class="p-2.5 bg-slate-900 text-slate-100 flex justify-between font-bold border-t mt-2">
            <span>HPP NETT BAHAN BAKU</span>
            <span>${formatRupiah(tBahan)}</span>
        </li>
        <li class="p-2.5 bg-slate-800 text-slate-300 flex justify-between text-xs font-semibold">
            <span>COST OVERHEAD TERPUSAT</span>
            <span>${formatRupiah(finalOvh)}</span>
        </li>
        <li class="p-2.5 bg-blue-600 text-white flex justify-between font-black text-sm">
            <span>TOTAL HPP AKUMULATIF</span>
            <span>${formatRupiah(totalAll)}</span>
        </li>
    `;
    document.getElementById('info-resep-list-bahan').innerHTML = listHtml;
    openModal('modal-info-resep');
}

// --- TAB 5: CREATOR INPUT FORM RESEP BARU ---
function tambahBarisBahanBaru() {
    tempKomposisiBaru.push({ bahan_baku_id: '', qty: 0 });
    renderBarisKomposisiBaru();
}
function renderBarisKomposisiBaru() {
    const tbody = document.getElementById('tbody-komposisi-baru');
    tbody.innerHTML = tempKomposisiBaru.map((row, idx) => {
        let options = bahanBakuList.map(b => `<option value="${b.id}" ${b.id == row.bahan_baku_id ? 'selected' : ''}>${b.nama}</option>`).join('');
        const selBB = bahanBakuList.find(b => b.id == row.bahan_baku_id);
        const sat = selBB ? selBB.satuan_resep : '-';
        const cost = selBB ? (selBB.harga_dasar * (parseFloat(row.qty) || 0)) : 0;

        return `
            <tr class="border-b">
                <td class="py-2">
                    <select onchange="updateTempRowBaru(${idx}, 'id', this.value)" class="w-full p-2 border rounded-xl text-xs font-semibold">
                        <option value="">-- Pilih Bahan Baku --</option>
                        ${options}
                    </select>
                </td>
                <td class="py-2 text-center">
                    <input type="number" step="any" value="${row.qty}" oninput="updateTempRowBaru(${idx}, 'qty', this.value)" class="w-20 p-2 border rounded-xl text-center font-bold">
                </td>
                <td class="py-2 text-xs font-bold text-gray-400">${sat}</td>
                <td class="py-2 font-mono text-xs font-bold">${formatRupiah(cost)}</td>
                <td class="py-2 text-right">
                    <button onclick="hapusRowBaru(${idx})" class="text-red-500 hover:bg-red-50 p-1 rounded">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
    hitungHPPResepBaru();
}

function updateTempRowBaru(idx, fields, val) {
    if (fields === 'id') tempKomposisiBaru[idx].bahan_baku_id = val;
    if (fields === 'qty') tempKomposisiBaru[idx].qty = parseFloat(val) || 0;
    renderBarisKomposisiBaru();
}
function hapusRowBaru(idx) {
    tempKomposisiBaru.splice(idx, 1);
    renderBarisKomposisiBaru();
}

function hitungHPPResepBaru() {
    let tBahan = 0;
    tempKomposisiBaru.forEach(r => {
        const match = bahanBakuList.find(b => b.id == r.bahan_baku_id);
        if (match) tBahan += match.harga_dasar * (parseFloat(r.qty) || 0);
    });

    let ovh = overheadType === 'percentage' ? (tBahan * (overheadCost / 100)) : overheadCost;
    let totalAll = tBahan + ovh;
    const hargaJual = parseFloat(document.getElementById('input-resep-harga').value) || 0;
    let ratio = hargaJual > 0 ? (totalAll / hargaJual) * 100 : 0;
    let margin = hargaJual - totalAll;
    let marginPct = hargaJual > 0 ? (margin / hargaJual) * 100 : 0;

    document.getElementById('live-hpp-bahan').innerText = formatRupiah(tBahan);
    document.getElementById('live-hpp-overhead').innerText = formatRupiah(ovh);
    document.getElementById('live-hpp-total').innerText = `${formatRupiah(totalAll)} (${ratio.toFixed(1)}%)`;
    document.getElementById('live-hpp-margin').innerText = `${formatRupiah(margin)} (${marginPct.toFixed(1)}%)`;
}

async function simpanResepBaruKeDB() {
    if (!akunAktif || (akunAktif.role !== 'Senior Bar' && akunAktif.role !== 'Head/Executive Bar')) {
        alert('Akses Ditolak! Hanya Senior Bar dan Head/Executive Bar yang memiliki izin membuat resep.');
        return;
    }
    const nama = document.getElementById('input-resep-nama').value.trim();
    const kategori = document.getElementById('input-resep-kategori').value;
    const sub_kategori = document.getElementById('input-resep-subkategori').value;
    const harga_jual = parseFloat(document.getElementById('input-resep-harga').value) || 0;

    if (!nama || tempKomposisiBaru.length === 0) { alert('Form data nama resep atau komponen bahan masih kosong!'); return; }
    showLoading();

    const { data: resep, error } = await supabaseClient.from('resep').insert([{ nama, kategori, sub_kategori, harga_jual }]).select().single();
    if (!error && resep) {
        const rId = resep.id;
        const detailPayload = tempKomposisiBaru.filter(i => i.bahan_baku_id).map(i => ({ resep_id: rId, bahan_baku_id: parseInt(i.bahan_baku_id), qty: i.qty }));
        if (detailPayload.length > 0) {
            await supabaseClient.from('resep_detail').insert(detailPayload);
        }
        alert('Resep Formula HPP Baru Berhasil Ditambahkan!');
        resetFormResepBaru();
        await refreshSemuaDataMaster();
    }
    hideLoading();
}

function resetFormResepBaru() {
    document.getElementById('input-resep-nama').value = '';
    document.getElementById('input-resep-harga').value = '';
    tempKomposisiBaru = [];
    renderBarisKomposisiBaru();
}

// --- FORM POPUP EDIT FORMULA RESEP (MODAL) ---
async function bukaEditResepFormula(id) {
    if (!akunAktif || (akunAktif.role !== 'Senior Bar' && akunAktif.role !== 'Head/Executive Bar')) {
        alert('Akses Ditolak!'); return;
    }
    showLoading();
    const { data: resep } = await supabaseClient.from('resep').select('*').eq('id', id).single();
    const { data: detail } = await supabaseClient.from('resep_detail').select('*').eq('resep_id', id);
    hideLoading();

    if (!resep) return;
    document.getElementById('edit-resep-id').value = resep.id;
    document.getElementById('edit-form-resep-nama').value = resep.nama;
    document.getElementById('edit-form-resep-kategori').value = resep.kategori;
    
    updateSubKategoriDropdown('edit-form-resep-subkategori', resep.kategori);
    document.getElementById('edit-form-resep-subkategori').value = resep.sub_kategori;
    document.getElementById('edit-form-resep-harga').value = resep.harga_jual;

    tempKomposisiEdit = detail.map(d => ({ bahan_baku_id: d.bahan_baku_id, qty: d.qty }));
    renderBarisKomposisiEdit();
    openModal('modal-edit-resep');
}

function tambahBarisBahanEdit() {
    tempKomposisiEdit.push({ bahan_baku_id: '', qty: 0 });
    renderBarisKomposisiEdit();
}
function renderBarisKomposisiEdit() {
    const tbody = document.getElementById('tbody-komposisi-edit');
    tbody.innerHTML = tempKomposisiEdit.map((row, idx) => {
        let options = bahanBakuList.map(b => `<option value="${b.id}" ${b.id == row.bahan_baku_id ? 'selected' : ''}>${b.nama}</option>`).join('');
        const selBB = bahanBakuList.find(b => b.id == row.bahan_baku_id);
        const sat = selBB ? selBB.satuan_resep : '-';
        const cost = selBB ? (selBB.harga_dasar * (parseFloat(row.qty) || 0)) : 0;

        return `
            <tr class="border-b">
                <td class="py-1.5">
                    <select onchange="updateTempRowEdit(${idx}, 'id', this.value)" class="w-full p-1.5 border rounded-lg text-xs font-semibold text-gray-800">
                        <option value="">-- Pilih --</option>
                        ${options}
                    </select>
                </td>
                <td class="py-1.5 text-center">
                    <input type="number" step="any" value="${row.qty}" oninput="updateTempRowEdit(${idx}, 'qty', this.value)" class="w-16 p-1.5 border rounded-lg text-center font-bold">
                </td>
                <td class="py-1.5 text-[11px] font-bold text-gray-400">${sat}</td>
                <td class="py-1.5 font-mono text-[11px]">${formatRupiah(cost)}</td>
                <td class="py-1.5 text-right">
                    <button onclick="hapusRowEdit(${idx})" class="text-red-500 p-1">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
    hitungHPPEditResep();
}

function updateTempRowEdit(idx, field, val) {
    if (field === 'id') tempKomposisiEdit[idx].bahan_baku_id = val;
    if (field === 'qty') tempKomposisiEdit[idx].qty = parseFloat(val) || 0;
    renderBarisKomposisiEdit();
}
function hapusRowEdit(idx) {
    tempKomposisiEdit.splice(idx, 1);
    renderBarisKomposisiEdit();
}

function hitungHPPEditResep() {
    let tBahan = 0;
    tempKomposisiEdit.forEach(r => {
        const match = bahanBakuList.find(b => b.id == r.bahan_baku_id);
        if (match) tBahan += match.harga_dasar * (parseFloat(r.qty) || 0);
    });

    let ovh = overheadType === 'percentage' ? (tBahan * (overheadCost / 100)) : overheadCost;
    let totalAll = tBahan + ovh;
    const hargaJual = parseFloat(document.getElementById('edit-form-resep-harga').value) || 0;
    let ratio = hargaJual > 0 ? (totalAll / hargaJual) * 100 : 0;
    let margin = hargaJual - totalAll;
    let marginPct = hargaJual > 0 ? (margin / hargaJual) * 100 : 0;

    document.getElementById('edit-live-hpp-bahan').innerText = formatRupiah(tBahan);
    document.getElementById('edit-live-hpp-overhead').innerText = formatRupiah(ovh);
    document.getElementById('edit-live-hpp-total').innerText = `${formatRupiah(totalAll)} (${ratio.toFixed(1)}%)`;
    document.getElementById('edit-live-hpp-margin').innerText = `${formatRupiah(margin)} (${marginPct.toFixed(1)}%)`;
}

async function simpanPerubahanResepKeDB() {
    showLoading();
    const id = document.getElementById('edit-resep-id').value;
    const nama = document.getElementById('edit-form-resep-nama').value.trim();
    const kategori = document.getElementById('edit-form-resep-kategori').value;
    const sub_kategori = document.getElementById('edit-form-resep-subkategori').value;
    const harga_jual = parseFloat(document.getElementById('edit-form-resep-harga').value) || 0;

    await supabaseClient.from('resep').update({ nama, kategori, sub_kategori, harga_jual }).eq('id', id);
    await supabaseClient.from('resep_detail').delete().eq('resep_id', id);
    
    const pld = tempKomposisiEdit.filter(i => i.bahan_baku_id).map(i => ({ resep_id: parseInt(id), bahan_baku_id: parseInt(i.bahan_baku_id), qty: i.qty }));
    if (pld.length > 0) {
        await supabaseClient.from('resep_detail').insert(pld);
    }

    closeModal('modal-edit-resep');
    await refreshSemuaDataMaster();
    hideLoading();
    alert('Resep berhasil di-update!');
}

async function hapusMenuResep(id) {
    if (!akunAktif || (akunAktif.role !== 'Senior Bar' && akunAktif.role !== 'Head/Executive Bar')) {
        alert('Akses Ditolak!'); return;
    }
    if (confirm('Hapus menu resep ini? Relasi komposisi bahan otomatis ikut terhapus.')) {
        showLoading();
        await supabaseClient.from('resep').delete().eq('id', id);
        await refreshSemuaDataMaster();
        hideLoading();
    }
}

// --- MODUL KATEGORI MASTER DATA (TAB 6) ---
function renderKategoriMasterTab() {
    const listUtama = document.getElementById('list-kategori-utama');
    const listSub = document.getElementById('list-sub-kategori');
    if (!listUtama || !listSub) return;

    listUtama.innerHTML = listKategori.map(k => `
        <li class="py-2.5 flex justify-between items-center border-b last:border-0">
            <span>${k}</span>
            <button onclick="hapusKategoriSistem('${k}')" class="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded">✕ Hapus</button>
        </li>
    `).join('');

    listSub.innerHTML = listSubKategori.map(s => `
        <li class="py-2.5 flex justify-between items-center border-b last:border-0">
            <div>
                <span class="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase mr-2">${s.kategori}</span>
                <span>${s.sub_kategori}</span>
            </div>
            <button onclick="hapusSubKategoriSistem(${s.id})" class="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded">✕ Hapus</button>
        </li>
    `).join('');
}

async function tambahKategoriUtamaPrompt() {
    const n = prompt("Masukkan nama Kategori Utama baru (Contoh: Beverage, Food, Dessert):");
    if (n) {
        showLoading();
        await supabaseClient.from('kategori_db').insert([{ kategori: n.trim(), sub_kategori: 'General' }]);
        await fetchMasterKategori();
        hideLoading();
    }
}
async function tambahSubKategoriPrompt() {
    const kat = prompt(`Pilih salah satu Kategori Utama berikut:\n${listKategori.join(', ')}`);
    if (!listKategori.includes(kat)) { alert("Kategori Utama tidak valid!"); return; }
    const sub = prompt("Masukkan nama Sub-Kategori baru:");
    if (sub) {
        showLoading();
        await supabaseClient.from('kategori_db').insert([{ kategori: kat, sub_kategori: sub.trim() }]);
        await fetchMasterKategori();
        hideLoading();
    }
}
async function hapusKategoriSistem(katName) {
    if (confirm(`Hapus seluruh master kategori '${katName}'?`)) {
        showLoading();
        await supabaseClient.from('kategori_db').delete().eq('kategori', katName);
        await fetchMasterKategori();
        hideLoading();
    }
}
async function hapusSubKategoriSistem(id) {
    if (confirm("Hapus sub-kategori ini?")) {
        showLoading();
        await supabaseClient.from('kategori_db').delete().eq('id', id);
        await fetchMasterKategori();
        hideLoading();
    }
}

// --- MODUL ANALISIS DASHBOARD STATISTICS (TAB 3) ---
function hitungDashboardStatistik() {
    document.getElementById('dash-total-menu').innerText = cachedResepSummaryData.length;
    document.getElementById('dash-total-bb').innerText = bahanBakuList.length;
    
    let overLimitCount = cachedResepSummaryData.filter(i => i.persen > hppLimitThreshold).length;
    document.getElementById('dash-over-limit').innerText = overLimitCount;

    let totalMarginPct = 0;
    cachedResepSummaryData.forEach(i => {
        let pct = i.harga > 0 ? (i.margin / i.harga) * 100 : 0;
        totalMarginPct += pct;
    });
    let avgMargin = cachedResepSummaryData.length > 0 ? (totalMarginPct / cachedResepSummaryData.length) : 0;
    document.getElementById('dash-avg-margin').innerText = `${avgMargin.toFixed(1)}%`;
}

// --- MODUL EXPORT EXCEL VIA SHEETJS ---
function exportSummaryExcel() {
    if (cachedResepSummaryData.length === 0) { alert("Tidak ada data untuk di-export."); return; }
    const wsData = cachedResepSummaryData.map(r => ({
        "Nama Menu": r.nama,
        "Kategori": r.kategori,
        "HPP Akumulatif (Rp)": Math.round(r.hpp),
        "Harga Jual (Rp)": r.harga,
        "Rasio HPP (%)": parseFloat(r.persen.toFixed(2)),
        "Margin Laba Kotor (Rp)": Math.round(r.margin)
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Summary HPP");
    XLSX.writeFile(wb, `FNB_Pro_HPP_Summary_Terbaru.xlsx`);
}

// Event Handler Sorting Header Tabel Summary HPP
document.addEventListener('click', function(e) {
    const th = e.target.closest('.sortable');
    if (th && th.closest('#summary-table')) {
        const key = th.dataset.sort;
        if (key) {
            if (summarySortKey === key) summarySortAsc = !summarySortAsc;
            else { summarySortKey = key; summarySortAsc = true; }
            renderTableSummary();
        }
    }
});

// Jalankan pengecekan session saat aplikasi dimuat pertama kali di browser
window.onload = function() {
    checkSessionOnLoad();
};
