import { logger } from './logger.js';

/**
 * Kill process yang menggunakan port tertentu (Windows & Linux/Mac)
 */
export async function killProcessOnPort(port: number): Promise<boolean> {
  try {
    // Windows
    if (process.platform === 'win32') {
      const { execSync } = await import('child_process');

      // Cari PID yang menggunakan port
      try {
        const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
        const lines = result.trim().split('\n');

        const pids = new Set<number>();
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const pid = parseInt(parts[4], 10);
            if (!isNaN(pid) && pid > 0) {
              pids.add(pid);
            }
          }
        }

        // Kill setiap PID
        for (const pid of pids) {
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            logger.info(`Killed process ${pid} on port ${port}`);
          } catch {
            // Ignore kill errors
          }
        }

        return pids.size > 0;
      } catch {
        return false;
      }
    } else {
      // Linux/Mac
      const { execSync } = await import('child_process');
      try {
        execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
        logger.info(`Killed process on port ${port}`);
        return true;
      } catch {
        return false;
      }
    }
  } catch (error) {
    logger.error('Error killing process:', error);
    return false;
  }
}

/**
 * Cek apakah port sedang digunakan
 */
export async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const tester = net.createServer()
      .once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      })
      .once('listening', () => {
        tester.close();
        resolve(false);
      })
      .listen(port);
  });
}

/**
 * Bersihkan port sebelum start server dengan retry
 */
export async function cleanupPort(port: number, maxRetries: number = 3): Promise<void> {
  logger.info(`Checking port ${port}...`);

  for (let i = 0; i < maxRetries; i++) {
    if (await isPortInUse(port)) {
      logger.warn(`Port ${port} is in use (attempt ${i + 1}/${maxRetries}). Cleaning up...`);
      await killProcessOnPort(port);

      // Tunggu lebih lama agar port benar-benar bebas (Windows butuh waktu lebih)
      await new Promise(resolve => setTimeout(resolve, 3000));

      if (!(await isPortInUse(port))) {
        logger.info(`Port ${port} is now free`);
        return;
      }
    } else {
      logger.info(`Port ${port} is available`);
      return;
    }
  }

  logger.error(`Failed to free port ${port} after ${maxRetries} attempts.`);
  logger.error(`Please run: taskkill /F /IM bun.exe`);
  logger.error(`Or restart your computer.`);
  process.exit(1);
}

/**
 * Start server dengan retry jika port masih in use
 */
export async function startServerWithRetry(
  app: any,
  port: number,
  host: string,
  maxRetries: number = 5
): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const server = await new Promise<any>((resolve, reject) => {
        const srv = app.listen(port, host, () => {
          logger.info(`🚀 Server running on http://${host}:${port}`);
          logger.info(`📚 API Documentation: http://${host}:${port}/api/v1`);
          resolve(srv);
        });

        // Slowloris Protection
        srv.keepAliveTimeout = 30000; // 30s
        srv.headersTimeout = 31000;   // 31s (Must be > keepAliveTimeout)
        srv.timeout = 30000;          // 30s socket timeout

        srv.on('error', (err: any) => {
          if (err.code === 'EADDRINUSE') {
            logger.warn(`Port ${port} is still in use (listen attempt ${i + 1}/${maxRetries})`);
            srv.close();
            reject(err);
          } else {
            reject(err);
          }
        });
      });
      return server; // Success
    } catch (err: any) {
      if (err.code === 'EADDRINUSE' && i < maxRetries - 1) {
        logger.info(`Waiting 3 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Force kill lagi
        await killProcessOnPort(port);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw err;
      }
    }
  }
}
