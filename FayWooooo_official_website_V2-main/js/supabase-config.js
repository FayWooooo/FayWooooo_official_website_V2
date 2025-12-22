// =====================================
// ✅ FayWooooo - Supabase 初始化設定（支援跨頁登入狀態）
// =====================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ⚙️ 用你的 Supabase 專案資訊
const SUPABASE_URL = "https://wcqutexugvrgnyusnkpv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcXV0ZXh1Z3ZyZ255dXNua3B2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyODc4MDQsImV4cCI6MjA3Njg2MzgwNH0.wJ0b1M6D2RatN726L6sXeKwuB0uwf51zYJZwi2Dv5sQ";

// ✅ 建立 Supabase client（開啟 session 保存）
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,   // ✅ 讓登入狀態在 localStorage 保存
    autoRefreshToken: true, // ✅ token 到期會自動刷新
    detectSessionInUrl: true // ✅ 支援 OAuth 登入後的 URL callback
  },
});
