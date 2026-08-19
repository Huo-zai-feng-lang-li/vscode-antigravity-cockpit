# Antigravity Cockpit - 项目开发与架构治理规则库

## 一、 性能与并发架构原则 (Performance & Concurrency Protocol)

1. **流式增量渲染 (Streaming Incremental Rendering)**
   - 严禁在主线程 UI 渲染层（Status Bar、Webview Dashboard、QuickPick）引入全局阻断式 `await All` 逻辑。
   - 批量任务或账号刷新必须通过带回调（如 `onProgress`）的并发控制池推进，实现“单个完成，立即渲染”的流式增量更新。

2. **当前主体抢占机制 (Active Head Injection)**
   - 涉及多账号/多域数据的批量请求时，必须优先将用户当前正在使用的账号（`currentEmail` / Active Context）排在队列最首位。
   - 保障核心交互主体在 50ms 内率先完成呈现，后续后台任务异步流式跟进。

3. **并发限制与资源保护 (Concurrency Worker Pool)**
   - 批量网络请求严格限制并发数（默认 `concurrency = 4`），禁止无脑 `Promise.all` 导致的惊群效应或 API Rate Limit。
   - 多层缓存优先原则：请求发起前强制校验内存及磁盘 API 缓存，命中有效缓存绝不重复触发网络 I/O。

4. **定时器抖动避峰 (Jittered Scheduling)**
   - 任何后台自动刷新循环（Auto Refresh Loop）必须加入 `[-10s, +10s]` 或 `[0, +10s]` 的随机偏移量，防止多 IDE 窗口同一秒集体对服务器发起冲击。

---

## 二、 版本管理规约 (Versioning & Release Rules)

1. **反重力版本递增规范 (SemVer Protocol)**
   - 遵循 `MAJOR.MINOR.PATCH` 规范。
   - 任何架构优化、性能重构、缺陷修复或功能更新完成并验证后，必须同步递增 `package.json` 和 `package-lock.json` 中的 `version` 字段。
   - 每次版本变更需保持 `package.json` 与 `package-lock.json` 的版本号 100% 严格一致。

2. **构建与测试防爆规则 (CI & Test Verification)**
   - 递增版本号前，必须确保 `npm test`（含新增单元测试与性能测试）全量 100% PASS。
   - Webview 与打包脚本（`npm run compile` / `npm run build`）不得有 Lint 错误或构建断言异常。

---

## 三、 质量与安全边界 (Safety & Compliance Boundary)

1. **绝不硬编码敏感凭证**：所有 Auth Token、Refresh Token 统一交由 `credentialStorage` / VS Code SecretStorage 管理。
2. **错误优雅回退**：网络离线或 403/401 异常时，界面必须平滑降级展示（显示连通性状态与友好气泡提示），绝对禁止未捕获异常导致插件崩溃。
3. **彻底释放资源**：所有的 EventEmitter 监听、定时器以及 WebSocket 实例，在 Dispose 或扩展卸载时必须 100% 释放干净，严禁孤儿句柄泄漏。
