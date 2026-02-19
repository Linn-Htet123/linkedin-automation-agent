const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // For simple IPC if needed
    },
  });

  // Load the frontend (Next.js dev server or built static files)
  const startUrl = process.env.ELECTRON_START_URL || "http://localhost:3000";

  mainWindow.loadURL(startUrl);

  mainWindow.on("closed", function () {
    mainWindow = null;
  });
}

function startBackend() {
  const backendPath = path.join(__dirname, "..", "backend");
  console.log("Starting backend from:", backendPath);

  // Spawn the backend process
  // We use 'npm run dev' for now to keep it simple in dev mode
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  backendProcess = spawn(npmCmd, ["run", "dev"], {
    cwd: backendPath,
    shell: true,
    env: { ...process.env, PORT: 3001 }, // Ensure backend runs on 3001 if needed, or default
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`Backend: ${data}`);
  });

  backendProcess.stderr.on("data", (data) => {
    console.error(`Backend Error: ${data}`);
  });

  backendProcess.on("close", (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

app.on("ready", () => {
  startBackend();
  // Wait a bit for backend to start
  setTimeout(() => {
    createWindow();
  }, 3000);
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", function () {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on("will-quit", () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
