// ========================================
// 🚀 FayWooooo 官網首頁主程式（即時更新版）
// ========================================
import { supabase } from "./supabase-config.js";

const loginBtn = document.getElementById("loginBtn");
const userArea = document.getElementById("userArea");
const profileMenu = document.getElementById("profileMenu");
const userName = document.getElementById("userName");
const userAvatar = document.getElementById("userAvatar");
const userCoins = document.getElementById("userCoins");
const logoutBtn = document.getElementById("logoutBtn");

let currentUser = null;
let realtimeChannel = null;

// ✅ 初始化檢查登入狀態
async function checkSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) await renderLoggedIn(data.session.user);
}

// ✅ Google 登入
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/home" },
    });
    if (error) console.error("❌ Login Error:", error);
    else window.location.href = data.url;
  });
}

// ✅ 登入後畫面與即時功能
async function renderLoggedIn(user) {
  currentUser = user;
  userArea.innerHTML = `
    <span>歡迎，<b>${user.user_metadata.full_name || user.email}</b></span>
    <img src="${user.user_metadata.avatar_url}" id="avatarBtn" class="avatar-btn" />
  `;

  document.getElementById("avatarBtn").addEventListener("click", () => {
    profileMenu.classList.toggle("hidden");
  });

  userName.textContent = user.user_metadata.full_name || user.email;
  userAvatar.src = user.user_metadata.avatar_url || "https://i.imgur.com/4M34hi2.png";

  // ✅ 確保 profile 存在
  await ensureProfile(user);

  // ✅ 抓一次 Fay 幣
  await refreshCoins(user.email);

  // ✅ 啟用 Realtime 監聽
  enableRealtime(user.email);
}

// ✅ 建立使用者資料（若無）
async function ensureProfile(user) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email,
      faycoins: 0,
    });
    if (error) console.error("⚠️ 建立 profile 失敗:", error);
  }
}

// ✅ 抓取最新 Fay 幣
async function refreshCoins(email) {
  const { data, error } = await supabase
    .from("profiles")
    .select("faycoins")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("❌ 取得 Fay 幣失敗:", error);
    userCoins.textContent = "--";
  } else {
    userCoins.textContent = data?.faycoins ?? 0;
  }
}

// ✅ Realtime 即時監聽 Fay 幣變化
function enableRealtime(email) {
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }

  realtimeChannel = supabase
    .channel("profiles-change")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles" },
      (payload) => {
        const newData = payload.new;
        if (newData?.email?.toLowerCase() === email.toLowerCase()) {
          userCoins.textContent = newData.faycoins ?? 0;
        }
      }
    )
    .subscribe((status) => {
    });
}

// ✅ 登出
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    if (realtimeChannel) realtimeChannel.unsubscribe();
    profileMenu.classList.add("hidden");
    userArea.innerHTML = `<button id="loginBtn" class="main-btn"><i class="fa-brands fa-google"></i> 使用 Google 登入</button>`;
  });
}
window.addEventListener("storage", (e) => {
  if (e.key === "faycoins") {
    const coinDisplay = document.getElementById("coinDisplay");
    if (coinDisplay) {
      coinDisplay.innerHTML = `<i class="fa-solid fa-coins"></i> Fay幣：${e.newValue}`;
      console.log("🔄 同步更新 Fay幣：" + e.newValue);
    }
  }
});

// 🚀 初始化時從 localStorage 讀取一次
window.addEventListener("DOMContentLoaded", () => {
  const coinDisplay = document.getElementById("coinDisplay");
  const saved = localStorage.getItem("faycoins");
  if (coinDisplay && saved) {
    coinDisplay.innerHTML = `<i class="fa-solid fa-coins"></i> Fay幣：${saved}`;
  }
});
// ✅ 啟動
checkSession();
