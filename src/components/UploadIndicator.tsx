import { ArrowUpCircle } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { selectIsUploading } from '../entities/ui/selectors';

function UploadIndicator() {
  const { t } = useTranslation();
  const isUploading = useSelector(selectIsUploading);
  if (!isUploading) return null;
  return (
    <div className="fixed bottom-3 right-3 z-50 select-none" aria-live="polite" aria-atomic="true">
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full shadow-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-bg-main) 90%,transparent)] backdrop-blur-sm">
        <ArrowUpCircle className="w-3.5 h-3.5 text-[var(--color-icon-tertiary)] animate-pulse" />
        <span className="text-xs text-[var(--color-text-interface)]">{t('common.uploading')}</span>
      </div>
    </div>
  );
}

export default UploadIndicator;
