// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

const { ipcRenderer } = require("electron");

let castBtn = document.getElementById("cast-btn");

// 监听投屏设备菜单点击
ipcRenderer.on("cast-device", (event, args) => {
  if (args) {
    castBtn.className = "stop-cast";
    castBtn.setAttribute("title", "StopCast");
    // 开始投屏
    ipcRenderer.send("start-cast", args);
  }
});

// 点击停止投屏按钮
ipcRenderer.on("click-stop", () => {
  if (confirm("确定停止投屏吗？")) {
    castBtn.className = "start-cast";
    castBtn.setAttribute("title", "StartCast");
    // 停止投屏
    ipcRenderer.send("stop-cast");
  }
});

// 禁用右键菜单
window.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  ipcRenderer.send("window-drag", false);
});

// 拖动
castBtn.addEventListener("mousedown", () => {
  ipcRenderer.send("mouse-down");
});
castBtn.addEventListener("mouseup", () => {
  ipcRenderer.send("mouse-up", castBtn.getAttribute("title"));
});
