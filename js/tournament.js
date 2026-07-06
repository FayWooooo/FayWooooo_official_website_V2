import { supabase } from "./supabase-config.js";

// 🔗 你的 Supabase Edge Function 網址 (請替換成實際專案代碼)
const FUNCTION_URL = "https://wcqutexugvrgnyusnkpv.supabase.co/functions/v1/tournament";

// DOM 元素選取
const userArea = document.getElementById("userArea");
const profileMenu = document.getElementById("profileMenu");
const userName = document.getElementById("userName");
const userAvatar = document.getElementById("userAvatar");
const userCoins = document.getElementById("userCoins");
const logoutBtn = document.getElementById("logoutBtn");

const regForm = document.getElementById("regForm");
const playerNameInput = document.getElementById("playerName");
const playerTagInput = document.getElementById("playerTag");
const contactInfoInput = document.getElementById("contactInfo");
const submitBtn = document.querySelector(".tm-submit-btn");

// 自訂系統提示視窗 (Modal) DOM
const customModal = document.getElementById("customModal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalCloseBtn = document.getElementById("modalCloseBtn");

let realtimeChannel = null;
let currentUser = null;

// === 1. 初始化與跨網頁狀態動態監聽 ===
async function init() {
    // 監聽全域驗證狀態 (當玩家在其他分頁完成登入/登出，此頁會自動觸發並修正變更)
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUser = session.user;
            await renderLoggedIn(currentUser);
            await checkUserRegistration(currentUser); // 自動查驗資料庫，若已報名則永久上鎖
        } else {
            currentUser = null;
            renderLoggedOut();
        }
    });

    // 頁面重整/初次載入時的強制同步檢查
    const { data } = await supabase.auth.getSession();
    if (data.session) {
        currentUser = data.session.user;
        await renderLoggedIn(currentUser);
        await checkUserRegistration(currentUser);
    } else {
        renderLoggedOut();
    }
}

// === 2. 自訂頁內提示視窗組件控制 ===
function showSystemModal(title, message) {
    if (!customModal) return;
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    customModal.classList.remove("hidden");
}

if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => {
        customModal.classList.add("hidden");
    });
}

// === 3. 登入狀態 UI 處理 (精確抹除登入按鈕) ===
async function renderLoggedIn(user) {
    if (!userArea) return;

    // 清空 userArea 容器，置換為頭像區塊，確保「登入」按鈕絕不殘留
    userArea.innerHTML = `
        <div class="avatar-wrapper" id="avatarTrigger" style="cursor:pointer;">
            <img src="${user.user_metadata.avatar_url}" style="width:42px; height:42px; border-radius:50%; border:2px solid var(--primary);">
        </div>
    `;

    // 重新為新產生的頭像元素綁定彈出式選單事件
    const avatarTrigger = document.getElementById("avatarTrigger");
    if (avatarTrigger && profileMenu) {
        avatarTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle("hidden");
        });
    }

    // 寫入下拉式選單內部的使用者資訊與 Fay 幣
    if (userName) userName.textContent = user.user_metadata.full_name || user.email;
    if (userAvatar) userAvatar.src = user.user_metadata.avatar_url || "https://i.imgur.com/4M34hi2.png";
    
    // 自動帶入玩家的 Google 帳戶名稱至輸入框
    if (playerNameInput && !playerNameInput.value) {
        playerNameInput.value = user.user_metadata.full_name || "";
    }

    await ensureProfile(user);
    await refreshCoins(user.email);
    enableRealtime(user.email);
}

// 未登入狀態控制：強制鎖定表單並恢復登入按鈕
function renderLoggedOut() {
    if (userArea) {
        userArea.innerHTML = `
            <button id="loginBtn" class="main-btn">
                <i class="fa-brands fa-google"></i> 登入
            </button>
        `;
        document.getElementById("loginBtn")?.addEventListener("click", async () => {
            await supabase.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: window.location.origin + "/tournament.html" },
            });
        });
    }
    toggleFormState(true, "請先完成帳號登入再進行賽事報名");
}

