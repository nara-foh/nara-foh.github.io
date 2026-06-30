import { cachedResepSummaryData, appSettings, discountResults, discountSortKey, discountSortAsc } from './config.js';
import { formatRp } from './helpers.js';
import { updateDiscountSubcategory } from './kategori.js';

// ===== CALCULATE DISCOUNT =====
export function calculateDiscount() {
    const category = document.getElementById('discount-category').value;
    const subcategory = document.getElementById('discount-subcategory').value;
    const discountPercent = parseFloat(document.getElementById('discount-percent').value) || 0;

    let filtered = [...cachedResepSummaryData];
    if (category !== 'all') filtered = filtered.filter(m => m.kategori === category);
    if (subcategory !== 'all') filtered = filtered.filter(m => m.sub_kategori === subcategory);

    const tbody = document.getElementById('discount-table-body');
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center p-8 text-gray-400 dark:text-gray-500 italic">Tidak ada menu untuk kategori/subkategori ini.</td></tr>`;
        document.getElementById('ds-count').innerText = '0';
        document.getElementById('ds-rev-original').innerText = formatRp(0);
        document.getElementById('ds-rev-discount').innerText = formatRp(0);
        document.getElementById('ds-margin-loss').innerText = formatRp(0);
        discountResults.length = 0;
        return;
    }

    let totalOriginalRev = 0, totalDiscRev = 0, totalMarginLoss = 0;
    let results = [];

    filtered.forEach((item, index) => {
        const discPrice = Math.round(item.harga_jual * (1 - discountPercent / 100));
        const marginAfter = discPrice - item.totalCost;
        const hppAfter = discPrice > 0 ? (item.totalCost / discPrice) * 100 : 0;
        const marginLoss = item.margin - marginAfter;

        totalOriginalRev += item.harga_jual;
        totalDiscRev += discPrice;
        if (marginLoss > 0) totalMarginLoss += marginLoss;

        results.push({
            index: index + 1,
            id: item.id,
            nama: item.nama,
            harga_jual: item.harga_jual,
            diskon: discountPercent,
            harga_diskon: discPrice,
            hpp: item.totalCost,
            margin_awal: item.margin,
            margin_akhir: marginAfter,
            hpp_akhir: hppAfter,
            status: marginAfter < 0 ? '⚠️ Loss' : (marginAfter > 0 && marginAfter < item.margin ? '📉 Eroded' : (marginAfter >= item.margin ? '✅ Safe' : '⚪ Neutral'))
        });
    });

    discountResults.length = 0;
    discountResults.push(...results);
    renderDiscountTable();

    document.getElementById('ds-count').innerText = filtered.length;
    document.getElementById('ds-rev-original').innerText = formatRp(totalOriginalRev);
    document.getElementById('ds-rev-discount').innerText = formatRp(totalDiscRev);
    document.getElementById('ds-margin-loss').innerText = formatRp(totalMarginLoss);
}

export function renderDiscountTable() {
    const tbody = document.getElementById('discount-table-body');
    if (!discountResults || discountResults.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center p-8 text-gray-400 dark:text-gray-500 italic">Klik tombol Calculate untuk melihat hasil simulasi</td></tr>`;
        return;
    }

    const sorted = [...discountResults];
    sorted.sort((a, b) => {
        let valA = a[discountSortKey] !== undefined ? a[discountSortKey] : '';
        let valB = b[discountSortKey] !== undefined ? b[discountSortKey] : '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return discountSortAsc ? -1 : 1;
        if (valA > valB) return discountSortAsc ? 1 : -1;
        return 0;
    });

    const limit = appSettings.hpp_limit;
    let html = '';
    sorted.forEach((item) => {
        let marginAfterColor = '';
        if (item.margin_akhir < 0) marginAfterColor = 'text-red-600 dark:text-red-400 font-bold';
        else if (item.margin_akhir > 0) marginAfterColor = 'text-emerald-600 dark:text-emerald-400 font-bold';
        else marginAfterColor = 'text-gray-900 dark:text-gray-100';

        let hppAfterColor = '';
        if (item.hpp_akhir > limit) hppAfterColor = 'text-red-600 dark:text-red-400 font-bold';
        else if (item.hpp_akhir < limit) hppAfterColor = 'text-emerald-600 dark:text-emerald-400 font-bold';
        else hppAfterColor = 'text-gray-900 dark:text-gray-100';

        let statusColor = '';
        if (item.status === '⚠️ Loss') statusColor = 'text-red-600 dark:text-red-400';
        else if (item.status === '📉 Eroded') statusColor = 'text-amber-500 dark:text-amber-400';
        else if (item.status === '✅ Safe') statusColor = 'text-emerald-600 dark:text-emerald-400';
        else statusColor = 'text-gray-400';

        html += `
            <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td class="p-3 text-center">${item.index}</td>
                <td class="p-3 font-semibold text-gray-700 dark:text-gray-300">${item.nama}</td>
                <td class="p-3 text-right font-semibold text-gray-700 dark:text-gray-300">${formatRp(item.harga_jual)}</td>
                <td class="p-3 text-center font-bold text-blue-600 dark:text-blue-400">${item.diskon.toFixed(1)}%</td>
                <td class="p-3 text-right font-bold text-gray-800 dark:text-white">${formatRp(item.harga_diskon)}</td>
                <td class="p-3 text-right text-gray-500 dark:text-gray-400">${formatRp(item.hpp)}</td>
                <td class="p-3 text-right ${item.margin_awal < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'} font-bold">${formatRp(item.margin_awal)}</td>
                <td class="p-3 text-right ${marginAfterColor}">${formatRp(item.margin_akhir)}</td>
                <td class="p-3 text-center ${hppAfterColor}">${item.hpp_akhir.toFixed(1)}%</td>
                <td class="p-3 text-center ${statusColor} text-sm font-bold">${item.status}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;

    document.querySelectorAll('#discount-table .sortable-disc').forEach(th => {
        const key = th.dataset.sort;
        const icon = th.querySelector('.sort-icon');
        if (key === discountSortKey) {
            icon.textContent = discountSortAsc ? '▲' : '▼';
        } else {
            icon.textContent = '▽';
        }
    });
}
