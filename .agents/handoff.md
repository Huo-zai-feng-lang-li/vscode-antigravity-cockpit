# 最新接续状态 (2026-07-24 18:45)

## 核心进展
- 修复 Antigravity 手动切号后当次可发送、关闭重开后回车无法发送：即使本地账号与 Cockpit 活跃账号相同，也会在扩展启动时通过 `seamless` 宿主 API 重新灌入 OAuth 信息。
- 修复 Cockpit Tools 冷启动 WebSocket 永久停留 `CONNECTING`：5 秒握手 watchdog、同一时间只允许一个 socket、超时后进入既有退避重连。
- 版本升级为 `2.1.55`；VSIX `dist/antigravity-cockpit-2.1.55.vsix`，SHA256 `D0AB40A7E460E27BE42F8212F353D16FD21C1DDBDE0189905A7747A8302D0C32`，已安装到本机 Antigravity。
- 验证：Lint 0 error（2 个既有 naming warning）；Jest 4 suites / 20 tests 全通过；production build 和 VSIX 打包通过。

## 待办事项
- [ ] 用户完全关闭 Antigravity 后重新打开，确认 Cockpit 日志出现 `Host token rehydrated after local sync`。
- [ ] 不切换账号直接发送消息，确认出现 `streamGenerateContent` 且界面正常响应。
- [ ] 若失败，读取该次最新会话日志，检查宿主重灌明确错误，不再猜测登录状态。

# 历史接续状态 (2026-05-11 21:36)

## 核心进展
- 彻底修复并优化了**无感切号全链路性能**。通过异步化 credits/quota 刷新请求，将切号响应速度提升至毫秒级，规避了原本 12s 的超时限制。
- 完成了双端版本同步提交与打标：Extension [v2.1.54] 与 Desktop [v0.20.39]。

## 变更决策
- **架构解耦**：切号成功反馈不再阻塞等待 UI 同步（Credits/Quota），改为后台异步预取。
- **乐观令牌机制**：引入 30s buffer，只要 Token 尚未彻底过期，切号时跳过强制网络刷新，实现极致响应。
- **超时阶梯化**：Desktop (25s) < WS Request (30s)，确保各层级逻辑有充足容错空间。

## 待办事项 (Next Steps)
- [ ] 监控生产环境下无感切号的成功率，检查是否有极端弱网下的异常漏记。
- [ ] 确认 CI/CD 构建流程是否已根据新 Tag (`v2.1.54` & `v0.20.39`) 成功产出 VSIX 和安装包。

## 关键上下文
- 目录: `c:\Users\Administrator\Desktop\超级文件\AI-IDE\AI\vscode-antigravity-cockpit`
- 主要文件:
    - [accountSwitchService.ts](file:///c:/Users/Administrator/Desktop/超级文件/AI-IDE/AI/vscode-antigravity-cockpit/src/services/accountSwitchService.ts) (乐观 Token 逻辑)
    - [message_controller.ts](file:///c:/Users/Administrator/Desktop/超级文件/AI-IDE/AI/vscode-antigravity-cockpit/src/controller/message_controller.ts) (异步刷新调度)
    - [account.rs](file:///C:/Users/Administrator/Desktop/超级文件/AI-IDE/AI/cockpit-tools/src-tauri/src/modules/account.rs) (Rust 超时控制)