// === 4. 後端異步驗證：查詢此帳號是否已報名過 ===
async function checkUserRegistration(user) {
    try {
        const response = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: "checkRegistration",
                userId: user.id,
                email: user.email
            })
        });
        const resData = await response.json();

        // 核心邏輯：如果後端查詢已擁有該帳號報名資料，回填並將整張表單永久鎖定
        if (resData.success && resData.isRegistered) {
            if (playerNameInput) playerNameInput.value = resData.registration.player_name;
            if (playerTagInput) playerTagInput.value = resData.registration.player_tag;
            if (contactInfoInput) contactInfoInput.value = resData.registration.contact_info;
            
            toggleFormState(true, "您已成功完成本屆賽事報名");
        } else {
            // 確認未報名，方可開放輸入
            toggleFormState(false, "");
        }
    } catch (err) {
        console.error("無法從驗證伺服器讀取報名狀態:", err);
    }
}

// === 5. 安全攔截：表單提交處理 ===
if (regForm) {
    regForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!currentUser) {
            showSystemModal("安全性提示", "檢測到未授權的操作，請先登入您的帳號。");
            return;
        }

        // 防止玩家高頻雙擊，先行將按鈕停用
        if (submitBtn) submitBtn.disabled = true;

        try {
            const response = await fetch(FUNCTION_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "submitRegistration",
                    userId: currentUser.id,
                    email: currentUser.email,
                    playerName: playerNameInput?.value,
                    playerTag: playerTagInput?.value,
                    contactInfo: contactInfoInput?.value
                })
            });

            const resData = await response.json();

            if (!response.ok || resData.error) {
                showSystemModal("報名程序失敗", resData.error || "系統核心忙碌中，請稍後再試。");
                if (submitBtn) submitBtn.disabled = false;
            } else {
                showSystemModal("報名提交成功", "您的參賽資格已安全確立。請加入官方 LINE 社群以追蹤後續賽程。");
                // 🔒 送出成功，當場將表單及欄位全部無限期鎖定，重整亦同
                toggleFormState(true, "您已成功完成本屆賽事報名");
            }
        } catch (err) {
            showSystemModal("連線逾時", "安全驗證伺服器無回應，請檢查您的網路連線。");
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

// 輔助函式：全權控制表單欄位的 disabled 唯讀屬性與按鈕文字
function toggleFormState(disabled, buttonText) {
    if (playerNameInput) playerNameInput.disabled = disabled;
    if (playerTagInput) playerTagInput.disabled = disabled;
    if (contactInfoInput) contactInfoInput.disabled = disabled;
    if (submitBtn) {
        submitBtn.disabled = disabled;
        submitBtn.innerHTML = disabled ? buttonText : `<i class="fa-solid fa-paper-plane"></i> 提交報名資料`;
    }
}

// === 6. Profiles 與資產即時同步核心 ===
async function ensureProfile(user) {
    const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (!existing) {
        await supabase.from("profiles").insert({ id: user.id, email: user.email, faycoins: 0 });
    }
}

async function refreshCoins(email) {
    const { data, error } = await supabase.from("profiles").select("faycoins").eq("email", email).maybeSingle();
    if (!error && userCoins) {
        const coins = data?.faycoins ?? 0;
        userCoins.textContent = coins;
        localStorage.setItem("faycoins", coins);
    }
}

function enableRealtime(email) {
    if (realtimeChannel) realtimeChannel.unsubscribe();
    realtimeChannel = supabase.channel("profiles-update")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, (payload) => {
            if (payload.new?.email?.toLowerCase() === email.toLowerCase()) {
                const newCoins = payload.new.faycoins ?? 0;
                if (userCoins) userCoins.textContent = newCoins;
                localStorage.setItem("faycoins", newCoins);
            }
        }).subscribe();
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        location.reload();
    });
}

// 點擊空白處關閉下拉選單
window.addEventListener("click", () => profileMenu?.classList.add("hidden"));
profileMenu?.addEventListener("click", (e) => e.stopPropagation());

// 多分頁 localStorage 貨幣同步變更監聽
window.addEventListener("storage", (e) => {
    if (e.key === "faycoins" && userCoins) userCoins.textContent = e.newValue;
});

// 執行
init();