import { supabase } from "./supabase-config.js";

const API_URL = "https://wcqutexugvrgnyusnkpv.supabase.co/functions/v1/rewards";

// 核心功能整合
async function initShop() {
    const user = await checkUser();
    if (!user) return;

    // 1. 更新頭像 (對應新版 Nav)
    const avatarImg = document.getElementById("navAvatar");
    if (avatarImg) {
        avatarImg.src = user.avatar_url || "https://i.imgur.com/4M34hi2.png";
        avatarImg.style.display = "block";
    }

    // 2. 載入各項資料
    await loadFaycoins(user);
    await loadDailyRewards(user);
    await loadChainRewards(user); // 這裡包含後台控制的鎖定邏輯
    await loadNormalRewards(user);
}

// 檢查並獲取 Session
async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        alert("請先登入！");
        window.location.href = "index.html";
        return null;
    }
    return { 
        email: session.user.email, 
        token: session.access_token, 
        id: session.user.id,
        avatar_url: session.user.user_metadata.avatar_url
    };
}

// 餘額顯示 (對應新版 Nav ID)
async function loadFaycoins(user) {
    const { data } = await supabase.from("profiles").select("faycoins").eq("email", user.email).maybeSingle();
    const display = document.getElementById("coinDisplay");
    if(display) display.textContent = `${data?.faycoins ?? 0}`;
    return data?.faycoins ?? 0;
}

// 累積登入邏輯 - 改為從資料庫讀取狀態
async function loadDailyRewards(user) {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.token}` },
        body: JSON.stringify({ action: "getStreakInfo", email: user.email })
    });
    const data = await res.json();
    
    // streaksArray 應由後端回傳正確狀態，包含 [{day: 1, isClaimed: true, rewardText: '15'}, ...]
    const streaks = data.streaksArray || []; 
    const today = new Date().toISOString().split('T')[0];

    const container = document.getElementById("dailyRewardList");
    if(!container) return;
    
    // 渲染簽到天數卡片
    container.innerHTML = streaks.map(day => `
        <div class="reward-day ${day.isClaimed ? 'claimed' : ''}">
            <small>Day ${day.day}</small>
            <div><i class="fa-solid ${day.isClaimed ? 'fa-circle-check' : 'fa-coins'}"></i></div>
            <small>${day.rewardText || '15'}</small>
        </div>
    `).join("");

    // 設定簽到按鈕狀態
    const claimBtn = document.getElementById("claimDaily");
    if (claimBtn) {
        if (data.lastLogin === today) {
            claimBtn.disabled = true;
            claimBtn.innerHTML = '<i class="fa-solid fa-check"></i> 今日已領';
        } else {
            claimBtn.disabled = false;
            claimBtn.innerHTML = '領取今日獎勵';
            claimBtn.onclick = () => claimDailyReward(user);
        }
    }
}

// 核心：連鎖禮包 (受後台控制 + 需要Fay幣)
async function loadChainRewards(user) {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.token}` },
        body: JSON.stringify({ action: "listChainRewards", email: user.email })
    });
    const data = await res.json();
    const list = document.getElementById("chainRewardList");
    
    if(!list) return;

    list.innerHTML = data.chains.map((c, i) => {
        // c.isLocked 由後台控制
        // c.isClaimed 由資料庫記錄
        // c.price 需要 Fay 幣
        const isLocked = c.isLocked; 
        const isClaimed = c.isClaimed;

        return `
            <div class="chain-item ${isClaimed ? 'claimed' : (isLocked ? 'locked' : 'unlocked')}">
                <div class="chain-step">${isClaimed ? '✓' : i + 1}</div>
                <div style="flex:1">
                    <strong>${c.title}</strong><br>
                    <small><i class="fa-solid fa-coins"></i> ${c.price}</small><br>
                    ${isLocked 
                        ? '<span class="lock-info">🔒 後台鎖定中</span>' 
                        : (isClaimed ? '<span style="color:#00ff88">已領取</span>' : '<span style="color:var(--primary)">✅ 可購買</span>')}
                </div>
                
                <button class="main-btn" 
                    onclick="handleChainAction('${c.id}', '${c.title}', ${c.price})" 
                    ${isClaimed || isLocked ? 'disabled' : ''}
                    style="${isLocked ? 'background:#333; color:#777;' : ''}">
                    ${isClaimed ? '已領取' : (isLocked ? '🔒 鎖定' : '兌換')}
                </button>
            </div>
        `;
    }).join("");
}

// 領取連鎖禮包邏輯 (改為幣換)
window.handleChainAction = async (id, title, price) => {
    const user = await checkUser();
    if(!user) return;

    // 確認購買
    if(!confirm(`確認消耗 ${price} Fay幣 購買「${title}」？`)) return;

    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.token}` },
        body: JSON.stringify({ action: "buyChainReward", email: user.email, chainId: id })
    });
    const data = await res.json();
    
    if (data.success) {
        showNotify(`🎉 購買成功：${title}`);
        initShop(); // 刷新頁面狀態與餘額
    } else {
        showNotify(data.error || "購買失敗", "error");
    }
};

// 一般商品
async function loadNormalRewards(user) {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.token}` },
        body: JSON.stringify({ action: "listRewards", email: user.email })
    });
    const data = await res.json();
    const container = document.getElementById("rewardList");
    if(!container) return;
    
    container.innerHTML = data.rewards.map(r => `
        <div class="reward-card">
            <div><strong>${r.title}</strong><br><small><i class="fa-solid fa-coins"></i> ${r.price}</small></div>
            <button class="main-btn" onclick="buyNormal('${r.id}', '${r.title}', ${r.price})">購買</button>
        </div>
    `).join("");
}

// 購買一般商品
window.buyNormal = async (id, title, price) => {
    const user = await checkUser();
    if(!user) return;
    
    if(!confirm(`確認消耗 ${price} Fay幣 購買「${title}」？`)) return;

    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.token}` },
        body: JSON.stringify({ action: "buyReward", email: user.email, rewardId: id })
    });
    const data = await res.json();
    
    if(data.success) {
        showNotify(`購買成功：${title}`);
        initShop();
    } else {
        showNotify(data.error || "購買失敗", "error");
    }
}

// 通知功能
function showNotify(msg, type = "success") {
    const n = document.getElementById("notification");
    if(!n) return;
    n.textContent = msg;
    n.className = `notification show ${type}`;
    setTimeout(() => n.classList.remove("show"), 3000);
}

// 領取每日獎勵
async function claimDailyReward(user) {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.token}` },
        body: JSON.stringify({ action: "claimDaily", email: user.email })
    });
    const data = await res.json();
    if(data.success) {
        showNotify("領取成功！");
        initShop();
    } else {
        showNotify(data.error || "領取失敗", "error");
    }
}

// 啟動
initShop();