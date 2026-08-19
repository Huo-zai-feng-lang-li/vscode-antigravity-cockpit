jest.mock('./quota_api_cache', () => ({
    readQuotaApiCache: jest.fn(async () => ({ payload: {}, updatedAt: Date.now() })),
    isApiCacheValid: jest.fn(() => true),
    getApiCacheAge: jest.fn(() => 0),
}));
jest.mock('../auto_trigger', () => ({
    credentialStorage: { getAllCredentials: jest.fn(async () => ({})) },
}));
jest.mock('./quota_history', () => ({
    recordQuotaHistory: jest.fn(async () => undefined),
}));

import { QuotaRefreshManager } from './quotaRefreshManager';

describe('QuotaRefreshManager performance policy', () => {
    it('does not refetch credits while the per-account credits cache is fresh', async () => {
        const snapshot = { models: [] };
        const reactor = {
            buildAuthorizedSnapshotFromResponse: jest.fn(() => ({ ...snapshot })),
            fetchAvailableAICreditsForAccount: jest.fn(async () => 42),
        };
        const manager = new QuotaRefreshManager(reactor as never);

        await manager.refreshAccount('user@example.com');
        await manager.refreshAccount('user@example.com');

        expect(reactor.fetchAvailableAICreditsForAccount).toHaveBeenCalledTimes(1);
    });

    it('refreshes accounts in parallel using a concurrency pool and invokes onProgress callback', async () => {
        const snapshot = { models: [] };
        const reactor = {
            buildAuthorizedSnapshotFromResponse: jest.fn(() => ({ ...snapshot })),
            fetchAvailableAICreditsForAccount: jest.fn(async () => 100),
        };
        const manager = new QuotaRefreshManager(reactor as never);
        const progressAccounts: string[] = [];

        const emails = ['acc1@test.com', 'acc2@test.com', 'acc3@test.com', 'acc4@test.com'];
        const results = await manager.refreshAccounts(emails, {
            concurrency: 2,
            onProgress: (email, result) => {
                expect(result.success).toBe(true);
                progressAccounts.push(email);
            },
        });

        expect(results.size).toBe(4);
        expect(progressAccounts).toEqual(expect.arrayContaining(emails));
        expect(progressAccounts.length).toBe(4);
    });
});
