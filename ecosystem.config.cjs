// PM2 process config — UAT backend.
// Start:   pm2 start ecosystem.config.cjs
// Logs:    pm2 logs gbt-backend-uat        (live tail)
// Reload:  pm2 reload ecosystem.config.cjs --update-env
// Status:  pm2 status / pm2 monit
module.exports = {
  apps: [
    {
      name: 'gbt-backend-uat',
      script: 'src/server.js',
      cwd: __dirname,
      instances: 1, // single instance — in-process cron jobs + socket.io must not double-run
      exec_mode: 'fork',
      autorestart: true,
      watch: false, // redeploys go through deploy.sh -> pm2 reload (don't file-watch a server)
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
      },
      time: true,
      merge_logs: true,
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
