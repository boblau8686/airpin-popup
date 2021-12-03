const fs = require("fs");
const { Notification } = require("electron");
const Store = require("electron-store");
const child_process = require("child_process");
const log = require("electron-log");
const iconv = require("iconv-lite");
const ini = require("ini");
const store = new Store();

const func = {
  /**
   * 显示提示
   */
  tips(msg, title = "提示") {
    let notification = new Notification({
      title: title,
      body: iconv.encode(msg, "gbk"),
    });
    notification.show();
  },
  /**
   * 获取设备信息
   */
  getDevices(programDir) {
    let programDrive = programDir.substr(0, programDir.indexOf(":") + 1);
    let cmdPath = `${programDrive} && cd ${programDir} && AirPinShellCmd.exe`;
    log.info(`program cmd path: ${cmdPath}`);
    store.set("program.cmd", cmdPath);
    let devNames = [];
    /*
     获取设备信息的命令：AirPinShellCmd.exe -getdev
     命令输出内容格式如下：
     [DEVLIST]
     ATV[172.18.0.64],172.18.0.64
     [PLAYSTATE]
     ATV[172.18.0.64]**1|0|0*0
     [SETTINGS]
     CM:1,DM:1,VS:2,AE:0,LP:0,NM:0,SR:0,RC:0,FD:0,DD:0,RR:1,MF:0,NT:0,KU:1.0C:\Program Files (x86)\AirPinPcSender.0_R120729_B1939,DN:
     [VERSION]
     2.5.0
     */
    child_process.exec(`${cmdPath} -getdev`, (error, stdout, stderr) => {
      if (error) {
        log.error(`getdev error: ${error}`);
        log.error(`getdev stdout: ${stdout}`);
        log.error(`getdev stderr: ${stderr}`);
        this.tips(stderr, "获取投屏设备信息失败");
      } else {
        let devInfos = ini.parse(stdout);
        for (let section in devInfos) {
          if (section === "DEVLIST") {
            for (let devInfo of Object.keys(devInfos[section])) {
              devNames.push(devInfo.split(",")[0]);
            }
            break;
          }
        }
        store.set("devices", devNames);
      }
    });
  },
  /**
   * 获取投屏播放流媒体地址
   * @param logFile
   * @returns string
   */
  getStreamUrl(logFile) {
    let streamUrl = "";
    let expStr =
      /http:\/\/[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}.[0-9]{1,3}:55550\/waxmirror-[0-9a-zA-Z]+\.flv/;
    let matches;
    fs.readFile(logFile, "utf16le", (err, data) => {
      if (err) {
        log.error(`read log file error: ${err}`);
        this.tips(err, "获取本机屏幕镜像失败");
      } else {
        let lines = data.split("\r\n");
        for (let line of lines) {
          matches = expStr.exec(line);
          if (matches !== null) {
            streamUrl = matches[0];
          }
        }
        if (!streamUrl) {
          this.tips("请先手动执行一下AirPin投屏操作");
        } else {
          log.info(`stream url: ${streamUrl}`);
          store.set("stream", streamUrl);
        }
      }
    });
  },

  /**
   * 开始投屏
   * 使用AirPinPcSender目录下的AirPinShellCmd.exe程序启动投屏
   * 投屏命令：AirPinShellCmd.exe 设备名 http://本机IP:55550/waxmirror-16位数字字母字符串.flv
   * @param cmdPath AirPinShellCmd.exe程序的绝对路径
   * @param devName 投屏设备名称
   * @param stream 屏幕映射流媒体地址
   */
  startCast(cmdPath, devName, stream) {
    log.info(`start cast command: ${cmdPath} ${devName} ${stream}`);
    child_process.exec(
      `${cmdPath} ${devName} ${stream}`,
      (error, stdout, stderr) => {
        if (error) {
          log.error(`AirPinShellCmd error: ${error}`);
          log.error(`AirPinShellCmd stdout: ${stdout}`);
          log.error(`AirPinShellCmd stderr: ${stderr}`);
          this.tips(stderr, "投屏失败，请手动操作AirPin投屏后重试");
        }
      }
    );
  },
};

module.exports = func;
