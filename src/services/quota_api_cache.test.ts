import { CACHE_TTL_MS, isApiCacheValid, QuotaApiCacheRecord } from './quota_api_cache';

function record(updatedAt: number): QuotaApiCacheRecord {
    return {
        version: 1,
        source: 'authorized',
        customSource: 'plugin',
        email: 'user@example.com',
        updatedAt,
        payload: {},
    };
}

describe('quota api cache performance policy', () => {
    it('keeps cached quota valid long enough to avoid two-minute refresh churn', () => {
        expect(CACHE_TTL_MS).toBeGreaterThanOrEqual(10 * 60 * 1000);
        expect(isApiCacheValid(record(Date.now() - 5 * 60 * 1000))).toBe(true);
    });
});
