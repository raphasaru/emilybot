module.exports = {
  apps: [
    { name: 'emilybot', script: 'src/index.js' },
    { name: 'dashboard', script: 'npm', args: 'start', cwd: './dashboard' },
  ],
};
