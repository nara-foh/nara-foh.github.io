import { getSupabase, appSettings } from './config.js';
import { showLoading, hideLoading, showToast, toggleOverheadInputStyle, updateOverheadStatusBadge, formatRupiahInput } from './ui.js';
import { hasRole } from './auth.js';
import { loadAppSettings } from './ui.js';

// ===== SAVE SETTINGS =====
export async function simpanSettings() {
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
    const supabase = getSupabase();
    const updates = [
        { key: 'hpp_limit', value: String(limitVal) },
        { key: 'overhead_type', value: ovhType },
        { key: 'overhead_value', value: String(overheadVal) }
    ];
    let gagalUpdate = false, errMsg = '';
    for (const u of updates) {
        const { error, data } = await supabase
            .from('app_settings')
            .update({ value: u.value, updated_at: new Date() })
            .eq('key', u.key)
            .select();
        if (error) { gagalUpdate = true; errMsg = error.message; break; }
        if (!data || data.length === 0) {
            gagalUpdate = true;
            errMsg = `Baris dengan key "${u.key}" belum ada di tabel app_settings.`;
            break;
        }
    }
    hideLoading();
    if (btn) { btn.disabled = false; btn.classList.remove('opacity-60', 'cursor-not-allowed'); }
    if (btnText) btnText.innerHTML = '💾 Simpan Pengaturan';
    if (gagalUpdate) {
        showToast('Gagal menyimpan pengaturan: ' + errMsg, 'error');
        return;
    }
    await loadAppSettings();
    updateUIByRole();
    showToast('Pengaturan berhasil disimpan.', 'success');
}

