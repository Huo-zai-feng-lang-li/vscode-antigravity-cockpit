# 重启后宿主账号重同步

## 取证结论

- 成功会话会执行宿主账号切换并出现 `tools available: true`，随后可发送请求。
- 失败重启能读到本地令牌和账号，但检测到 Cockpit 活跃账号相同后直接返回 `same`，没有重新调用宿主 `setOAuthTokenInfo`。
- 失败会话出现 `tools available: false`、本地 TLS 握手循环和发送请求 0；手动切换账号后当次恢复。

## 实施

- [x] RED：同账号重启也必须调用宿主无感账号同步。
- [x] 抽离可测试的启动账号重同步编排函数。
- [x] 扩展激活时对 `same` 与 `switched` 都强制重灌宿主令牌。
- [x] Cockpit Tools WebSocket 增加 CONNECTING 握手超时、单连接与自动重连。
- [x] 构建、20 项单测、Lint、打包并安装 VSIX 2.1.55。
- [x] 安装 VSIX 2.1.55，并验证安装目录构建哈希一致。
- [ ] 用户完全关闭/重开 IDE 后验证日志与真实发送。

## 安全边界

- 不删除或展示 OAuth Token。
- 不修改模型过滤和语言服务器协议补丁。
- 宿主重同步失败时保留原状态并记录错误，不回退到依赖 Cockpit Tools 的默认切号。
