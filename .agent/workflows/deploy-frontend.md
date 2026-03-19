---
description: Deploy perubahan frontend ke production
---

// turbo-all

## Deploy Frontend WA Gateway

Frontend menggunakan **Vite** dan di-serve dari folder `dist` (static build).
Setiap ada perubahan kode di folder `frontend/src/`, wajib build ulang dulu agar perubahan terlihat di browser.

### Langkah-langkah:

1. Masuk ke folder frontend dan build:
```bash
cd /opt/wa-gateway-TPM/frontend && npm run build
```

2. Restart PM2 agar serve dari `dist` yang baru:
```bash
pm2 restart 3
```

3. (Opsional) Push ke GitHub:
```bash
git -C /opt/wa-gateway-TPM add -A && git -C /opt/wa-gateway-TPM commit -m "feat: update frontend" && git -C /opt/wa-gateway-TPM push
```

---

> ⚠️ **PENTING**: Jangan hanya `pm2 restart 4` tanpa build terlebih dahulu — perubahan tidak akan terlihat karena server masih serve file lama dari `dist/`.
