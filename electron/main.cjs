const { app, BrowserWindow } = require('electron');
const path = require('path');

// P2P i WebRTC mrežni switch-evi
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('allow-insecure-localhost');
app.commandLine.appendSwitch('disable-site-isolation-trials');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    autoHideMenuBar: true,
    title: "Gospodari Magije",
    resizable: true,
    useContentSize: true,
    show: false, // Ne prikazuj prozor dok se sve ne učita da ne pobegne fokus
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true, // Vraćamo na true da Chromium ne blokira form-inputs (🚫 cursor bug)
      allowRunningInsecureContent: true,
      experimentalFeatures: true
    },
  });

  mainWindow.maximize();

  // Precizno ucitavanje za zapakovanu (.exe) i razvojnu verziju
  if (app.isPackaged) {
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Kada je prozor spreman, prikaži ga i osiguraj fokus za tastaturu
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});