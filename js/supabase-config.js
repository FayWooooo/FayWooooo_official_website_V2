import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://wcqutexugvrgnyusnkpv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjcXV0ZXh1Z3ZyZ255dXNua3B2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyODc4MDQsImV4cCI6MjA3Njg2MzgwNH0.wJ0b1M6D2RatN726L6sXeKwuB0uwf51zYJZwi2Dv5sQ";

// 建立 client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
});

// ✅ 關鍵：掛載到 window，解決 undefined 問題
window.supabase = supabase;
