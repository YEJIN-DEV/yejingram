import { Loader2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import { selectIsSyncing, selectSyncDeterminate, selectSyncProgress } from '../../entities/ui/selectors';

function SyncModal() {
    const isSyncing = useSelector(selectIsSyncing);
    const determinate = useSelector(selectSyncDeterminate);
    const progress = useSelector(selectSyncProgress);
    if (!isSyncing) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg-shadow)]/40 backdrop-blur-[2px] p-4">
            {determinate ? (
                <div className="bg-[var(--color-bg-main)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-2xl px-5 py-4 shadow-xl w-[min(420px,90vw)]">
                    <div className="font-semibold mb-2">동기화 중...</div>
                    <div className="w-full h-2 rounded-full bg-[var(--color-bg-input-secondary)] overflow-hidden">
                        <div className="h-full bg-[var(--color-button-primary)] transition-[width] duration-200" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-2 text-sm text-[var(--color-text-interface)]">{progress}%</div>
                </div>
            ) : (
                <div className="flex items-center gap-3 bg-[var(--color-bg-main)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-2xl px-5 py-4 shadow-xl">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--color-icon-tertiary)]" />
                    <div className="font-medium">동기화 중...</div>
                </div>
            )}
        </div>
    );
}

export default SyncModal;
