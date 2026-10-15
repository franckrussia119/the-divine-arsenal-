#!/bin/sh
# Écrit js/config.js à partir des variables d'environnement définies dans Coolify.
cat > /usr/share/nginx/html/js/config.js <<CFG
window.APP_CONFIG = { supabaseUrl: "${SUPABASE_URL:-}", supabaseAnonKey: "${SUPABASE_ANON_KEY:-}" };
CFG
