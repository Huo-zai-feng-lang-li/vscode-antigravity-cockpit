/**
 * Antigravity Cockpit - 配额刷新管理器
 * 统一管理所有配额刷新请求，实现文件缓存和防重复刷新
 */

import { logger } from '../shared/log_service';
import { ReactorCore } from '../engine/reactor';
import { QuotaSnapshot } from '../shared/types';
import { readQuotaApiCache, isApiCacheValid, getApiCacheAge } from './quota_api_cache';
import { credentialStorage } from '../auto_trigger';
import { recordQuotaHistory } from './quota_history';

export interface RefreshOptions {
    /** 是否强制刷新（忽略缓存） */
    forceRefresh?: boolean;
    /** 刷新原因（用于日志） */
    reason?: string;
    /** 并发请求限制 (默认 4) */
    concurrency?: number;
    /** 单账号刷新完成回调 (流式通知) */
    onProgress?: (email: string, result: RefreshResult) => void;
}

export interface RefreshResult {
    /** 是否成功 */
    success: boolean;
    /** 是否使用了缓存 */
    fromCache: boolean;
    /** 配额快照 */
    snapshot?: QuotaSnapshot;
    /** 错误信息 */
    error?: string;
}

/**
 * 配额刷新管理器
 * 负责统一管理配额刷新，实现跨工作区/IDE 的文件缓存共享
 */
export class QuotaRefreshManager {
    private static readonly CREDITS_CACHE_TTL_MS = 10 * 60 * 1000;
    /** 当前正在刷新的账号（防止并发） */
    private refreshingAccounts = new Set<string>();
    /** 最近一次网络刷新时间（仅在成功网络请求后更新） */
    private lastNetworkRefreshAt = new Map<string, number>();
    /** credits 与配额模型分开缓存，避免缓存命中时仍重复请求网络 */
    private creditsCache = new Map<string, { value: number; updatedAt: number }>();

    constructor(private readonly reactor: ReactorCore) {}

    /**
     * 刷新单个账号的配额
     * @param email 账号邮箱
     * @param options 刷新选项
     * @returns 刷新结果
     */
    async refreshAccount(email: string, options?: RefreshOptions): Promise<RefreshResult> {
        const reason = options?.reason ?? 'manual';
        const forceRefresh = options?.forceRefresh ?? false;

        while (this.refreshingAccounts.has(email)) {
            logger.debug(`[QuotaRefresh] Account ${email} is already refreshing, waiting...`);
            const waitStartedAt = Date.now();
            await this.waitForRefresh(email);
            const cachedSnapshot = await this.tryUseApiCache(email, reason, waitStartedAt, forceRefresh);
            if (cachedSnapshot) {
                return {
                    success: true,
                    fromCache: true,
                    snapshot: cachedSnapshot,
                };
            }
        }

        try {
            this.refreshingAccounts.add(email);

            if (!forceRefresh) {
                const cachedSnapshot = await this.tryUseApiCache(email, reason);
                if (cachedSnapshot) {
                    return {
                        success: true,
                        fromCache: true,
                        snapshot: cachedSnapshot,
                    };
                }
            }

            // 2. 缓存无效或强制刷新，发起网络请求
            logger.info(`[QuotaRefresh] Fetching quota for ${email} from network (force: ${forceRefresh}, reason: ${reason})`);
            
            const { snapshot, fromApiCacheFile } = await this.reactor.fetchQuotaForAccountWithSource(email, { forceRefresh });
            this.lastNetworkRefreshAt.set(email, Date.now());
            
            // 3. 记录历史
            if (!fromApiCacheFile) {
                void recordQuotaHistory(email, snapshot);
            } else {
                logger.debug(`[QuotaRefresh] Skip history record for ${email} because data comes from api cache file`);
            }

            logger.info(`[QuotaRefresh] Refreshed ${email}: ${snapshot.models.length} models`);
            
            return {
                success: true,
                fromCache: false,
                snapshot,
            };
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            logger.error(`[QuotaRefresh] Failed to refresh ${email}: ${error}`);
            
            return {
                success: false,
                fromCache: false,
                error,
            };
        } finally {
            this.refreshingAccounts.delete(email);
        }
    }

