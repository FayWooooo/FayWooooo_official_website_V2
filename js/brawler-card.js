import { supabase } from "./supabase-config.js";

// === DOM 元素選取 ===
const userArea = document.getElementById("userArea");
const profileMenu = document.getElementById("profileMenu");
const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const userIdDisplay = document.getElementById("userIdDisplay");
const copyIdBtn = document.getElementById("copyIdBtn");
const userCoins = document.getElementById("userCoins");
const logoutBtn = document.getElementById("logoutBtn");

const customModal = document.getElementById("customModal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalCloseBtn = document.getElementById("modalCloseBtn");

// 名片控制項 DOM
const inputName = document.getElementById("inputName");
const inputId = document.getElementById("inputId");
const inputBio = document.getElementById("inputBio");
const inputBioColor = document.getElementById("inputBioColor");
const inputBioSize = document.getElementById("inputBioSize");
const inputBioWeight = document.getElementById("inputBioWeight");
const inputBrawler = document.getElementById("inputBrawler");
const inputModelScale = document.getElementById("inputModelScale");
const inputModelX = document.getElementById("inputModelX");
const inputModelY = document.getElementById("inputModelY");
const charCounter = document.getElementById("charCounter");

// 卡片預覽 DOM
const cardPreview = document.getElementById("card-preview");
const cardName = document.getElementById("cardName");
const cardId = document.getElementById("cardId");
const cardAvatar = document.getElementById("cardAvatar");
const cardBio = document.getElementById("cardBio");
const cardModel = document.getElementById("cardModel");
const cardDate = document.getElementById("cardDate");
const downloadCardBtn = document.getElementById("downloadCardBtn");

let currentUser = null;

// === 1. 初始化與 Supabase Session 綁定 ===
async function init() {
    // 設置今日日期 (YYYYMMDD)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    if (cardDate) cardDate.textContent = `${year}${month}${day}`;

    // 狀態變化監聽
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUser = session.user;
            await renderHeaderProfile(currentUser);
        } else {
            currentUser = null;
            renderLoggedOut();
        }
    });

    const { data } = await supabase.auth.getSession();
    if (data?.session) {
        currentUser = data.session.user;
        await renderHeaderProfile(currentUser);
    } else {
        renderLoggedOut();
    }

    // 初始化卡片即時預覽 (維持用戶手動輸入的初始狀態)
    updateCardBasicInfo();
    updateModelTransform();
}

// === 2. 自訂 Modal 彈窗控制 ===
function showModal(title, message) {
    if (modalTitle) modalTitle.textContent = title;
    if (modalMessage) modalMessage.textContent = message;
    customModal?.classList.remove("hidden");
}

if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => customModal?.classList.add("hidden"));
}

// === 3. 僅渲染頂部導覽列與個人選單資訊（不帶入名片預覽） ===
async function renderHeaderProfile(user) {
    try {
        const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        if (error) throw error;

        // 將 Imgur 替代為本地預設圖片，防止 403 阻擋
        const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || "./images/default-avatar.png";
        const displayName = profile?.display_name || profile?.name || user.user_metadata?.full_name || "玩家";
        const rawId = profile?.player_id || profile?.player_tag || "尚未設定";

        // 渲染選單列
        if (userArea) {
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

        if (userAvatar) userAvatar.src = avatarUrl;
        if (userName) userName.textContent = displayName;
        if (userIdDisplay) userIdDisplay.textContent = rawId;
        if (userCoins) userCoins.textContent = profile?.faycoins ?? profile?.coins ?? 0;

        // 複製玩家 ID 邏輯
        if (copyIdBtn) {
            copyIdBtn.onclick = (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(rawId);
                showModal("複製成功", `已複製玩家ID：${rawId}`);
            };
        }

    } catch (err) {
        console.error("Header Profile 讀取失敗:", err);
    }
}

// 未登入 UI 處理
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
                options: { redirectTo: window.location.origin + "/favorite-brawler-card.html" },
            });
        });
    }
}

// === 4. UI 即時連動（完全由輸入框驅動） ===

