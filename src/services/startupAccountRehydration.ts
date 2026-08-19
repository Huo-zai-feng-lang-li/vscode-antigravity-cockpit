export type LocalAccountSyncResult = 'switched' | 'same' | 'not_found' | 'not_exists';

interface HostTokenResult {
    success: boolean;
    message?: string;
}

interface StartupAccountDependencies {
    syncLocalAccount(): Promise<LocalAccountSyncResult>;
    getActiveAccount(): Promise<string | null>;
    rehydrateHostToken(email: string): Promise<HostTokenResult>;
}

export type StartupAccountRehydrationResult =
    | { state: 'rehydrated'; email: string; syncResult: LocalAccountSyncResult }
    | { state: 'failed'; email: string; syncResult: LocalAccountSyncResult; message: string }
    | { state: 'skipped'; syncResult: LocalAccountSyncResult };

export async function rehydrateStartupAccount(
    dependencies: StartupAccountDependencies,
): Promise<StartupAccountRehydrationResult> {
    const syncResult = await dependencies.syncLocalAccount();
    if (syncResult === 'not_found' || syncResult === 'not_exists') {
        return { state: 'skipped', syncResult };
    }

    const email = await dependencies.getActiveAccount();
    if (!email) {
        return { state: 'skipped', syncResult };
    }

    const hostResult = await dependencies.rehydrateHostToken(email);
    if (hostResult.success) {
        return { state: 'rehydrated', email, syncResult };
    }
    return {
        state: 'failed',
        email,
        syncResult,
        message: hostResult.message ?? 'unknown host token error',
    };
}
