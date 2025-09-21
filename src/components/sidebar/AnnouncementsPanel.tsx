import { useState, useRef } from 'react';
import { Globe, User, X, Image } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AnnouncementsPanelProps {
    onClose: () => void;
}

function AnnouncementsPanel({ onClose }: AnnouncementsPanelProps) {
    const { t } = useTranslation();
    const tabContainerRef = useRef<HTMLDivElement>(null);

    const [activeTab, setActiveTab] = useState<'all' | 'servicenotes' | 'patchnotes'>('all');

    return (
        <>
            <div className="fixed md:relative top-0 bottom-0 z-40 w-full md:max-w-2xl left-0 md:left-auto bg-[var(--color-bg-main)] h-full flex flex-col border-r border-[var(--color-border)]">
                <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] shrink-0">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('settings.title')}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors"><X className="w-5 h-5 text-[var(--color-icon-tertiary)]" /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    {/* Tab Navigation */}
                    <div
                        ref={tabContainerRef}
                        className="flex justify-center border-b border-[var(--color-border)] -mx-6 whitespace-nowrap overflow-x-scroll scrollbar-hide touch-pan-x select-none"
                    >
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${activeTab === 'all'
                                ? 'border-[var(--color-focus-border)] text-[var(--color-button-primary-accent)]'
                                : 'border-transparent text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'
                                }`}
                        >
                            <Globe className="w-4 h-4 inline mr-2" />
                            {t('announcements.all')}
                        </button>
                        <button
                            onClick={() => setActiveTab('servicenotes')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${activeTab === 'servicenotes'
                                ? 'border-[var(--color-focus-border)] text-[var(--color-button-primary-accent)]'
                                : 'border-transparent text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'
                                }`}
                        >
                            <Image className="w-4 h-4 inline mr-2" />
                            {t('announcements.servicenotes')}
                        </button>
                        <button
                            onClick={() => setActiveTab('patchnotes')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${activeTab === 'patchnotes'
                                ? 'border-[var(--color-focus-border)] text-[var(--color-button-primary-accent)]'
                                : 'border-transparent text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'
                                }`}
                        >
                            <User className="w-4 h-4 inline mr-2" />
                            {t('announcements.patchnotes')}
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="mt-6">
                        {activeTab === 'all' && (
                            <div className="space-y-4">
                                <div>
                                    여기에 공지사항 전체 보여줌
                                </div>
                            </div>
                        )}

                        {activeTab === 'servicenotes' && (
                            <div className="space-y-4">
                                <div>
                                    여기에 서비스 공지사항 보여줌
                                </div>
                            </div>
                        )}

                        {activeTab === 'patchnotes' && (
                            <div className="space-y-4">
                                <div>
                                    여기에 패치 노트 보여줌
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default AnnouncementsPanel;
