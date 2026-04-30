# 小牛数独

这是一个可在手机、平板和桌面浏览器运行的 PWA 单页游戏。

## 本机运行

在当前目录启动静态服务：

```powershell
python -m http.server 8080
```

电脑浏览器打开：

```text
http://localhost:8080
```

手机或平板需要和电脑在同一 Wi-Fi 下，打开电脑的局域网 IP，例如：

```text
http://你的电脑IP:8080
```

## 安装到手机/平板

- Android Chrome/Edge：打开网页后，菜单中选择“添加到主屏幕”或“安装应用”。
- iPhone/iPad Safari：打开网页后，分享按钮中选择“添加到主屏幕”。

离线缓存和安装能力需要通过 `http://localhost`、局域网 HTTP 或 HTTPS 访问；直接双击 `index.html` 只能试玩，不能启用 PWA 离线缓存。
