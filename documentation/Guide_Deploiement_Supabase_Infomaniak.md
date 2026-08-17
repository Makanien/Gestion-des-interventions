# Guide de déploiement — Supabase auto-hébergé (Climat Elec)

**Contexte :** hébergement de l'application Climat Elec (V2, synchro Supabase) sur un VPS Infomaniak Lite (1 vCPU / 2 Go RAM / 20 Go disque, 2,70€/mois), en phase de validation du besoin.

---

## 1. Conseils généraux

### Pourquoi un VPS plutôt qu'un hébergement à la maison
- **IP dynamique** de la box internet, **coupures secteur/internet** possibles : ce sont des points de fragilité pour une appli utilisée au quotidien par les techniciens sur le terrain.
- Un VPS à quelques euros/mois élimine ces trois risques (IP fixe, uptime réseau/électrique géré par l'hébergeur) pour un coût proche de zéro.

### Ce qu'il faut retenir sur l'offre Lite (1 vCPU / 2 Go / 20 Go)
- ✅ **Suffisant pour une phase de validation** (peu de volume, test avec Régis/Jérémy/Delphine), à condition de **ne lancer que les services Supabase nécessaires**.
- ⚠️ **Trop juste pour un usage quotidien intensif en production** (Realtime + Storage + pics de synchro simultanée) — mais **le passage à une offre supérieure (4-8 Go) se fait en quelques clics** sans migration complexe : ce n'est pas un choix qui enferme.
- Le **disque (20 Go)** se remplit vite avec les photos, PDF et signatures : à surveiller dès le début.

### Bonnes pratiques à ne jamais sauter
- **Ne jamais garder les secrets par défaut** du `.env.example` (JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, mot de passe Postgres) — c'est la faille de sécurité n°1 des installations Supabase auto-hébergées.
- Toujours mettre un **reverse proxy avec HTTPS** (Traefik, Nginx ou Caddy) devant Supabase avant tout usage réel — jamais d'accès direct en HTTP sur les ports bruts.
- **Sauvegardes automatiques** de la base Postgres (`pg_dump`) et du bucket Storage (photos/signatures), avec une copie **hors du VPS** (ex. Backblaze B2, autre stockage). Une sauvegarde qui reste sur la même machine que la prod ne protège de rien en cas de problème serveur.
- Ajouter un **firewall** (`ufw`) et `fail2ban` pour protéger le SSH.
- Ajouter du **swap** (2-4 Go) sur le VPS dès le départ : avec seulement 2 Go de RAM, ça évite les plantages brutaux de Postgres (OOM-kill) en cas de pic de charge.

---

## 2. Minimum technique

| Ressource | Minimum absolu (dev/test) | Recommandé (prod légère) |
|---|---|---|
| vCPU | 1-2 | 4 |
| RAM | 2 Go | 4-8 Go |
| Disque | 10-20 Go | 25 Go+ (à surveiller selon volume photos) |
| Swap | — | 2-4 Go conseillés |

**Services Supabase à garder actifs (config minimale fonctionnelle) :**
- `db` (PostgreSQL) — le plus gourmand, prioritaire en RAM
- `kong` (API Gateway)
- `auth` (GoTrue)
- `rest` (PostgREST)
- `storage` (pour photos/signatures)
- `realtime` (si la synchro live entre techniciens est nécessaire dès maintenant)

**Services à couper/désactiver pour économiser la RAM (config par défaut, déjà exclus) :**
- `analytics` / `logflare` / `vector` (logs & analytics — non inclus par défaut, à ne pas activer)
- `edge functions` (Deno runtime) si non utilisées
- `studio` (interface d'admin) — peut être lancé ponctuellement pour administrer puis coupé, plutôt que laissé actif en continu

**Logiciels requis sur le serveur :**
- Ubuntu Server (LTS, sans interface graphique)
- Docker Engine 20.10+ et Docker Compose v2+
- Git
- Un nom de domaine (ou sous-domaine) pointant vers l'IP du VPS

---

## 3. Marche à suivre — déploiement sur le VPS Infomaniak

### Étape 1 — Provisionner le VPS
1. Créer le VPS Lite chez Infomaniak (Ubuntu Server, dernière LTS disponible).
2. Récupérer l'IP publique du VPS.
3. Chez ton registrar de domaine, créer un enregistrement DNS de type `A` (ex. `supabase.climat-elec.fr`) pointant vers cette IP.

### Étape 2 — Sécuriser l'accès de base
```bash
# Connexion initiale
ssh root@IP_DU_VPS

# Mise à jour du système
apt update && apt upgrade -y

# Outils de base + sécurité
apt install -y curl wget git ufw fail2ban htop nano unzip

# Firewall : autoriser uniquement SSH, HTTP, HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Anti-bruteforce SSH
systemctl enable fail2ban
systemctl start fail2ban
```

### Étape 3 — Installer Docker
```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

### Étape 4 — Ajouter du swap (important avec 2 Go de RAM)
```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### Étape 5 — Récupérer et configurer Supabase
```bash
mkdir -p /opt/supabase
cd /opt/supabase
git clone --depth 1 https://github.com/supabase/supabase
cp -rf supabase/docker/* .
cp supabase/docker/.env.example .env
rm -rf supabase   # on garde juste les fichiers docker
```

Éditer le `.env` et **remplacer impérativement toutes les valeurs par défaut** :
```bash
# Générer un JWT secret unique (40+ caractères)
openssl rand -base64 32

# Générer un mot de passe Postgres fort
openssl rand -base64 24
```
→ Reporter ces valeurs dans `.env` (`JWT_SECRET`, `POSTGRES_PASSWORD`, puis régénérer `ANON_KEY` et `SERVICE_ROLE_KEY` avec le script fourni par Supabase à partir du nouveau `JWT_SECRET`).

Configurer aussi dans `.env` :
- `SITE_URL` → l'URL de ton appli (ex. `https://app.climat-elec.fr`)
- `API_EXTERNAL_URL` → l'URL publique de Supabase (ex. `https://supabase.climat-elec.fr`)

### Étape 6 — Alléger le stack (optionnel mais recommandé sur 2 Go de RAM)
Dans `docker-compose.yml`, commenter/supprimer les services non indispensables au démarrage :
- `analytics`, `vector` (déjà exclus par défaut, ne pas les ajouter)
- `functions` si pas d'Edge Functions utilisées
- Laisser `studio` mais ne le démarrer qu'à la demande (`docker compose up -d studio` / `docker compose stop studio`)

### Étape 7 — Lancer Supabase
```bash
docker compose pull
docker compose up -d
docker compose ps        # vérifier que tous les conteneurs sont "healthy"
```

### Étape 8 — Mettre en place le reverse proxy + HTTPS
Utiliser Caddy (le plus simple, HTTPS automatique via Let's Encrypt) :
```bash
apt install -y caddy
```
Dans `/etc/caddy/Caddyfile` :
```
supabase.climat-elec.fr {
    reverse_proxy localhost:8000
}
```
```bash
systemctl reload caddy
```

### Étape 9 — Vérifier que tout fonctionne
```bash
curl https://supabase.climat-elec.fr/auth/v1/health
docker compose logs -f
```

### Étape 10 — Connecter l'application Climat Elec
- Dans la config de l'app (variables d'environnement / config Supabase client), remplacer l'URL et les clés par celles du VPS auto-hébergé (`API_EXTERNAL_URL`, `ANON_KEY`).
- Appliquer le schéma `supabase/schema.sql` du projet sur la base Postgres du VPS (via Studio ou `psql`).
- Tester la connexion, l'auth (lien magique), et un cycle complet de synchro offline → online.

### Étape 11 — Mettre en place les sauvegardes automatiques
```bash
# Exemple simple : dump quotidien via cron
mkdir -p /opt/supabase/backups
crontab -e
```
Ajouter une ligne cron (dump quotidien à 3h du matin) :
```
0 3 * * * docker compose -f /opt/supabase/docker-compose.yml exec -T db pg_dump -U postgres postgres > /opt/supabase/backups/backup_$(date +\%Y\%m\%d).sql
```
Puis synchroniser régulièrement `/opt/supabase/backups` vers un stockage externe (ex. `rclone` vers Backblaze B2 ou un autre espace hors du VPS).

---

## 4. Checklist avant mise en usage réel avec les techniciens

- [ ] Tous les secrets `.env` regénérés (aucune valeur par défaut restante)
- [ ] HTTPS actif et fonctionnel (pas d'accès HTTP direct)
- [ ] Firewall (`ufw`) + `fail2ban` actifs
- [ ] Swap configuré
- [ ] Sauvegardes automatiques en place **et testées** (restauration vérifiée au moins une fois)
- [ ] Espace disque surveillé (alerte si < 20% restant)
- [ ] Plan de bascule vers une offre VPS supérieure si RAM/CPU saturent
