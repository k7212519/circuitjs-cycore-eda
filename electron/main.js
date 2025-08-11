const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    const devIndex = path.resolve(__dirname, '..', 'site', 'index.html');
    mainWindow.loadFile(devIndex);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const prodIndex = path.join(process.resourcesPath, 'site', 'index.html');
    mainWindow.loadFile(prodIndex);
  }
}

app.whenReady().then(() => {
  const isDev = !app.isPackaged;
  const siteDir = isDev
    ? path.resolve(__dirname, '..', 'site')
    : path.join(process.resourcesPath, 'site');

  protocol.interceptFileProtocol('file', (request, callback) => {
    try {
      const urlObj = new URL(request.url);
      const pathname = decodeURIComponent(urlObj.pathname);
      if (pathname.startsWith('/img/') || pathname.startsWith('/circuitjs1/')) {
        const resolvedPath = path.join(siteDir, pathname.slice(1));
        callback({ path: resolvedPath });
        return;
      }
    } catch (err) {
      // ignore
    }
    try {
      const fallbackPath = decodeURIComponent(new URL(request.url).pathname);
      callback({ path: fallbackPath });
    } catch (e) {
      callback({ path: request.url.replace('file://', '') });
    }
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