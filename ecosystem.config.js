module.exports = {
  // PM2 is an advanced process manager for NodeJS applications that allows quickly start, control, or stop node processes
  apps: [
    {
      name: "setup pages",
      script: "./server.js",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "verifyPage",
      script: "./public/index.js",
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "loginPage",
      script: "./public/login_page/index.js",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
