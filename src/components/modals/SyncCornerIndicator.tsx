import { Loader2, UploadCloud } from 'lucide-react';
import { useSelector } from 'react-redux';
import { selectIsUploading, selectIsSyncing, selectSyncDeterminate, selectSyncProgress } from '../../entities/ui/selectors';

function SyncCornerIndicator() {
    const isUploading = useSelector(selectIsUploading);
    const isSyncing = useSelector(selectIsSyncing);
    const determinate = useSelector(selectSyncDeterminate);
    const progress = useSelector(selectSyncProgress);

    // Only show when syncing but global modal isn't desired
    if (!isSyncing && !isUploading) return null;

    return (
        <div className="fixed right-3 bottom-3 z-40 select-none">
            <div className="flex items-center gap-2 bg-[var(--color-bg-main)]/90 backdrop-blur-sm border border-[var(--color-border)] rounded-xl px-3 py-2 shadow-md">
                {isUploading ? (
                    <>
                        <UploadCloud className="w-4 h-4 text-[var(--color-icon-tertiary)] animate-pulse" />
                        <span className="text-xs text-[var(--color-text-interface)]">업로드 중…</span>
                    </>
                ) : determinate ? (
                    <div className="w-28">
                        <div className="h-1.5 rounded-full bg-[var(--color-bg-input-secondary)] overflow-hidden">
                            <div className="h-full bg-[var(--color-button-primary)] transition-[width] duration-200" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="mt-1 text-[10px] text-[var(--color-text-interface)] text-right">{progress}%</div>
                    </div>
                ) : (
                    <>
                        <Loader2 className="w-4 h-4 text-[var(--color-icon-tertiary)] animate-spin" />
                        <span className="text-xs text-[var(--color-text-interface)]">동기화 중…</span>
                    </>
                )}
            </div>
        </div>
    );
}

export default SyncCornerIndicator;
