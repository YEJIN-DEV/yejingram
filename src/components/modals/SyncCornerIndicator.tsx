import { useSelector } from 'react-redux';
import { selectUI, selectSyncProgress, selectUploadProgress } from '../../entities/ui/selectors';
import { useTranslation } from 'react-i18next';

function SyncCornerIndicator() {
    const { t } = useTranslation();
    const ui = useSelector(selectUI);
    const isUploading = (ui.uploadProgress ?? 0) > 0;
    const isSyncing = (ui.syncProgress ?? 0) > 0;
    const syncProgress = useSelector(selectSyncProgress);
    const uploadProgress = useSelector(selectUploadProgress);

    // Only show when syncing but global modal isn't desired
    if (!isSyncing && !isUploading) return null;

    return (
        <div className="fixed right-3 bottom-3 z-40 select-none">
            <div className="flex items-center gap-2 bg-[var(--color-bg-main)]/90 backdrop-blur-sm border border-[var(--color-border)] rounded-xl px-3 py-2 shadow-md">
                {isUploading ? (
                    <div className="w-28">
                        <div className="h-1.5 rounded-full bg-[var(--color-bg-input-secondary)] overflow-hidden">
                            <div className="h-full bg-[var(--color-button-primary)] transition-[width] duration-200" style={{ width: `${uploadProgress}%` }} />
                        </div>
                        <div className="mt-1 flex justify-between text-[10px] text-[var(--color-text-interface)]">
                            <span>{t('common.uploading')}</span>
                            <span>{uploadProgress}%</span>
                        </div>
                    </div>
                ) : (
                    <div className="w-28">
                        <div className="h-1.5 rounded-full bg-[var(--color-bg-input-secondary)] overflow-hidden">
                            <div className="h-full bg-[var(--color-button-primary)] transition-[width] duration-200" style={{ width: `${syncProgress}%` }} />
                        </div>
                        <div className="mt-1 flex justify-between text-[10px] text-[var(--color-text-interface)]">
                            <span>{t('common.syncing')}</span>
                            <span>{syncProgress}%</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default SyncCornerIndicator;
