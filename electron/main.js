const { app, BrowserWindow, protocol, Menu } = require('electron');
const path = require('path');
const { fileURLToPath } = require('url');
const fs = require('fs');

function resolveWindowIcon(isDev) {
  const candidatePaths = isDev
    ? [
        path.resolve(__dirname, 'build', 'icons', 'icon.png'),
        path.resolve(__dirname, 'build', 'icons', 'icon.ico'),
        path.resolve(__dirname, 'build', 'icons', 'png', '512x512.png')
      ]
    : [
        path.join(process.resourcesPath, 'icons', 'icon.png'),
        path.join(process.resourcesPath, 'icons', '512x512.png')
      ];
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return undefined;
}

function createMainWindow() {
  const isDev = !app.isPackaged;
  const iconPath = resolveWindowIcon(isDev);

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    autoHideMenuBar: process.platform === 'win32',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (process.platform === 'win32') {
    try {
      mainWindow.setMenuBarVisibility(false);
      Menu.setApplicationMenu(null);
    } catch (_) {}
  }

  if (isDev) {
    const devIndex = path.resolve(__dirname, '..', 'site', 'index.html');
    mainWindow.loadFile(devIndex);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const prodIndex = path.join(process.resourcesPath, 'site', 'index.html');
    mainWindow.loadFile(prodIndex);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  const isDev = !app.isPackaged;
  const siteDir = isDev
    ? path.resolve(__dirname, '..', 'site')
    : path.join(process.resourcesPath, 'site');

  protocol.interceptFileProtocol('file', (request, callback) => {
    const url = request.url;

    // 1) 真实路径存在则直接返回（mac 常见 file:///.../site/...）
    try {
      const realPath = path.normalize(fileURLToPath(url));
      if (fs.existsSync(realPath)) {
        callback({ path: realPath });
        return;
      }
    } catch (_) {}

    // 2) 从任意位置截取资源前缀，映射到打包内 site 目录（兼容 Windows 的 file:///D:/circuitjs1/...）
    try {
      const { pathname: rawPathname } = new URL(url);
      let pathname = decodeURIComponent(rawPathname || '');
      const prefixes = ['/circuitjs1/', '/img/', '/font/'];
      let sliceIndex = -1;
      for (const prefix of prefixes) {
        const i = pathname.indexOf(prefix);
        if (i !== -1) { sliceIndex = i; break; }
      }
      if (sliceIndex !== -1) {
        const subPath = pathname.slice(sliceIndex).replace(/^\/+/, '');
        const mapped = path.normalize(path.join(siteDir, subPath));
        callback({ path: mapped });
        return;
      }
    } catch (_) {}

    // 3) 兜底去掉 scheme
    const stripped = url.replace(/^file:\/\/+/, '');
    callback({ path: path.normalize(stripped) });
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 