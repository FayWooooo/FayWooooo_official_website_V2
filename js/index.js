import { supabase } from "./supabase-config.js";

// DOM 元素定義
const loginBtn = document.getElementById("loginBtn");
const userArea = document.getElementById("userArea");
const profileMenu = document.getElementById("profileMenu");
const userName = document.getElementById("userName");
const userAvatar = document.getElementById("userAvatar");
const userCoins = document.getElementById("userCoins");
const logoutBtn = document.getElementById("logoutBtn");

let realtimeChannel = null;

// ✅ 1. 初始化檢查
async function init() {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
        renderLoggedIn(data.session.user);
    }
}

// ✅ 2. Google 登入功能
if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: window.location.origin + "/home" },
        });
        if (error) console.error("❌ Login Error:", error);
    });
}

// ✅ 3. 登入後 UI 渲染
async function renderLoggedIn(user) {
    // 更新頂部按鈕為頭像
    userArea.innerHTML = `
        <div class="avatar-wrapper" id="avatarTrigger" style="cursor:pointer;">
            <img src="${user.user_metadata.avatar_url}" style="width:42px; height:42px; border-radius:50%; border:2px solid var(--primary);">
        </div>
    `;

    // 綁定頭像點擊開關選單
    document.getElementById("avatarTrigger").addEventListener("click", (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle("hidden");
    });

    // 填充選單內容
    userName.textContent = user.user_metadata.full_name || user.email;
    userAvatar.src = user.user_metadata.avatar_url || "https://i.imgur.com/4M34hi2.png";

    await ensureProfile(user);
    await refreshCoins(user.email);
    enableRealtime(user.email);
}

// ✅ 4. 資料庫 Profile 確保
async function ensureProfile(user) {
    const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (!existing) {
        const { error } = await supabase.from("profiles").insert({
            id: user.id,
            email: user.email,
            faycoins: 0,
        });
        if (error) console.error("⚠️ 建立 profile 失敗:", error);
    }
}

// ✅ 5. 刷新 Fay 幣
async function refreshCoins(email) {
    const { data, error } = await supabase.from("profiles").select("faycoins").eq("email", email).maybeSingle();
    if (!error) {
        const coins = data?.faycoins ?? 0;
        userCoins.textContent = coins;
        localStorage.setItem("faycoins", coins); // 同步到 localStorage
    }
}

// ✅ 6. Realtime 即時監聽
function enableRealtime(email) {
    if (realtimeChannel) realtimeChannel.unsubscribe();

    realtimeChannel = supabase.channel("profiles-update")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
            if (payload.new?.email?.toLowerCase() === email.toLowerCase()) {
                const newCoins = payload.new.faycoins ?? 0;
                userCoins.textContent = newCoins;
                localStorage.setItem("faycoins", newCoins);
            }
        }).subscribe();
}

// ✅ 7. 登出功能
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        location.reload();
    });
}

// ✅ 8. localStorage 多分頁同步監聽
window.addEventListener("storage", (e) => {
    if (e.key === "faycoins" && userCoins) {
        userCoins.textContent = e.newValue;
    }
});

// 點擊空白處關閉 Profile 選單
window.addEventListener("click", () => profileMenu.classList.add("hidden"));
profileMenu.addEventListener("click", (e) => e.stopPropagation());

// 啟動程式
init();