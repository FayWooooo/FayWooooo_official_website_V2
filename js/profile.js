import { supabase } from "./supabase-config.js";

// DOM 元素選取 (完全對齊你的 HTML ID，已移除 title 相關)
const userArea = document.getElementById("userArea");
const profileMenu = document.getElementById("profileMenu");
const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const userTag = document.getElementById("userTag");
const copyTagBtn = document.getElementById("copyTagBtn");
const userCoins = document.getElementById("userCoins");
const logoutBtn = document.getElementById("logoutBtn");

const profileForm = document.getElementById("profileForm");
const playerNameInput = document.getElementById("playerName");
const playerTagInput = document.getElementById("playerTag");
const contactInfoInput = document.getElementById("contactInfo");
const submitBtn = document.querySelector(".tm-submit-btn");

// 自訂彈窗 DOM
const customModal = document.getElementById("customModal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalCloseBtn = document.getElementById("modalCloseBtn");

let realtimeChannel = null;
let currentUser = null;

// === 1. 初始化與 Session 監聽 ===
async function init() {
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUser = session.user;
            await fetchAndRenderProfile(currentUser);
        } else {
            currentUser = null;
            renderLoggedOut();
        }
    });

    const { data } = await supabase.auth.getSession();
    if (data.session) {
        currentUser = data.session.user;
        await fetchAndRenderProfile(currentUser);
    } else {
        renderLoggedOut();
    }
}

// === 2. 自訂彈窗控制 ===
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

// === 3. 從 Supabase 讀取資料並渲染至 UI ===
async function fetchAndRenderProfile(user) {
    try {
        await ensureProfile(user);

        // 從 Supabase profiles 撈取所有資料
        const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        if (error) throw error;

        // 1. 導覽列頭像觸發器
        if (userArea) {
            const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || "https://i.imgur.com/4M34hi2.png";
            userArea.innerHTML = `
                <div class="avatar-wrapper" id="avatarTrigger" style="cursor:pointer;">
                    <img src="${avatarUrl}" style="width:42px; height:42px; border-radius:50%; border:2px solid var(--primary);">
                </div>
            `;

            document.getElementById("avatarTrigger")?.addEventListener("click", (e) => {
                e.stopPropagation();
                profileMenu?.classList.toggle("hidden");
            });
        }

        // 2. 渲染名片內容 (頭像、名稱)
        if (userAvatar) userAvatar.src = profile?.avatar_url || user.user_metadata?.avatar_url || "https://i.imgur.com/4M34hi2.png";
        if (userName) userName.textContent = profile?.display_name || profile?.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "玩家";

        // 3. 🎯 讀取 player_id / player_tag 並渲染至 #userTag
        const rawPlayerId = profile?.player_id || profile?.player_tag;
        const formattedTag = rawPlayerId 
            ? (rawPlayerId.startsWith("#") ? rawPlayerId : `${rawPlayerId}`) 
            : "尚未設定";

        if (userTag) userTag.textContent = formattedTag;

        // 4. 🎯 一鍵複製 player_id 邏輯
        if (copyTagBtn) {
            const newCopyBtn = copyTagBtn.cloneNode(true);
            copyTagBtn.parentNode?.replaceChild(newCopyBtn, copyTagBtn);

            newCopyBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (!rawPlayerId) {
                    showModal("提示", "您尚未設定玩家標籤 ID！");
                    return;
                }
                navigator.clipboard.writeText(formattedTag).then(() => {
                    showModal("複製成功", `已複製玩家標籤：${formattedTag}`);
                }).catch(() => {
                    showModal("複製失敗", "瀏覽器不支援剪貼簿功能。");
                });
            });
        }

        // 5. 🎯 金幣渲染（相容檢查 + 防 null/falsy 導致顯示 --）
        let coinsAmount = 0;
        if (profile) {
            if (typeof profile.faycoins === "number") coinsAmount = profile.faycoins;
            else if (typeof profile.coins === "number") coinsAmount = profile.coins;
            else if (profile.faycoins !== undefined && profile.faycoins !== null) coinsAmount = Number(profile.faycoins) || 0;
            else if (profile.coins !== undefined && profile.coins !== null) coinsAmount = Number(profile.coins) || 0;
        }

        if (userCoins) userCoins.textContent = coinsAmount;

        // 6. 表單預設值 (如果在 setting.html 頁面時生效)
        if (playerNameInput) playerNameInput.value = profile?.display_name || profile?.name || user.user_metadata?.full_name || "";
        if (playerTagInput) playerTagInput.value = rawPlayerId || "";
        if (contactInfoInput) contactInfoInput.value = profile?.contact_info || "";

        toggleFormState(false, `<i class="fa-solid fa-floppy-disk"></i> 儲存個人資料`);

        // 開啟 Realtime 監聽
        enableRealtime(user.id);

    } catch (err) {
        console.error("❌ 從 Supabase 讀取資料失敗:", err);
        showModal("載入失敗", "無法從伺服器讀取個人資料。");
    }
}

