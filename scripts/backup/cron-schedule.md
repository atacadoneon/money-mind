# Cron Schedule — Backup & Manutenção

## Instalação

Adicionar ao crontab do servidor (staging e prod):

```bash
crontab -e
```

## Schedule recomendado

```cron
# Backup diário às 3am (UTC)
0 3 * * * /app/scripts/backup/pg_backup.sh >> /var/log/mm-backup.log 2>&1

# Restore drill mensal — primeiro domingo do mês, 4am
0 4 1-7 * 0 /app/scripts/backup/restore-drill.sh >> /var/log/mm-restore-drill.log 2>&1

# Limpar logs antigos de backup (>30 dias)
0 5 * * 0 find /var/log -name "mm-backup*.log" -mtime +30 -delete
```

## Para Render.com

Render não tem cron nativo para scripts shell. Opções:

### Opção A: GitHub Actions mensal
```yaml
# .github/workflows/backup-drill.yml
on:
  schedule:
    - cron: '0 4 1 * *'  # Primeiro dia do mês, 4am UTC
```
Ver `.github/workflows/backup-drill.yml` para implementação completa.

### Opção B: Render Cron Job
Criar serviço Render do tipo "Cron Job":
- Build Command: `apt-get install -y postgresql-client awscli`
- Start Command: `bash scripts/backup/pg_backup.sh`
- Schedule: `0 3 * * *`

### Opção C: EasyCron / cron-job.org
- URL para acionar via HTTP trigger (endpoint protegido)

## Alertas

Configurar alerta se o cron não executar em 25h:
- Healthchecks.io (free tier)
- ou Sentry Cron Monitoring

## Verificação manual

```bash
# Verificar último backup em S3:
aws s3 ls s3://BUCKET/db-backups/ | sort | tail -5

# Verificar tamanho do último backup:
aws s3 ls s3://BUCKET/db-backups/ --recursive --human-readable | sort | tail -1
```
