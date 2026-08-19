import { rehydrateStartupAccount } from './startupAccountRehydration';

describe('rehydrateStartupAccount', () => {
    it.each(['same', 'switched'] as const)('reapplies host token when startup sync returns %s', async syncResult => {
        const rehydrateHostToken = jest.fn().mockResolvedValue({ success: true, mode: 'seamless' });

        const result = await rehydrateStartupAccount({
            syncLocalAccount: jest.fn().mockResolvedValue(syncResult),
            getActiveAccount: jest.fn().mockResolvedValue('user@example.com'),
            rehydrateHostToken,
        });

        expect(rehydrateHostToken).toHaveBeenCalledWith('user@example.com');
        expect(result).toEqual({ state: 'rehydrated', email: 'user@example.com', syncResult });
    });

    it.each(['not_found', 'not_exists'] as const)('does not change host token when startup sync returns %s', async syncResult => {
        const rehydrateHostToken = jest.fn();

        const result = await rehydrateStartupAccount({
            syncLocalAccount: jest.fn().mockResolvedValue(syncResult),
            getActiveAccount: jest.fn(),
            rehydrateHostToken,
        });

        expect(rehydrateHostToken).not.toHaveBeenCalled();
        expect(result).toEqual({ state: 'skipped', syncResult });
    });

    it('does not change host token without an active account', async () => {
        const rehydrateHostToken = jest.fn();

        const result = await rehydrateStartupAccount({
            syncLocalAccount: jest.fn().mockResolvedValue('same'),
            getActiveAccount: jest.fn().mockResolvedValue(null),
            rehydrateHostToken,
        });

        expect(rehydrateHostToken).not.toHaveBeenCalled();
        expect(result).toEqual({ state: 'skipped', syncResult: 'same' });
    });

    it('reports host token rehydration failure', async () => {
        const result = await rehydrateStartupAccount({
            syncLocalAccount: jest.fn().mockResolvedValue('same'),
            getActiveAccount: jest.fn().mockResolvedValue('user@example.com'),
            rehydrateHostToken: jest.fn().mockResolvedValue({
                success: false,
                mode: 'seamless',
                message: 'host unavailable',
            }),
        });

        expect(result).toEqual({
            state: 'failed',
            email: 'user@example.com',
            syncResult: 'same',
            message: 'host unavailable',
        });
    });
});
