import { supabase } from "./supabase-config.js";

// DOM 元素選取
const userArea = document.getElementById("userArea");
const profileMenu = document.getElementById("profileMenu");
const userName = document.getElementById("userName");
const userAvatar = document.getElementById("userAvatar");
const userCoins = document.getElementById("userCoins");
const logoutBtn = document.getElementById("logoutBtn");

// 玩家標籤 DOM
const userTag = document.getElementById("userTag");
const copyTagBtn = document.getElementById("copyTagBtn");

// 自訂彈窗 DOM
const customModal = document.getElementById("customModal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalCloseBtn = document.getElementById("modalCloseBtn");

let realtimeChannel = null;
let currentUser = null;

// === 1. 初始化與跨頁面 Session 狀態監聽 ===
async function init() {
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUser = session.user;
            await renderLoggedIn(currentUser);
        } else {
            currentUser = null;
            renderLoggedOut();
        }
    });

    const { data } = await supabase.auth.getSession();
    if (data.session) {
        currentUser = data.session.user;
        await renderLoggedIn(currentUser);
    } else {
        renderLoggedOut();
    }
}

// === 2. 自訂頁內視窗控制 ===
function showModal(title, message) {
    if (!customModal) return;
    if (modalTitle) modalTitle.textContent = title;
    if (modalMessage) modalMessage.textContent = message;
    customModal.classList.remove("hidden");
}

if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => {
        customModal.classList.add("hidden");
    });
}

// === 3. 登入 UI 控制與名片渲染 ===
async function renderLoggedIn(user) {
    if (!userArea) return;

    const avatarUrl = user.user_metadata?.avatar_url || "https://i.imgur.com/4M34hi2.png";

    // 動態生成導覽列頭像
    userArea.innerHTML = `
        <div class="avatar-wrapper" id="avatarTrigger" style="cursor:pointer;">
            <img src="${avatarUrl}" style="width:42px; height:42px; border-radius:50%; border:2px solid var(--primary);">
        </div>
    `;

    // 綁定頭像點擊事件
    const avatarTrigger = document.getElementById("avatarTrigger");
    if (avatarTrigger && profileMenu) {
        avatarTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle("hidden");
        });
    }

    if (userAvatar) userAvatar.src = avatarUrl;

    // 拿取最新 profile 資料
    const profile = await ensureAndGetProfile(user);

    // 🎯 抓取 display_name（優先度：display_name -> name -> Google full_name -> email 轉前綴 -> 預設玩家）
    const finalDisplayName = profile?.display_name || 
                             profile?.name || 
                             user.user_metadata?.full_name || 
                             user.email?.split("@")[0] || 
                             "玩家";

    // 🎯 抓取 player_tag（補齊 '#' 或預設 '#------'）
    const rawTag = profile?.player_tag;
    const tagVal = rawTag ? (rawTag.startsWith("#") ? rawTag : `${rawTag}`) : "尚未設定";

    if (userName) userName.textContent = finalDisplayName;
    if (userTag) userTag.textContent = tagVal;

    // 綁定一鍵複製按鈕邏輯（安全 replaceChild 防止 null 報錯）
    if (copyTagBtn && copyTagBtn.parentNode) {
        const newCopyBtn = copyTagBtn.cloneNode(true);
        copyTagBtn.parentNode.replaceChild(newCopyBtn, copyTagBtn);

        newCopyBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (tagVal === "#------") {
                showModal("複製失敗", "目前尚未設定玩家標籤。");
                return;
            }
            navigator.clipboard.writeText(tagVal).then(() => {
                showModal("複製成功", `已複製玩家標籤 ${tagVal}`);
            }).catch(() => {
                showModal("複製失敗", "瀏覽器不支援剪貼簿功能。");
            });
        });
    }

    await refreshCoins(user.id);
    enableRealtime(user.id);
}

// 未登入控制
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
                options: { redirectTo: window.location.origin + "/index.html" },
            });
        });
    }
}

// === 4. Profiles 資料同步及抓取 ===
async function ensureAndGetProfile(user) {
    // 查詢 profiles 表中的 display_name 與 player_tag
    let { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, name, player_tag, faycoins")
        .eq("id", user.id)
        .maybeSingle();

    // 若 profiles 無此 ID 則發送建立
    if (!profile) {
        const defaultName = user.user_metadata?.full_name || user.email?.split("@")[0] || "新玩家";
        const { data: newProfile } = await supabase
            .from("profiles")
            .insert({ 
                id: user.id, 
                email: user.email, 
                display_name: defaultName,
                name: defaultName,
                faycoins: 0 
            })
            .select()
            .single();
        
        return newProfile;
    }

    return profile;
}

async function refreshCoins(userId) {
    const { data, error } = await supabase
        .from("profiles")
        .select("faycoins")
        .eq("id", userId)
        .maybeSingle();

    if (!error && userCoins) {
        const coins = data?.faycoins ?? 0;
        userCoins.textContent = coins;
        localStorage.setItem("faycoins", coins);
    }
}

function enableRealtime(userId) {
    if (realtimeChannel) realtimeChannel.unsubscribe();
    
    // 使用 user.id 精準監聽該使用者的變更事件
    realtimeChannel = supabase.channel(`profile-update-${userId}`)
        .on(
            "postgres_changes", 
            { 
                event: "UPDATE", 
                schema: "public", 
                table: "profiles",
                filter: `id=eq.${userId}` 
            }, 
            (payload) => {
                const updated = payload.new;
                if (!updated) return;

                // 即時更新金幣
                const newCoins = updated.faycoins ?? 0;
                if (userCoins) userCoins.textContent = newCoins;
                localStorage.setItem("faycoins", newCoins);
                
                // 即時更新 display_name
                if (userName) {
                    const newDisplayName = updated.display_name || updated.name;
                    if (newDisplayName) userName.textContent = newDisplayName;
                }

                // 即時更新 player_tag
                if (userTag) {
                    const newTag = updated.player_tag;
                    userTag.textContent = newTag ? (newTag.startsWith("#") ? newTag : `#${newTag}`) : "#------";
                }
            }
        ).subscribe();
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        location.reload();
    });
}

// 點擊空白處隱藏選單
window.addEventListener("click", () => profileMenu?.classList.add("hidden"));
profileMenu?.addEventListener("click", (e) => e.stopPropagation());

// 多分頁金幣數據同步
window.addEventListener("storage", (e) => {
    if (e.key === "faycoins" && userCoins) userCoins.textContent = e.newValue;
});

// 啟動
init();