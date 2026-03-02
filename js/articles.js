import { supabase } from "./supabase-config.js";

const API_URL = "https://wcqutexugvrgnyusnkpv.supabase.co/functions/v1/articles";
const loader = document.getElementById("loader");
const listView = document.getElementById("listView");
const detailView = document.getElementById("detailView");
const listContent = document.getElementById("listContent");

// 控制載入畫面顯示
function setLoading(isLoading) {
    loader.style.display = isLoading ? "block" : "none";
    if (isLoading) {
        listView.style.display = "none";
        detailView.style.display = "none";
    }
}

// --- 核心修改：API 請求與 401 攔截 ---
async function fetchData(action, body = {}) {
    setLoading(true);
    try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;

        const res = await fetch(API_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": token ? `Bearer ${token}` : ""
            },
            body: JSON.stringify({ action, ...body })
        });

        if (res.status === 401) {
            alert("請先登入後再閱讀文章！");
            window.location.href = "index.html";
            return null;
        }

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "請求失敗");
        return result;
    } catch (err) {
        console.error("API 請求發生錯誤:", err.message);
        return { articles: [], success: false };
    } finally {
        setLoading(false);
    }
}

// --- 載入列表 ---
async function loadArticles() {
    const res = await fetchData("listArticles");
    if (!res) return; // 401 已跳轉

    listView.style.display = "block";
    if (!res.articles || res.articles.length === 0) {
        listContent.innerHTML = `<p style="color: #888; padding: 20px;">尚無文章內容</p>`;
        return;
    }

    listContent.innerHTML = res.articles.map(art => `
        <div class="card article-card" onclick="goToArticle('${art.id}')" style="cursor:pointer">
            <h3 style="margin:0; color:#ffff00;">${art.title}</h3>
            <p style="font-size:0.95rem; color:#ccc; margin: 12px 0;">${art.summary || '點擊閱讀全文...'}</p>
            <div style="font-size: 0.8rem; color: #666;">
                <i class="fa-regular fa-calendar"></i> ${new Date(art.created_at).toLocaleDateString()}
            </div>
        </div>
    `).join('');
}

// --- 載入詳情 ---
async function loadDetail(id) {
    const res = await fetchData("getArticle", { articleId: id });
    if (!res) return; // 401 已跳轉

    if (!res.success) {
        alert(res?.error || "無法載入文章");
        goHome();
        return;
    }

    detailView.style.display = "block";
    document.getElementById("artTitle").innerText = res.article.title;
    document.getElementById("artDate").innerText = new Date(res.article.created_at).toLocaleDateString();
    document.getElementById("artContent").innerHTML = res.article.content; 
}

// --- 路由與事件繫結 (必須繫結在 window 上供 HTML onclick 使用) ---
window.goToArticle = (id) => {
    window.history.pushState({ id }, "", `?id=${id}`);
    loadDetail(id);
};

window.goHome = () => {
    window.history.pushState({}, "", "articles.html");
    loadArticles();
};

window.onpopstate = () => router();

async function router() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
        await loadDetail(id);
    } else {
        await loadArticles();
    }
}

// 啟動路由
router();