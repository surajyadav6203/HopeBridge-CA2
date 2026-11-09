const SUPABASE_URL = "https://udcgwzjnwwpcfbkdrotf.supabase.co";

const SUPABASE_KEY = "sb_publishable_kyQEzx1h3nQLdr_kph5MWg_fFU3vko3";

window.hopebridgeSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);