    /**
     * 批量并发刷新多个账号（支持进度回调与并发池控制）
     * @param emails 账号邮箱列表
     * @param options 刷新选项
     * @returns 各账号的刷新结果
     */
    async refreshAccounts(emails: string[], options?: RefreshOptions): Promise<Map<string, RefreshResult>> {
        const results = new Map<string, RefreshResult>();
        if (emails.length === 0) {
            return results;
        }

        const reason = options?.reason ?? 'batch';
        const concurrency = Math.max(1, options?.concurrency ?? 4);
        const forceRefresh = options?.forceRefresh ?? false;

        let index = 0;
        const workers = Array.from({ length: Math.min(concurrency, emails.length) }, async () => {
            while (index < emails.length) {
                const currentIndex = index++;
                const email = emails[currentIndex];
                const result = await this.refreshAccount(email, { 
                    ...options, 
                    reason,
                    forceRefresh,
                });
                results.set(email, result);

                if (options?.onProgress) {
                    try {
                        options.onProgress(email, result);
                    } catch (err) {
                        logger.warn(`[QuotaRefresh] Error in onProgress callback for ${email}: ${err}`);
                    }
                }
            }
        });

        await Promise.all(workers);
        return results;
    }

    /**
     * 刷新所有已授权的账号
     * @param options 刷新选项
     * @returns 各账号的刷新结果
     */
    async refreshAll(options?: RefreshOptions): Promise<Map<string, RefreshResult>> {
        const credentials = await credentialStorage.getAllCredentials();
        const emails = Object.keys(credentials).filter(email => {
            const cred = credentials[email];
            return cred && !cred.isInvalid && !cred.isForbidden;
        });

        logger.info(`[QuotaRefresh] Refreshing all ${emails.length} accounts (reason: ${options?.reason ?? 'all'})`);
        return this.refreshAccounts(emails, options);
    }

    /**
     * 等待指定账号的刷新完成
     */
    private async waitForRefresh(email: string, timeoutMs: number = 30000): Promise<void> {
        const startTime = Date.now();
        while (this.refreshingAccounts.has(email)) {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Timeout waiting for refresh of ${email}`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    private async tryUseApiCache(
        email: string,
        reason: string,
        waitStartedAt?: number,
        forceRefresh?: boolean,
    ): Promise<QuotaSnapshot | null> {
        const cached = await readQuotaApiCache('authorized', email);
        if (!isApiCacheValid(cached)) {
            return null;
        }
        if (forceRefresh && waitStartedAt !== undefined) {
            const lastNetworkAt = this.lastNetworkRefreshAt.get(email);
            if (lastNetworkAt === undefined || lastNetworkAt < waitStartedAt) {
                return null;
            }
        }
        const age = getApiCacheAge(cached);
        logger.info(`[QuotaRefresh] Using api cache for ${email} (age: ${Math.round(age / 1000)}s, reason: ${reason})`);
        const snapshot = this.reactor.buildAuthorizedSnapshotFromResponse(cached!.payload, cached!.updatedAt);
        await this.enrichCredits(email, snapshot);
        return snapshot;
    }

    private async enrichCredits(email: string, snapshot: QuotaSnapshot): Promise<void> {
        const cached = this.creditsCache.get(email);
        if (cached && Date.now() - cached.updatedAt < QuotaRefreshManager.CREDITS_CACHE_TTL_MS) {
            snapshot.availableAICredits = cached.value;
            return;
        }

        try {
            const credits = await this.reactor.fetchAvailableAICreditsForAccount(email);
            if (!Number.isFinite(credits)) {
                return;
            }
            const value = Math.max(0, Number(credits));
            this.creditsCache.set(email, { value, updatedAt: Date.now() });
            snapshot.availableAICredits = value;
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            logger.warn(`[QuotaRefresh] Failed to enrich credits for ${email}: ${err.message}`);
        }
    }
}
