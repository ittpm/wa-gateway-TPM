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
      env_file: '/opt/wa-gateway-TPM/backend-bun/.env',
      env: {
        NODE_ENV: 'development',
        PORT: 9090,
        HOST: '0.0.0.0',
        DB_TYPE: 'postgres',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        DB_USER: 'wagatewayuser',
        DB_PASSWORD: 'wagateway2024',
        DB_NAME: 'wagateway'
      }
    },
    {
      name: 'wa-gateway-frontend',
      script: 'node_modules/.bin/serve',
      args: ['-s', 'dist', '-l', '9000'],
      cwd: '/opt/wa-gateway-TPM/frontend',
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
};
