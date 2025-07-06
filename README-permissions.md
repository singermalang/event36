# Permissions Setup for Dockerized Event App

Agar aplikasi berjalan lancar dan tidak error permission saat generate/upload file di Docker, lakukan langkah berikut di host (sebelum build/deploy):

```sh
sudo chown -R $(id -u):$(id -g) ./public/certificates ./public/uploads ./public/tickets
sudo chmod -R 755 ./public/certificates ./public/uploads ./public/tickets
```

- **Jalankan perintah di atas di folder project Anda.**
- Pastikan folder `public/certificates`, `public/uploads`, dan `public/tickets` sudah ada.
- Setelah itu, build dan jalankan Docker seperti biasa:

```sh
docker compose down
docker compose up --build -d
```

Dengan cara ini, permission akan selalu benar dan aplikasi tidak error saat menulis file di dalam container.

# Docker Build & Run Otomatis (Event Manager)

## Build & Jalankan Semua Service

1. **Build dan jalankan fresh semua container:**
   ```sh
   docker-compose down -v
   docker-compose build --no-cache
   docker-compose up -d
   ```

2. **Cek status semua container:**
   ```sh
   docker ps -a
   ```

3. **Akses aplikasi:**
   - App: http://localhost:3000 (atau IP server Anda)
   - phpMyAdmin: http://localhost:8080 (user: root, pass: bismillah123)

## Troubleshooting Koneksi Redis/DB

- **Pastikan semua container di network yang sama:**
  ```sh
  docker network ls
  docker network inspect event36_event-network
  ```
- **Tes koneksi dari dalam container app:**
  ```sh
  docker exec -it <app-container-id> sh
  ping redis
  nc -zv redis 6379
  ping db
  nc -zv db 3306
  ```
- **Cek log error:**
  ```sh
  docker-compose logs app
  docker-compose logs redis
  docker-compose logs db
  ```

## Catatan Penting
- Jangan tambahkan/override `REDIS_HOST` atau `DB_HOST` di file `.env` kecuali ingin custom.
- Semua ENV koneksi sudah otomatis diatur di `docker-compose.yml`.
- Folder output (uploads, certificates, tickets) sudah otomatis dibuat dan permission sudah benar.

---

**Setelah langkah di atas, semua service akan otomatis saling terkoneksi dan aplikasi siap digunakan.** 