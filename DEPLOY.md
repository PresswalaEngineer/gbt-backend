# GBT Backend — UAT deployment (PM2 on VPS)

## Service facts
- **Port:** `4000` (env `PORT`)
- **Context path / base URL:** `/api/v1` (env `API_PREFIX`) → e.g. `https://uat-gbt-be.thehashtagindiacorp.com/api/v1`
- **CORS:** `*` (allow all) for UAT — set `CORS_ORIGINS=*` (origins are reflected so cookies still work)
- **Process manager:** PM2, single instance (in-process cron + socket.io must not double-run)

## First-time setup on the VPS
```bash
# 1. Clone
git clone https://github.com/PresswalaEngineer/gbt-backend.git
cd gbt-backend

# 2. Create .env  (copy your existing .env, then override the UAT bits below)
nano .env

# 3. First deploy + seed admin/sample data
SEED=1 bash deploy.sh
```

## UAT `.env` overrides (everything else stays the same as your current .env)
```
NODE_ENV=production              # use 'development' if the host is plain HTTP (secure cookies need HTTPS)
PORT=4000
API_PREFIX=/api/v1
PUBLIC_BASE_URL=https://uat-gbt-be.thehashtagindiacorp.com
STOREFRONT_URL=https://uat-gbt-be.thehashtagindiacorp.com
CORS_ORIGINS=*
DATABASE_URL=postgresql://global_bus_tour_uat:Test%40123@uat-gbt-be.thehashtagindiacorp.com:5432/global_bus_tour_uat
```

## Day-to-day
```bash
bash deploy.sh                 # pull + install + prisma generate + db push + pm2 reload
pm2 logs gbt-backend-uat       # live logs
pm2 status                     # process state
pm2 monit                      # live CPU/mem dashboard
pm2 startup && pm2 save        # run once so PM2 restarts on server reboot
```

Schema is applied with `prisma db push` (syncs the DB to `schema.prisma` exactly — UAT-friendly).
