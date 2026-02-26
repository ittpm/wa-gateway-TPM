module.exports = {
  apps: [
    {
      name: 'wa-gateway-backend',
      script: 'src/index.ts',
      interpreter: '/root/.bun/bin/bun',
      cwd: '/opt/wa-gateway-TPM/backend-bun',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 9090,
        HOST: '0.0.0.0'
      }
    },
    {
      name: 'wa-gateway-frontend',
      script: '/usr/bin/serve',
      args: '-s dist -l tcp://0.0.0.0:9000',
      cwd: '/opt/wa-gateway-TPM/frontend',
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
};
