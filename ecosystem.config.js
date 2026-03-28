module.exports = {
  apps: [
    {
      name: 'hub7-server',
      script: 'npm',
      args: 'run dev',
      instances: 1, // Only 1 instance recommended due to WhatsApp Baileys session handling
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
