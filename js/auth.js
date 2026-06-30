import { getSupabase, currentUser, appSettings } from './config.js';
import { showLoading, hideLoading, showLoginScreen, hideLoginScreen, updateUIByRole, loadAppSettings } from './ui.js';

// ===== AUTH =====
export async function inisialisasiAuth() {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        await fetchUserRoleAndSettings(session.user);
    } else {
        currentUser = null;
        showLoginScreen();
        await loadAppSettings();
    }
    supabase.auth.onAuthStateChange(async (_event, session) => {
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
    const supabase = getSupabase();
    const { data: roleData, error: roleErr } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
    let role = 'staff';
    if (roleErr || !roleData) {
        await supabase.from('user_roles').insert([{ user_id: user.id, role: 'staff' }]);
        role = 'staff';
    } else {
        role = roleData.role;
    }
    currentUser = { id: user.id, email: user.email, role };
    await loadAppSettings();
    updateUIByRole();
    hideLoginScreen();
    hideLoading();
}

export async function loginAdmin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('btn-submit-login');
    if (!email || !password) return alert("Masukkan email dan password!");
    btn.innerText = "Memverifikasi...";
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    btn.innerText = "Masuk";
    if (error) alert("Gagal Login: " + error.message);
}

export async function logoutAdmin() {
    if (!confirm("Apakah Anda yakin ingin keluar?")) return;
    showLoading();
    const supabase = getSupabase();
    await supabase.auth.signOut();
    hideLoading();
}

export function hasRole(minRole) {
    if (!currentUser) return false;
    const hierarchy = { staff: 1, admin: 2, senior_bar: 3, head_bar: 4 };
    return (hierarchy[currentUser.role] || 0) >= (hierarchy[minRole] || 0);
}

export function getCurrentUser() {
    return currentUser;
}
