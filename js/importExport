import { getSupabase, bahanBakuList, fileImportTertunda, jenisImportTertunda, listKategori, listSubKategori } from './config.js';
import { showLoading, hideLoading, showSummaryModal, closeModal, showToast } from './ui.js';
import { hasRole } from './auth.js';
import { loadBahanBaku } from './bahanBaku.js';
import { loadKategoriDB } from './kategori.js';
import { loadDirektori } from './resep.js';
import { loadDataPenjualan, renderTablePenjualanInput, eksekusiImportPenjualan } from './penjualan.js';

// ===== IMPORT/EXPORT GENERAL =====
export function initiateImport(event, type) {
    fileImportTertunda = event.target.files[0];
    if (!fileImportTertunda) return;
    jenisImportTertunda = type;
    document.getElementById('modal-import-option').classList.remove('hidden');
}

export function batalImport() {
    fileImportTertunda = null;
    jenisImportTertunda = '';
    document.getElementById('import-bb-file').value = '';
    document.getElementById('import-resep-file').value = '';
    if (document.getElementById('import-kat-file')) document.getElementById('import-kat-file').value = '';
    if (document.getElementById('import-penjualan-file')) document.getElementById('import-penjualan-file').value = '';
    closeModal('modal-import-option');
}

export function jalankanImport(mode) {
    closeModal('modal-import-option');
    showLoading();
    if (jenisImportTertunda === 'bb') eksekusiImportBahanBaku(mode);
    else if (jenisImportTertunda === 'resep') eksekusiImportResep(mode);
    else if (jenisImportTertunda === 'penjualan') eksekusiImportPenjualan(mode);
    else eksekusiImportKategori(mode);
}

// ===== BAHAN BAKU =====
export function downloadTemplateBahanBaku() {
    const ws = XLSX.utils.json_to_sheet([{ "Nama Bahan": "Susu UHT", "Satuan Beli": "Karton", "Harga Beli": 240000, "Nilai Konversi (Yield)": 12000, "Satuan Pemakaian Resep": "ml" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Bahan_Baku.xlsx");
}

export function exportBahanBakuToExcel() {
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
            let successCount = 0, failCount = 0;
            const supabase = getSupabase();
            if (mode === 'replace') {
                const { error: delError } = await supabase.from('bahan_baku').delete().neq('id', 0);
                if (delError && delError.code === '23503') { hideLoading(); alert("GAGAL: Bahan baku sedang dipakai di Resep."); batalImport(); return; }
                const { error: insError } = await supabase.from('bahan_baku').insert(cleanData);
                if (insError) { failCount = cleanData.length; } else { successCount = cleanData.length; }
            } else {
                const { data: ext } = await supabase.from('bahan_baku').select('*');
                const nMap = {};
                ext.forEach(i => nMap[i.nama.toLowerCase()] = i.id);
                for (let r of cleanData) {
                    const eId = nMap[r.nama.toLowerCase()];
                    if (eId) {
                        const { error } = await supabase.from('bahan_baku').update(r).eq('id', eId);
                        if (error) failCount++; else successCount++;
                    } else {
                        const { error } = await supabase.from('bahan_baku').insert([r]);
                        if (error) failCount++; else successCount++;
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

// ===== KATEGORI =====
export function downloadTemplateKategori() {
    const ws = XLSX.utils.json_to_sheet([{ "Nama": "Coffee Series", "Jenis": "Kategori" }, { "Nama": "Espresso Based", "Jenis": "Sub-Kategori" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Kategori");
    XLSX.writeFile(wb, "Template_Kategori_Master.xlsx");
}

export function exportKategoriToExcel() {
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
            const supabase = getSupabase();
            if (mode === 'replace') await supabase.from('kategori_db').delete().neq('id', 0);
            let successCount = 0, failCount = 0;
            const { data: ext } = await supabase.from('kategori_db').select('*');
            const mapCheck = {};
            ext.forEach(x => mapCheck[`${x.nama.toLowerCase()}-${x.jenis.toLowerCase()}`] = x.id);
            for (let r of cleanData) {
                const uniqueKey = `${r.nama.toLowerCase()}-${r.jenis.toLowerCase()}`;
                if (mapCheck[uniqueKey]) {
                    successCount++;
                } else {
                    const { error } = await supabase.from('kategori_db').insert([r]);
                    if (error) failCount++; else successCount++;
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

// ===== RESEP =====
export function downloadTemplateResep() {
    const ws = XLSX.utils.json_to_sheet([{ "Nama Menu": "Iced Choco Banana", "Kategori": "Beverage", "Sub Kategori": "Non-Coffee", "Harga Jual": 28000, "Yield (Porsi)": 1, "Nama Bahan Baku": "Fresh Milk UHT", "Qty": 160 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_Resep.xlsx");
}

export async function exportResepToExcel() {
    const supabase = getSupabase();
    const { data } = await supabase.from('resep').select(`nama,kategori,sub_kategori,harga_jual,yield,resep_detail(qty,bahan_baku(nama,satuan,harga))`);
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
            const supabase = getSupabase();
            if (mode === 'replace') await supabase.from('resep').delete().neq('id', 0);
            const { data: bbData } = await supabase.from('bahan_baku').select('*');
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
            let successCount = 0, failCount = 0;
            for (let k in grp) {
                if (grp[k].ing.length === 0) { failCount++; continue; }
                let rId, hasError = false;
                if (mode === 'modify') {
                    const { data: cR } = await supabase.from('resep').select('id').eq('nama', grp[k].nama).single();
                    if (cR) {
                        rId = cR.id;
                        await supabase.from('resep').update({ kategori: grp[k].kategori, sub_kategori: grp[k].sub_kategori, harga_jual: grp[k].harga_jual, yield: grp[k].yield_porsi }).eq('id', rId);
                        await supabase.from('resep_detail').delete().eq('resep_id', rId);
                    }
                }
                if (!rId) {
                    const { data: nR, error: resepErr } = await supabase.from('resep').insert([{ nama: grp[k].nama, kategori: grp[k].kategori, sub_kategori: grp[k].sub_kategori, harga_jual: grp[k].harga_jual, yield: grp[k].yield_porsi }]).select();
                    if (resepErr) { hasError = true; } else { rId = nR[0].id; }
                }
                if (rId && !hasError) {
                    const { error: detailErr } = await supabase.from('resep_detail').insert(grp[k].ing.map(i => ({ resep_id: rId, bahan_baku_id: i.bahan_baku_id, qty: i.qty })));
                    if (detailErr) hasError = true;
                }
                if (hasError) failCount++; else successCount++;
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
