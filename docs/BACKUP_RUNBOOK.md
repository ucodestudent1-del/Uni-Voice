# Production Backup & Restore Runbook

## Automated Backups
- **Frequency**: Daily at 00:00 UTC via the `backup` service in `docker-compose.yml`
- **Retention**: 14 daily, 8 weekly, 6 monthly
- **Storage**: `/backups` volume in the `backup_data` Docker volume (bind-mount to host for offsite copies)

## Restoring a Backup

### 1. List available backups
```bash
docker compose exec backup ls -lh /backups/
```

### 2. Restore from a specific backup
```bash
# Stop the web service to prevent writes
docker compose stop web

# Restore (replace <backup_file> with actual filename)
docker compose exec backup pg_restore --dbname=postgresql://postgres:postgres@db:5432/invoice_prod /backups/<backup_file>

# Restart services
docker compose up -d
```

### 3. Verify restoration
```bash
curl -f http://localhost/api/health
```

## Manual On-Demand Backup
```bash
docker compose exec db pg_dump -U postgres invoice_prod > backup_$(date +%Y%m%d_%H%M%S).sql
```
