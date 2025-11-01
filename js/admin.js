// ✅ 綁定 supabase-config.js
import { supabase } from "./supabase-config.js";

// ✅ Supabase Edge Functions URL
const baseUrl = "https://wcqutexugvrgnyusnkpv.supabase.co/functions/v1/admin";
const generateVoucherUrl = "https://wcqutexugvrgnyusnkpv.supabase.co/functions/v1/generate_vouchers";

// 抓取前端 HTML 元素
const adminPanel = document.getElementById("adminPanel");
const accessDenied = document.getElementById("accessDenied");
const adminContent = document.getElementById("adminContent");

// =====================================
// ✅ 初始化後台
// =====================================
async function initAdmin() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  const token = data.session?.access_token;

  if (!user || !token) {
    showDenied("⚠️ 請先登入 Google 帳號。");
    return;
  }

  // 從 Edge Function 驗證是否為 admin
  const authRes = await fetch(baseUrl + "?action=auth", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`, // ✅ 用 supabase-config 的 token
    },
    body: JSON.stringify({ email: user.email }),
  });

  const authData = await authRes.json();

  if (!authRes.ok || !authData.success) {
    showDenied("❌ 你沒有管理員權限。");
    return;
  }

  // ✅ 顯示後台
  adminContent.style.display = "block";
  adminPanel.classList.remove("hidden");

  // 初始化功能
  loadNotifications(user.email, token);
  setupActions(user.email, token);
  setupVoucherActions(user.email, token);

  const refreshBtn = document.getElementById("refreshNotifications");
  if (refreshBtn)
    refreshBtn.addEventListener("click", () => loadNotifications(user.email, token));
}

// =====================================
// ❌ 權限不足顯示
// =====================================
function showDenied(message) {
  adminContent.style.display = "none";
  accessDenied.style.display = "block";
  accessDenied.textContent = message || "❌ 你沒有管理員權限。";
}

// =====================================
// ⚙️ 綁定按鈕事件
// =====================================
function setupActions(adminEmail, token) {
  const addCoin = document.getElementById("addCoin");
  const reduceCoin = document.getElementById("reduceCoin");
  const resetCoin = document.getElementById("resetCoin");
  const publishNewsBtn = document.getElementById("publishNews");
  const addRewardBtn = document.getElementById("addReward");

  if (addCoin) addCoin.addEventListener("click", () => handleCoinOperation(adminEmail, token, "add"));
  if (reduceCoin) reduceCoin.addEventListener("click", () => handleCoinOperation(adminEmail, token, "subtract"));
  if (resetCoin) resetCoin.addEventListener("click", () => handleCoinOperation(adminEmail, token, "setZero"));
  if (publishNewsBtn) publishNewsBtn.addEventListener("click", () => publishNews(adminEmail, token));
  if (addRewardBtn) addRewardBtn.addEventListener("click", () => addReward(adminEmail, token));
}

// =====================================
// 🎯 Fay 幣操作
// =====================================
async function handleCoinOperation(adminEmail, token, mode) {
  const targetEmail = document.getElementById("targetEmail").value.trim();
  const coinAmount = parseInt(document.getElementById("coinAmount").value || "0");

  if (!targetEmail && mode !== "setZero") {
    alert("請輸入玩家 Email！");
    return;
  }

  if ((mode === "add" || mode === "subtract") && (isNaN(coinAmount) || coinAmount <= 0)) {
    alert("請輸入有效的 Fay 幣數量！");
    return;
  }

  try {
    const resp = await fetch(baseUrl + "?action=updateCoins", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: adminEmail,
        targetEmail,
        mode,
        amount: coinAmount,
      }),
    });

    const result = await resp.json();
    if (result.success) {
      alert(`✅ Fay 幣操作成功！（${mode === "add" ? "增加" : mode === "subtract" ? "減少" : "歸零"}）`);
      await loadNotifications(adminEmail, token);
    } else {
      alert(`❌ 操作失敗：${result.error || "未知錯誤"}`);
    }
  } catch (err) {
    console.error("❌ 請求失敗：", err);
    alert("⚠️ 系統錯誤，請稍後再試。");
  }
}

// =====================================
// ✍️ 公告管理
// =====================================
async function publishNews(email, token) {
  const content = document.getElementById("newsContent").value.trim();
  if (!content) return alert("請輸入公告內容！");

  const res = await fetch(baseUrl + "?action=addNews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ email, content }),
  });

  const result = await res.json();
  alert(result.success ? "✅ 公告已發布" : `❌ 發布失敗：${result.error}`);
  await loadNotifications(email, token);
}

// =====================================
// 🏆 新增獎勵
// =====================================
async function addReward(email, token) {
  const title = document.getElementById("rewardTitle").value.trim();
  const description = document.getElementById("rewardDesc").value.trim();
  const price = parseInt(document.getElementById("rewardPrice").value.trim());

  if (!title || isNaN(price)) {
    alert("請輸入完整的獎勵名稱與價格！");
    return;
  }

  const res = await fetch(baseUrl + "?action=addReward", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ email, title, description, price }),
  });

  const data = await res.json();
  alert(data.success ? "✅ 獎勵已新增" : `❌ 失敗：${data.error}`);
  await loadNotifications(email, token);
}

// =====================================
// 🔔 系統通知
// =====================================
async function loadNotifications(adminEmail, token) {
  const list = document.getElementById("notificationList");
  if (!list) return;

  list.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 載入中...`;

  try {
    const res = await fetch(baseUrl + "?action=getNotifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ email: adminEmail }),
    });

    const data = await res.json();
    if (!data.success) {
      list.innerHTML = `<p style="color:red;">❌ 無法取得通知：${data.error}</p>`;
      return;
    }

    if (data.notifications.length === 0) {
      list.innerHTML = "<p>📭 暫無通知。</p>";
      return;
    }

    list.innerHTML = data.notifications
      .map(
        (n) => `
        <div class="notify-item">
          <b>[${n.type}]</b> ${n.message}
          <div class="notify-time">${new Date(n.created_at).toLocaleString()}</div>
        </div>`
      )
      .join("");
  } catch (err) {
    console.error("loadNotifications 錯誤:", err);
    list.innerHTML = `<p style="color:red;">❌ 載入失敗，請稍後再試。</p>`;
  }
}

