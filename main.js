// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, Menu, screen } = require("electron");
const child_process = require("child_process");
const path = require("path");
const Store = require("electron-store");
const log = require("electron-log");
const store = new Store();
const sudo = require("sudo-prompt");
const func = require("./functions");

let mainWindow;
let windowPosition;
async function createWindow() {
  // Create the browser window.
  let display = screen.getPrimaryDisplay();
  mainWindow = new BrowserWindow({
    width: 32,
    height: 29,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    x: display.workAreaSize.width - 100,
    y: 100,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  await mainWindow.loadFile("index.html");

  // 保存窗口初始位置
  windowPosition = mainWindow.getPosition();

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// 获取程序安装路径
const arch = process.arch;
let keyPaths = [
  `HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall`,
];
if (arch === "x64") {
  keyPaths.push(
    `HKEY_LOCAL_MACHINE\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall`
  );
}

let programDir = "";

// 清除缓存
// store.clear();
if (!store.has("program")) {
  // 遍历注册表中两个程序安装目录项，取得AirPinPcSender的实际安装目录
  keyPaths.forEach((value) => {
    child_process.exec(`reg query ${value}`, (error, stdout, stderr) => {
      if (error) {
        log.error(`get program reg error: ${error}`);
        log.error(`get program reg stdout: ${stdout}`);
        log.error(`get program reg stderr: ${stderr}`);
        func.tips(stderr, "获取AirPinPcSender注册表信息失败");
      } else {
        let programs = stdout.split("\r\n");
        for (let program of programs) {
          if (program.indexOf("AirPinPcSender") !== -1) {
            child_process.exec(
              `reg query ${program} /v DisplayIcon`,
              (error1, stdout1, stderr1) => {
                if (error1) {
                  log.error(`get program dir error: ${error1}`);
                  log.error(`get program dir stdout: ${stdout1}`);
                  log.error(`get program dir stderr: ${stderr1}`);
                  func.tips(stderr1, "获取AirPinPcSender安装目录失败");
                } else {
                  let programInfo = stdout1.split("\r\n");
                  for (let info of programInfo) {
                    // 正则表达式：/[C-F]:\\.+AirPinPcSender.exe/gm
                    let regex = new RegExp(
                      `[C-F]:\\\\.+AirPinPcSender.exe`,
                      "gm"
                    );

                    let matches = regex.exec(info);
                    if (matches) {
                      let programPath = matches[0];
                      programDir = programPath.substr(
                        0,
                        programPath.lastIndexOf("\\") + 1
                      );
                      // 写入配置信息
                      log.info("program.dir:" + programDir);
                      store.set("program.dir", programDir);

                      // 获取投屏设备信息
                      func.getDevices(programDir);

                      // 获取投屏流媒体网址
                      console.log("4");
                      func.getStreamUrl(
                        path.join(programDir, "_AirPinPcSender.log")
                      );
                    }
                  }
                }
              }
            );
          }
        }
      }
    });
  });
}

// 开始投屏
ipcMain.on("start-cast", (event, args) => {
  log.info("start-cast event was triggered");
  func.startCast(store.get("program.cmd"), args, store.get("stream"));
});

// 停止投屏（通过使用CurrPorts关闭AirPinPcSender.exe的TCP连接来实现）
ipcMain.on("stop-cast", () => {
  log.info("stop-cast event was triggered");
  let command =
    path.join(__dirname, "vendor", "CurrPorts", `cports_${arch}.exe`) +
    " /close * * * * AirPinPcSender.exe";
  log.info(`stop cast command: ${command}`);
  sudo.exec(command, { name: "Electron" }, (error, stdout, stderr) => {
    if (error) {
      log.error(`stop cast error: ${error}`);
      log.error(`stop cast stdout: ${stdout}`);
      log.error(`stop cast stderr: ${stderr}`);
      func.tips(stderr, "停止投屏失败");
    }
  });
});

// 鼠标按下
let movingInterval;
ipcMain.on("mouse-down", () => {
  log.info("mouse-down event was triggered");
  windowPosition = mainWindow.getPosition();
  let winStartPosition = { x: windowPosition[0], y: windowPosition[1] };
  let mouseStartPosition = screen.getCursorScreenPoint();
  // 清除定时器
  if (movingInterval) {
    clearInterval(movingInterval);
  }
  // 新开定时器
  movingInterval = setInterval(() => {
    // 实时更新位置
    let cursorPosition = screen.getCursorScreenPoint();
    let x = winStartPosition.x + cursorPosition.x - mouseStartPosition.x;
    let y = winStartPosition.y + cursorPosition.y - mouseStartPosition.y;
    mainWindow.setPosition(x, y, true);
  }, 10);
});

// 鼠标弹起
ipcMain.on("mouse-up", (event, args) => {
  log.info("mouse-up event was triggered");
  // 清除定时器
  clearInterval(movingInterval);
  movingInterval = null;
  // 如果窗口位置没有发生变化则触发点击事件
  const currentWindowPosition = mainWindow.getPosition();
  if (
    windowPosition[0] === currentWindowPosition[0] &&
    windowPosition[1] === currentWindowPosition[1]
  ) {
    log.info("mouse-up event become click event");
    if (args === "StartCast") {
      log.info("begin start cast");
      // 判断AirPinPcSender.exe是否运行
      child_process.exec(
        'tasklist | find "AirPinPcSender.exe"',
        (error, stdout, stderr) => {
          if (error) {
            log.error(`get tasklist error: ${error}`);
            log.error(`get tasklist stdout: ${stdout}`);
            log.error(`get tasklist stderr: ${stderr}`);
            func.tips("获取运行程序列表失败");
          } else {
            if (!stdout) {
              log.error("AirPinPcSender is not running");
              func.tips("AirPinPcSender没有运行");
            } else {
              // 每次投屏都重新获取投屏设备和流媒体地址
              let programDir = store.get("program.dir");
              func.getDevices(programDir);
              log.info("regain devices");
              func.getStreamUrl(path.join(programDir, "_AirPinPcSender.log"));
              log.info("regain stream");
              if (!store.has("stream") || !store.get("stream")) {
                log.error("stream is empty");
                func.tips("请先手动执行一下AirPin投屏操作");
              } else {
                let devNames = store.get("devices");
                // 如果只有一个设备则直接开始投屏，否则显示菜单
                if (devNames.length > 0) {
                  if (devNames.length === 1) {
                    event.sender.send("cast-device", devNames[0]);
                  } else {
                    let contextTemplate = [];
                    for (let devName of devNames) {
                      contextTemplate.push({
                        label: devName,
                        click: () => {
                          event.sender.send("cast-device", devName);
                        },
                      });
                    }
                    const menu = Menu.buildFromTemplate(contextTemplate);
                    menu.popup(BrowserWindow.fromWebContents(event.sender));
                  }
                }
              }
            }
          }
        }
      );
    } else if (args === "StopCast") {
      log.info("begin stop cast");
      event.sender.send("click-stop");
    }
  }
});
