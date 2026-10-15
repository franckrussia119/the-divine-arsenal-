# École de disciples · The Divine Arsenal Corporation
# Site statique servi par nginx. La configuration Supabase est écrite au démarrage
# à partir des variables d'environnement SUPABASE_URL et SUPABASE_ANON_KEY (Coolify).
FROM nginx:1.27-alpine

COPY . /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /docker-entrypoint.d/40-app-config.sh

# Corrige les fins de ligne Windows éventuelles, rend le script exécutable,
# et retire du site public les fichiers qui n'ont rien à y faire.
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-app-config.sh /etc/nginx/conf.d/default.conf \
 && chmod +x /docker-entrypoint.d/40-app-config.sh \
 && rm -rf /usr/share/nginx/html/docker /usr/share/nginx/html/Dockerfile \
           /usr/share/nginx/html/supabase /usr/share/nginx/html/README.md \
           /usr/share/nginx/html/.git /usr/share/nginx/html/.gitignore /usr/share/nginx/html/.dockerignore

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