// =====================================
// 🎟️ Voucher 生成功能（綁 supabase-config）
// =====================================
function setupVoucherActions(adminEmail, token) {
  const btn = document.getElementById("createVoucher");
  const list = document.getElementById("voucherList");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const count = Number(document.getElementById("voucherCount").value);
    const adminKey = document.getElementById("adminKey").value.trim();

    if (!count || count < 1 || count > 10) return alert("請輸入 1~10");
    if (!adminKey) return alert("請輸入管理金鑰");

    btn.disabled = true;
    btn.textContent = "生成中...";

    try {
      const resp = await fetch(generateVoucherUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ count, created_by: adminEmail }),
      });
      
      const data = await resp.json();
      console.log("🔍 Voucher Response:", data); // ← 加這行
      
      if (data.success) {
        console.log("📦 Codes:", data.codes);
      
        list.innerHTML = "";
        data.codes.forEach((c) => {
          const code = typeof c === "string" ? c : c.code;
          const url = typeof c === "string"
            ? `https://officialfaywooooo.vercel.app/voucher/${c}`
            : c.url || `https://officialfaywooooo.vercel.app/voucher/${c.code}`;
      
          const li = document.createElement("li");
          li.innerHTML = `<a href="${url}" target="_blank" style="color:#6cf;">${code}</a>`;
          li.style.background = "rgba(255,255,255,0.1)";
          li.style.padding = "8px 10px";
          li.style.borderRadius = "6px";
          li.style.margin = "4px 0";
      
          const copyBtn = document.createElement("button");
          copyBtn.textContent = "複製連結";
          copyBtn.style.marginLeft = "10px";
          copyBtn.onclick = () => {
            navigator.clipboard.writeText(url);
            copyBtn.textContent = "✅ 已複製";
            setTimeout(() => (copyBtn.textContent = "複製連結"), 2000);
          };
      
          li.appendChild(copyBtn);
          list.appendChild(li);
        });
      }
      
      
       else {
        alert(data.error || "生成失敗");
      }
    } catch (e) {
      console.error("❌ Voucher 請求錯誤:", e);
      alert("⚠️ 生成失敗，請稍後再試。");
    }

    btn.disabled = false;
    btn.textContent = "生成代碼";
  });
}

// =====================================
// 🚀 啟動
// =====================================
initAdmin();
document.body.style.visibility = "visible";
