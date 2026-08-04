export interface BackfillState {
    status: 'idle' | 'running' | 'completed' | 'error';
    total: number;
    processed: number;
    linked: number;
    alreadyLinked: number;
    skipped: number;
    errors: number;
    currentProcess: string | null;
    startedAt: string | null;
    finishedAt: string | null;
}

const state: BackfillState = {
    status: 'idle',
    total: 0,
    processed: 0,
    linked: 0,
    alreadyLinked: 0,
    skipped: 0,
    errors: 0,
    currentProcess: null,
    startedAt: null,
    finishedAt: null,
};

export function getBackfillState(): BackfillState {
    return { ...state };
}

export function updateBackfillState(patch: Partial<BackfillState>): void {
    Object.assign(state, patch);
}

export function resetBackfillState(total: number): void {
    Object.assign(state, {
        status: 'running',
        total,
        processed: 0,
        linked: 0,
        alreadyLinked: 0,
        skipped: 0,
        errors: 0,
        currentProcess: null,
        startedAt: new Date().toISOString(),
        finishedAt: null,
    });
}
