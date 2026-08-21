// 預設備用頭像
export const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/bottts/svg?seed=FayWooooo";

// 渲染導航與 Hero 個人頭像
export function renderNavUser(user, onLogoutClick) {
    const userArea = document.getElementById("userArea");
    const profileMenu = document.getElementById("profileMenu");
    const userName = document.getElementById("userName");
    const userAvatar = document.getElementById("userAvatar");

    if (userArea) {
        userArea.innerHTML = `
            <div class="avatar-wrapper" id="avatarTrigger" style="cursor:pointer;">
                <img src="${user.avatar_url}" style="width:42px; height:42px; border-radius:50%; border:2px solid var(--primary); object-fit:cover;" referrerpolicy="no-referrer">
            </div>
        `;

        document.getElementById("avatarTrigger")?.addEventListener("click", (e) => {
            e.stopPropagation();
            profileMenu?.classList.toggle("hidden");
        });
    }

    if (userName) userName.textContent = user.name;
    if (userAvatar) {
        userAvatar.src = user.avatar_url;
        userAvatar.setAttribute("referrerpolicy", "no-referrer");
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.onclick = onLogoutClick;
    }
}

// 渲染未登入狀態
export function renderLoggedOut(onLoginClick) {
    const userArea = document.getElementById("userArea");
    if (userArea) {
        userArea.innerHTML = `
            <button id="loginBtn" class="main-btn">
                <i class="fa-brands fa-google"></i> 登入
            </button>
        `;
        document.getElementById("loginBtn")?.addEventListener("click", onLoginClick);
    }

    const profilePageName = document.getElementById("profilePageName");
    const profilePageAvatar = document.getElementById("profilePageAvatar");
    const profilePlayerTag = document.getElementById("profilePlayerTag");
    const profileBio = document.getElementById("profileBio");

    if (profilePageName) profilePageName.textContent = "未登入訪客";
    if (profilePageAvatar) profilePageAvatar.src = DEFAULT_AVATAR;
    if (profilePlayerTag) profilePlayerTag.textContent = "#訪客";
    if (profileBio) profileBio.textContent = "請先登入帳號以載入與編輯您的個人資料。";
}

// 更新 Profile 頁面上的數據顯示
export function renderProfileDisplay(data) {
    const userCoins = document.getElementById("userCoins");
    const statFayCoins = document.getElementById("statFayCoins");
    const profilePlayerTag = document.getElementById("profilePlayerTag");
    const profileBio = document.getElementById("profileBio");
    const profilePageName = document.getElementById("profilePageName");
    const profilePageAvatar = document.getElementById("profilePageAvatar");

    if (userCoins) userCoins.textContent = data.coins;
    if (statFayCoins) statFayCoins.textContent = data.coins;
    if (profilePlayerTag) profilePlayerTag.textContent = `@${data.username}`;
    if (profileBio) profileBio.textContent = data.customName;
    if (profilePageName) profilePageName.textContent = data.customName;
    if (profilePageAvatar) {
        profilePageAvatar.src = data.avatar;
        profilePageAvatar.setAttribute("referrerpolicy", "no-referrer");
    }
}

// 綁定 Edit Modal 控制邏輯
export function bindEditModalEvents({ onOpen, onSave }) {
    const editProfileBtn = document.getElementById("editProfileBtn");
    const editModal = document.getElementById("editModal");
    const saveProfileBtn = document.getElementById("saveProfileBtn");
    const cancelProfileBtn = document.getElementById("cancelProfileBtn");
    const inputPlayerTag = document.getElementById("inputPlayerTag");
    const inputBio = document.getElementById("inputBio");

    if (!editProfileBtn) return;

    editProfileBtn.onclick = () => {
        const cached = onOpen();
        if (inputPlayerTag) inputPlayerTag.value = cached?.username || "";
        if (inputBio) inputBio.value = cached?.customName || "";
        editModal?.classList.remove("hidden");
    };

    cancelProfileBtn?.addEventListener("click", () => {
        editModal?.classList.add("hidden");
    });

    saveProfileBtn?.addEventListener("click", async () => {
        if (!saveProfileBtn) return;
        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = "儲存中...";

        const newUsername = inputPlayerTag?.value.trim() || "";
        const newName = inputBio?.value.trim() || "";

        const success = await onSave(newUsername, newName);

        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = "保存設定";

        if (success) {
            editModal?.classList.add("hidden");
        }
    });
}

// Toast 通知
export function showNotify(msg, type = "success") {
    const notifications = document.querySelectorAll(".notification");
    notifications.forEach((n) => {
        n.textContent = msg;
        n.className = `notification show ${type}`;
        setTimeout(() => n.classList.remove("show"), 3000);
    });
}

// 全域空白處點擊關閉選單
window.addEventListener("click", () => {
    document.getElementById("profileMenu")?.classList.add("hidden");
});