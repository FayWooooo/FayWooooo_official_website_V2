import { supabase } from "./supabase-config.js";

const API_URL = "https://wcqutexugvrgnyusnkpv.supabase.co/functions/v1/rewards";

// 用來儲存動態資料的 Map
const rewardDataMap = new Map();

// 核心功能整合
async function initShop() {
    const user = await checkUser();
    if (!user) return;

    const avatarImgs = document.querySelectorAll(".nav-avatar");
    avatarImgs.forEach(img => {
        img.src = user.avatar_url || "https://i.imgur.com/4M34hi2.png";
        img.style.display = "block";
    });

    await loadFaycoins(user);
    await loadDailyRewards(user);
    await loadChainRewards(user);
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

// 餘額顯示
async function loadFaycoins(user) {
    const { data } = await supabase.from("profiles").select("faycoins").eq("email", user.email).maybeSingle();
    const displays = document.querySelectorAll(".coin-display");
    displays.forEach(d => d.textContent = `${data?.faycoins ?? 0}`);
    return data?.faycoins ?? 0;
}

// 累積登入邏輯
async function loadDailyRewards(user) {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.token}` },
        body: JSON.stringify({ action: "getStreakInfo", email: user.email })
    });
    const data = await res.json();
    
    const streaks = data.streaksArray || []; 
    const today = new Date().toISOString().split('T')[0];

    const containers = document.querySelectorAll(".daily-reward-list");
    containers.forEach(container => {
        container.innerHTML = streaks.map(day => `
            <div class="reward-day ${day.isClaimed ? 'claimed' : ''}">
                <small class="day-label">Day ${day.day}</small>
                <div class="icon-wrapper"><i class="fa-solid ${day.isClaimed ? 'fa-circle-check' : 'fa-coins'}"></i></div>
                <small class="reward-text">${day.rewardText || '15'}</small>
            </div>
        `).join("");
    });

    const claimBtns = document.querySelectorAll(".claim-daily-btn");
    claimBtns.forEach(btn => {
        if (data.lastLogin === today) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> 今日已領';
            btn.classList.add("btn-disabled");
        } else {
            btn.disabled = false;
            btn.innerHTML = '領取今日獎勵';
            btn.classList.remove("btn-disabled");
            
            // 綁定事件
            btn.onclick = () => claimDailyReward(user);
        }
    });
}

// 核心：連鎖禮包
async function loadChainRewards(user) {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.token}` },
        body: JSON.stringify({ action: "listChainRewards", email: user.email })
    });
    const data = await res.json();
    const lists = document.querySelectorAll(".chain-reward-list");
    
    lists.forEach(list => {
        list.innerHTML = data.chains.map((c, i) => {
            const isLocked = c.isLocked; 
            const isClaimed = c.isClaimed;
            
            // 將資料存入 Map，使用索引作為暫時 Key
            const dataKey = `chain_${i}`;
            rewardDataMap.set(dataKey, c);

            return `
                <div class="chain-item ${isClaimed ? 'claimed' : (isLocked ? 'locked' : 'unlocked')}">
                    <div class="chain-step">${isClaimed ? '✓' : i + 1}</div>
                    <div class="chain-info">
                        <strong>${c.title}</strong><br>
                        <small class="price-text"><i class="fa-solid fa-coins"></i> ${c.price}</small><br>
                        ${isLocked 
                            ? '<span class="lock-info">🔒 後台鎖定中</span>' 
                            : (isClaimed ? '<span class="claimed-text">已領取</span>' : '<span class="ready-text">✅ 可購買</span>')}
                    </div>
                    
                    <button class="main-btn chain-action-btn ${isLocked ? 'btn-locked' : ''}" 
                        data-key="${dataKey}"
                        ${isClaimed || isLocked ? 'disabled' : ''}>
                        ${isClaimed ? '已領取' : (isLocked ? '🔒 鎖定' : '兌換')}
                    </button>
                </div>
            `;
        }).join("");

        // 綁定連鎖禮包按鈕事件
        list.querySelectorAll(".chain-action-btn").forEach(btn => {
            btn.addEventListener("click", function() {
                const dataKey = this.getAttribute("data-key");
                const reward = rewardDataMap.get(dataKey);
                if(reward) handleChainAction(reward.id, reward.title, reward.price);
            });
        });
    });
}

// 領取連鎖禮包邏輯
async function handleChainAction(id, title, price) {
    const user = await checkUser();
    if(!user) return;
    if(!confirm(`確認消耗 ${price} Fay幣 購買「${title}」？`)) return;

    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.token}` },
        body: JSON.stringify({ action: "buyChainReward", email: user.email, chainId: id })
    });
    const data = await res.json();
    
    if (data.success) {
        showNotify(`🎉 購買成功：${title}`);
        initShop(); 
    } else {
        showNotify(data.error || "購買失敗", "error");
    }
}

// 一般商品
async function loadNormalRewards(user) {
    const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.token}` },
        body: JSON.stringify({ action: "listRewards", email: user.email })
    });
    const data = await res.json();
    const containers = document.querySelectorAll(".reward-list-container");
    
    containers.forEach(container => {
        container.innerHTML = data.rewards.map((r, i) => {
            // 將資料存入 Map
            const dataKey = `normal_${i}`;
            rewardDataMap.set(dataKey, r);

            return `
                <div class="reward-card">
                    <div class="card-info"><strong>${r.title}</strong><br><small class="price-text"><i class="fa-solid fa-coins"></i> ${r.price}</small></div>
                    <button class="main-btn buy-normal-btn" data-key="${dataKey}">購買</button>
                </div>
            `;
        }).join("");

        // 綁定購買按鈕事件
        container.querySelectorAll(".buy-normal-btn").forEach(btn => {
            btn.addEventListener("click", function() {
                const dataKey = this.getAttribute("data-key");
                const reward = rewardDataMap.get(dataKey);
                if(reward) buyNormal(reward.id, reward.title, reward.price);
            });
        });
    });
}

// 購買一般商品
async function buyNormal(id, title, price) {
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
    const notifications = document.querySelectorAll(".notification");
    notifications.forEach(n => {
        n.textContent = msg;
        n.className = `notification show ${type}`;
        setTimeout(() => n.classList.remove("show"), 3000);
    });
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
