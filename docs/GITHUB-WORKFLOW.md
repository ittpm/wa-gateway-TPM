# Panduan Workflow GitHub: Windows ke Linux Server

Dokumen ini berisi panduan lengkap untuk sinkronisasi kode dari komputer Anda (Windows) ke server Production (Linux) menggunakan GitHub.

---

## 🏗️ Persiapan Awal di Server Linux (Hanya 1x Saja)

Saat pertama kali memindahkan aplikasi ke Server Linux yang masih kosong, ikuti langkah ini:

### 1. Install Kebutuhan Server (Misal di Ubuntu)
```bash
# Install Curl & Git
sudo apt update && sudo apt install -y curl git unzip

# Install Node.js (V20)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Bun
curl -fsSL https://bun.sh/install | bash
# Muat ulang bash agar Bun bisa dipakai
source ~/.bashrc

# Install PM2 & Serve
sudo npm install -g pm2 serve
```

### 2. Download Kode dari GitHub ke Server
Masuk ke direktori aplikasi Anda (contoh di `/opt`):
```bash
cd /opt

# Mulai download dari Github
git clone https://github.com/GanishaMGN/wa-gateway-TPM.git

# Masuk ke foldernya
cd wa-gateway-TPM
```

### 3. Setup File Sensitif yang Tidak Ikut Terupload (.env & Database)
Karena `.env` dan `database` disembunyikan dari publik demi keamanan, Anda harus membuatnya di Linux:
```bash
cd backend-bun

# Copy contoh file .env
cp .env.example .env

# Edit .env dengan nano dan masukkan PORT, JWT_SECRET, dll
nano .env

# Instalasi library backend
bun install
```

### 4. Build Frontend
Kembali ke folder `frontend` lalu install dan build:
```bash
cd ../frontend
npm install
npm run build
```

### 5. Jalankan Semuanya via PM2
Kembali ke folder utama `wa-gateway-TPM`:
```bash
cd ..

# Jalankan backend dan frontend menggunakan konfigurasi ecosystem.config.js
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 🔄 Cara Update Kode Jika Ada Perubahan Bug/Fitur

Kapanpun Anda sudah selesai *coding* di laptop Windows Anda dan kode dirasa sudah OK, ikuti langkah ini untuk mengonline-kannya:

### 💻 Langkah DILAKUKAN DI LAPTOP WINDOWS ANDA
Buka terminal/Command Prompt di folder project `wa-gateway` Anda, lalu jalankan:

```bash
# Tambahkan semua perubahan file
git add .

# Beri pesan perubahan (Contoh: "fix bug error login")
git commit -m "Catatan/Keterangan apa yang Anda ubah"

# Upload ke GitHub
git push
```
> *Tunggu sampai proses upload mencapai 100% dan berhasil.*

---

### 🌐 Langkah DILAKUKAN DI SERVER LINUX ANDA
Login ke console/SSH server Linux Anda, lalu:

```bash
# Masuk ke folder aplikasi
cd /opt/wa-gateway-TPM

# Tarik kode terbaru dari GitHub ke Server Linux
git pull origin main

# (Opsional) JIKA yang berubah HANYA Frontend (Tampilan UI)
# Maka Anda harus build ulang frontend-nya di Linux
cd frontend
npm run build
# Dan tidak perlu direstart. Selesai.


# (Opsional) JIKA yang berubah adalah fitur Backend Backend-bun
# Maka Anda perlu merestart backend agar membaca kode baru
pm2 restart wa-gateway-backend
```

### 🛠️ Pertanyaan Sering Ditanya (FAQ)

**Q: Bagaimana jika saya menambahkan Library Backend baru di Windows (`bun install nama-lib`)?**  
**A:** Di laptop Windows, `commit` dan `push` kodenya seperti biasa. Ketika di Server Linux Anda sudah menjalankan `git pull origin main`, jangan lupa masuk ke folder `backend-bun` lalu jalankan **`bun install`** sebelum mengetik `pm2 restart wa-gateway-backend`.

**Q: Error saat Git Pull mengatakan ada perubahan lokal yang belum di-commit?**  
**A:** Artinya Anda atau sistem sempat mengubah file secara langsung di Server Linux (biasanya `bun.lockb` atau cache). Cukup lewati perubahan di Linux dan paksa ikuti GitHub dengan:
```bash
git reset --hard
git pull origin main
```
