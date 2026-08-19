# 模型响应性能优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 保留账号切换、配额面板和自动刷新，同时让前台账号立即可用，后台账号刷新不竞争模型请求。

**Architecture:** 启动先加载缓存；当前账号走高优先级即时刷新；其他账号进入单并发、低频队列。配额与 credits 分离缓存并覆盖刷新周期，OAuth 刷新按账号 singleflight。

**Tech Stack:** TypeScript、VS Code Extension API、Node.js test runner。

### Task 1: 建立刷新优先级与缓存测试

**Files:**
- Create/Modify: `src/services/*performance*.test.ts`
- Modify: `src/services/quotaRefreshManager.ts`

- [ ] 写失败测试：切号不等待其他账号、缓存命中不发 credits 请求、同账号刷新合并、后台队列并发不超过 1。
- [ ] 运行测试并确认 RED。
- [ ] 实现最小策略并确认 GREEN。

### Task 2: 前台账号优先与后台节流

**Files:**
- Modify: `src/services/accountsRefreshService.ts`
- Modify: `src/services/quotaRefreshManager.ts`
- Modify: `src/services/quota_api_cache.ts`
- Modify: `src/auto_trigger/oauth_service.ts`

- [ ] 启动缓存先行，后台刷新不阻塞 activation。
- [ ] 当前账号立即刷新；其他账号单并发、约 10 分钟低频刷新。
- [ ] credits 使用独立长 TTL，真正缓存命中零网络。
- [ ] OAuth 按账号 singleflight，仅在实际请求需要时刷新。

### Task 3: 保留重启恢复并完成回归

**Files:**
- Preserve/Integrate: `src/services/startupAccountRehydration.ts`
- Preserve/Integrate: `src/services/cockpitToolsWs.ts`
- Modify only if required: `src/extension.ts`

- [ ] 不覆盖现有未提交的重启账号恢复改动。
- [ ] 验证切号、重启恢复、面板、手动刷新和定时刷新。

### Task 4: 构建、安装、性能验收

- [ ] 运行单测、类型检查、构建和 VSIX 打包。
- [ ] 安装最新本地 VSIX，重启 IDE。
- [ ] 固定窗口比较后台 HTTP/OAuth 次数与模型首字延迟。

> 说明：不自动提交或暂存，避免覆盖用户当前 package/extension/重启恢复改动。
