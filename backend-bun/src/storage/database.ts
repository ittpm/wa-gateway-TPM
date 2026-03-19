/**
 * database.ts - Re-export dari database-pg.ts (PostgreSQL)
 *
 * File SQLite (bun:sqlite) sudah tidak digunakan.
 * Aplikasi sekarang menggunakan PostgreSQL secara penuh.
 *
 * Semua import ke 'database.js' tetap berfungsi karena
 * file ini meneruskan (re-export) semua dari database-pg.ts.
 */
export { Database } from './database-pg.js';