// 未登入 UI
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
    if (userCoins) userCoins.textContent = "0";
    toggleFormState(true, "請先登入帳號");
}

// === 4. 表單提交（同步寫入 player_id 與 player_tag 相容欄位） ===
if (profileForm) {
    profileForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!currentUser) {
            showModal("權限錯誤", "請先完成帳號登入。");
            return;
        }

        if (submitBtn) submitBtn.disabled = true;

        try {
            const tagValue = playerTagInput?.value.trim() || "";
            const { error } = await supabase
                .from("profiles")
                .update({
                    display_name: playerNameInput?.value,
                    player_id: tagValue,
                    player_tag: tagValue, // 同步寫入確保兩邊欄位相容
                    contact_info: contactInfoInput?.value,
                    updated_at: new Date().toISOString()
                })
                .eq("id", currentUser.id);

            if (error) {
                showModal("保存失敗", error.message || "資料庫寫入失敗。");
            } else {
                showModal("更新成功", "您的個人資料已成功保存至雲端！");
                await fetchAndRenderProfile(currentUser);
            }
        } catch (err) {
            showModal("連線失敗", "無法連線至 Supabase，請稍後再試。");
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
    });
}

// 鎖定/解鎖表單
function toggleFormState(disabled, buttonText) {
    if (playerNameInput) playerNameInput.disabled = disabled;
    if (playerTagInput) playerTagInput.disabled = disabled;
    if (contactInfoInput) contactInfoInput.disabled = disabled;
    if (submitBtn) {
        submitBtn.disabled = disabled;
        submitBtn.innerHTML = buttonText;
    }
}

// === 5. Supabase Profile 確保與 Realtime 監聽 ===
async function ensureProfile(user) {
    const { data: existing } = await supabase.from("profiles").select("id, faycoins").eq("id", user.id).maybeSingle();
    
    if (!existing) {
        await supabase.from("profiles").insert({
            id: user.id,
            email: user.email,
            display_name: user.user_metadata?.full_name || "",
            avatar_url: user.user_metadata?.avatar_url || "",
            faycoins: 0
        });
    } else if (existing.faycoins === null || existing.faycoins === undefined) {
        // 如果舊帳號的 faycoins 欄位是空值，自動修復為 0
        await supabase.from("profiles").update({ faycoins: 0 }).eq("id", user.id);
    }
}

function enableRealtime(userId) {
    if (realtimeChannel) realtimeChannel.unsubscribe();
    realtimeChannel = supabase.channel("profiles-realtime")
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, (payload) => {
            const newCoins = payload.new?.faycoins ?? payload.new?.coins ?? 0;
            if (userCoins) userCoins.textContent = newCoins;
            if (userName && (payload.new?.display_name || payload.new?.name)) {
                userName.textContent = payload.new.display_name || payload.new.name;
            }
            const tag = payload.new?.player_id || payload.new?.player_tag;
            if (userTag && tag) {
                userTag.textContent = tag.startsWith("#") ? tag : `#${tag}`;
            }
        }).subscribe();
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

// 啟動
init();