// 基本姓名與玩家 ID 即時連動
function updateCardBasicInfo() {
    if (cardName && inputName) {
        cardName.textContent = inputName.value.trim() || "請輸入您的暱稱...";
    }
    if (cardId && inputId) {
        cardId.textContent = inputId.value.trim() || "請輸入您的玩家ID...";
    }
}

if (inputName) inputName.addEventListener("input", updateCardBasicInfo);
if (inputId) inputId.addEventListener("input", updateCardBasicInfo);

// 特色字樣限制邏輯：最多 5 行，單行最多 20 字，即時綁定
const MAX_LINES = 5;
const MAX_CHARS_PER_LINE = 20;

if (inputBio) {
    inputBio.addEventListener("input", (e) => {
        let lines = e.target.value.split("\n");

        if (lines.length > MAX_LINES) {
            lines = lines.slice(0, MAX_LINES);
        }

        const processedLines = lines.map(line => line.slice(0, MAX_CHARS_PER_LINE));
        const sanitizedText = processedLines.join("\n");

        if (e.target.value !== sanitizedText) {
            e.target.value = sanitizedText;
        }

        if (cardBio) {
            cardBio.innerText = sanitizedText || "請輸入您的特色字樣...";
        }
        if (charCounter) {
            charCounter.textContent = `${processedLines.length}/${MAX_LINES} 行`;
        }
    });
}

// 文字樣式動態調控
if (inputBioColor) inputBioColor.addEventListener("input", (e) => { if (cardBio) cardBio.style.color = e.target.value; });
if (inputBioSize) inputBioSize.addEventListener("input", (e) => { if (cardBio) cardBio.style.fontSize = `${e.target.value}px`; });
if (inputBioWeight) inputBioWeight.addEventListener("change", (e) => { if (cardBio) cardBio.style.fontWeight = e.target.value; });

// 英雄立繪變形調整
function updateModelTransform() {
    if (!cardModel) return;
    if (inputBrawler) cardModel.src = inputBrawler.value;
    const scale = inputModelScale?.value || 1;
    const x = inputModelX?.value || 0;
    const y = inputModelY?.value || 0;
    cardModel.style.transform = `scale(${scale}) translate(${x}px, ${y}px)`;
}

if (inputBrawler) inputBrawler.addEventListener("change", updateModelTransform);
if (inputModelScale) inputModelScale.addEventListener("input", updateModelTransform);
if (inputModelX) inputModelX.addEventListener("input", updateModelTransform);
if (inputModelY) inputModelY.addEventListener("input", updateModelTransform);

// === 5. HTML-to-Image 高畫質圖片導出 ===
if (downloadCardBtn) {
    downloadCardBtn.addEventListener("click", async () => {
        downloadCardBtn.disabled = true;
        downloadCardBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 圖片生成中...`;

        try {
            const dataUrl = await htmlToImage.toPng(cardPreview, { 
                pixelRatio: 2,
                cacheBust: true,
                skipFonts: true, // 1. 忽略找不到或跨域的字型
                fetchRequestInit: {
                    mode: 'cors', // 2. 強制以 cors 模式抓取圖片
                },
                filter: (node) => {
                    // 3. 過濾掉載入失敗或有問題的 img 標籤（避免無效的 payload 丟進 canvas）
                    if (node.tagName === 'IMG') {
                        return node.complete && node.naturalWidth !== 0;
                    }
                    return true;
                }
            });

            const fileName = inputName?.value.trim() ? inputName.value.trim() : 'Player';
            const link = document.createElement("a");
            link.download = `Brawler-Card-${fileName}.png`;
            link.href = dataUrl;
            link.click();

            showModal("成功", "英雄名片已成功導出 PNG！");
        } catch (err) {
            console.error("Export Error:", err);
            showModal("導出失敗", "無法產出圖片，請檢查 HTML 中的圖片路徑是否包含無效網址。");
        } finally {
            downloadCardBtn.disabled = false;
            downloadCardBtn.innerHTML = `<i class="fa-solid fa-download"></i> 導出高畫質名片 (PNG)`;
        }
    });
}
// 點擊空白處隱藏選單
window.addEventListener("click", () => profileMenu?.classList.add("hidden"));
if (profileMenu) profileMenu.addEventListener("click", (e) => e.stopPropagation());

if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        location.reload();
    });
}

// 啟動專案
init();