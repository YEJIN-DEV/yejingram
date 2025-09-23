import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, Megaphone, MessageCircleWarning, BadgePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AnnouncementModal from '../modals/AnnouncementModal';
import type { AnnouncementMeta } from '../../services/announcements';
import { fetchAnnouncementContent, fetchAnnouncementsList, formatDate } from '../../services/announcements';

interface AnnouncementsPanelProps {
    onClose: () => void;
}

function AnnouncementsPanel({ onClose }: AnnouncementsPanelProps) {
    const { t } = useTranslation();
    const tabContainerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const [activeTab, setActiveTab] = useState<'all' | 'servicenotes' | 'patchnotes'>('all');

    // Data states
    const [serviceList, setServiceList] = useState<AnnouncementMeta[]>([]);
    const [patchList, setPatchList] = useState<AnnouncementMeta[]>([]);
    const [loadingList, setLoadingList] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination states (page index starts at 1)
    const PAGE_SIZE = 10;
    const [pageAll, setPageAll] = useState(1);
    const [pageService, setPageService] = useState(1);
    const [pagePatch, setPagePatch] = useState(1);

    // Content cache for previews
    const [contentMap, setContentMap] = useState<Record<string, string>>({});
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalDate, setModalDate] = useState<Date>(new Date());
    const [modalContent, setModalContent] = useState('');

    // Load lists on mount
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setLoadingList(true);
                const [service, patch] = await Promise.all([
                    fetchAnnouncementsList('servicenotes'),
                    fetchAnnouncementsList('patchnotes'),
                ]);
                if (!mounted) return;
                setServiceList(service);
                setPatchList(patch);
            } catch (e) {
                console.error(e);
                if (mounted) setError(t('announcements.failedLoading'));
            } finally {
                if (mounted) setLoadingList(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [t]);

    const combinedList = useMemo(() => {
        return [...serviceList, ...patchList].sort((a, b) => b.timestamp - a.timestamp);
    }, [serviceList, patchList]);

    const currentList = useMemo(() => {
        if (activeTab === 'all') return combinedList;
        if (activeTab === 'servicenotes') return serviceList;
        return patchList;
    }, [activeTab, combinedList, serviceList, patchList]);

    const currentPage = activeTab === 'all' ? pageAll : activeTab === 'servicenotes' ? pageService : pagePatch;
    const visibleItems = useMemo(() => currentList.slice(0, PAGE_SIZE * currentPage), [currentList, currentPage]);
    const canLoadMore = visibleItems.length < currentList.length;

    // Fetch content for visible items not yet loaded (to show preview)
    useEffect(() => {
        (async () => {
            const missing = visibleItems.filter(m => !(m.id in contentMap));
            if (missing.length === 0) return;
            // Avoid duplicate fetches
            const toFetch = missing.filter(m => !loadingIds.has(m.id));
            if (toFetch.length === 0) return;
            const newLoading = new Set(loadingIds);
            toFetch.forEach(m => newLoading.add(m.id));
            setLoadingIds(newLoading);
            try {
                const results = await Promise.all(toFetch.map(async (m) => fetchAnnouncementContent(m)));
                setContentMap(prev => {
                    const next = { ...prev };
                    for (const r of results) next[r.id] = r.content;
                    return next;
                });
            } finally {
                setLoadingIds(prev => {
                    const n = new Set(prev);
                    toFetch.forEach(m => n.delete(m.id));
                    return n;
                });
            }
        })();
    }, [visibleItems, contentMap, loadingIds]);

    // Handle infinite scroll
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const onScroll = () => {
            if (!canLoadMore) return;
            const threshold = 100; // px from bottom
            if (el.scrollHeight - el.scrollTop - el.clientHeight < threshold) {
                if (activeTab === 'all') setPageAll(p => p + 1);
                else if (activeTab === 'servicenotes') setPageService(p => p + 1);
                else setPagePatch(p => p + 1);
            }
        };
        el.addEventListener('scroll', onScroll);
        return () => el.removeEventListener('scroll', onScroll);
    }, [activeTab, canLoadMore]);

    // Reset page when switching tabs
    useEffect(() => {
        if (activeTab === 'all' && pageAll === 1) return;
        if (activeTab === 'servicenotes' && pageService === 1) return;
        if (activeTab === 'patchnotes' && pagePatch === 1) return;
        // No action, keep pages to allow user to switch back without losing progress
    }, [activeTab, pageAll, pagePatch, pageService]);

    function handleTabChange(tab: 'all' | 'servicenotes' | 'patchnotes') {
        setActiveTab(tab);
        // Optionally reset scroll to top
        const el = scrollRef.current;
        if (el) el.scrollTop = 0;
    }

    function getPreviewText(content: string, maxChars = 240): string {
        if (!content) return '';
        // 1) Replace markdown images with their alt text
        let htmlish = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1');
        // 2) Replace HTML <img> tags with their alt text (or nothing if no alt)
        htmlish = htmlish.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, '$1');
        htmlish = htmlish.replace(/<img[^>]*>/gi, '');
        // 3) Replace markdown links with their text
        htmlish = htmlish.replace(/\[([^\]]*)\]\(([^)]+)\)/g, '$1');
        // 4) Remove stray markdown symbols that often clutter previews
        htmlish = htmlish.replace(/[`*_#>-]+/g, ' ');
        // 5) Convert any remaining HTML to plain text by parsing as HTML and reading textContent
        let text = '';
        try {
            if (typeof window !== 'undefined' && 'DOMParser' in window) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlish, 'text/html');
                text = doc.body.textContent || '';
            } else {
                // Fallback: strip tags via regex (best-effort)
                text = htmlish.replace(/<[^>]+>/g, ' ');
            }
        } catch {
            text = htmlish.replace(/<[^>]+>/g, ' ');
        }
        text = text.replace(/\s+/g, ' ').trim();
        if (text.length > maxChars) return text.slice(0, maxChars) + '…';
        return text;
    }

    function getFirstImage(content: string): { src: string; alt: string } | null {
        if (!content) return null;
        // Markdown image first: ![alt](url)
        const md = content.match(/!\[([^\]]*)\]\(([^)]+)\)/);
        if (md) {
            const alt = md[1] || '';
            const src = md[2].trim().replace(/^\s*<|>\s*$/g, '');
            return { src, alt };
        }
        // HTML <img ...>
        const imgTag = content.match(/<img\b[^>]*>/i);
        if (imgTag) {
            const tag = imgTag[0];
            const srcMatch = tag.match(/src=["']([^"']+)["']/i);
            const altMatch = tag.match(/alt=["']([^"']*)["']/i);
            const src = srcMatch ? srcMatch[1] : '';
            if (src) {
                return { src, alt: altMatch ? altMatch[1] : '' };
            }
        }
        return null;
    }

    async function openModal(item: AnnouncementMeta) {
        try {
            setModalTitle(item.title);
            setModalDate(item.date);
            // Ensure full content loaded
            let full = contentMap[item.id];
            if (!full) {
                const r = await fetchAnnouncementContent(item);
                full = r.content;
                setContentMap(prev => ({ ...prev, [item.id]: full }));
            }
            setModalContent(full);
            setModalOpen(true);
        } catch (e) {
            console.error(e);
        }
    }

    return (
        <>
            <div className="fixed md:relative top-0 bottom-0 z-40 w-full md:max-w-2xl left-0 md:left-auto bg-[var(--color-bg-main)] h-full flex flex-col border-r border-[var(--color-border)]">
                <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] shrink-0">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('announcements.title')}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors"><X className="w-5 h-5 text-[var(--color-icon-tertiary)]" /></button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto flex-1" ref={scrollRef}>
                    {/* Tab Navigation */}
                    <div
                        ref={tabContainerRef}
                        className="flex justify-center border-b border-[var(--color-border)] -mx-6 whitespace-nowrap overflow-x-scroll scrollbar-hide touch-pan-x select-none"
                    >
                        <button
                            onClick={() => handleTabChange('all')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${activeTab === 'all'
                                ? 'border-[var(--color-focus-border)] text-[var(--color-button-primary-accent)]'
                                : 'border-transparent text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'
                                }`}
                        >
                            <Megaphone className="w-4 h-4 inline mr-2" />
                            {t('announcements.all')}
                        </button>
                        <button
                            onClick={() => handleTabChange('servicenotes')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${activeTab === 'servicenotes'
                                ? 'border-[var(--color-focus-border)] text-[var(--color-button-primary-accent)]'
                                : 'border-transparent text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'
                                }`}
                        >
                            <MessageCircleWarning className="w-4 h-4 inline mr-2" />
                            {t('announcements.servicenotes')}
                        </button>
                        <button
                            onClick={() => handleTabChange('patchnotes')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${activeTab === 'patchnotes'
                                ? 'border-[var(--color-focus-border)] text-[var(--color-button-primary-accent)]'
                                : 'border-transparent text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'
                                }`}
                        >
                            <BadgePlus className="w-4 h-4 inline mr-2" />
                            {t('announcements.patchnotes')}
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="mt-6">
                        {loadingList ? (
                            AnnouncementPanelStatusText(t('announcements.loading'), true)
                        ) : error ? (
                            <div className="text-[var(--color-text-interface)]">{error}</div>
                        ) : (
                            <div className="space-y-3">
                                {visibleItems.map(item => {
                                    const preview = contentMap[item.id];
                                    const firstImage = preview ? getFirstImage(preview) : null;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => openModal(item)}
                                            className="w-full text-left p-4 rounded-xl border border-[var(--color-border-secondary)] bg-[var(--color-bg-input-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                                        >
                                            <div className="flex gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <div className="text-base font-semibold text-[var(--color-text-primary)] truncate">{item.title}</div>
                                                        <div className="text-xs text-[var(--color-text-interface)] ml-3 whitespace-nowrap">{formatDate(item.date)}</div>
                                                    </div>
                                                    <div className="mt-2 text-sm text-[var(--color-text-interface)] line-clamp-3">
                                                        {preview ? getPreviewText(preview) : (
                                                            <span className="inline-flex items-center gap-2 text-[var(--color-icon-tertiary)]"><Loader2 className="w-3 h-3 animate-spin" /> {t('announcements.loadingPreview')}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {firstImage && (
                                                    <div className="flex-shrink-0">
                                                        <img
                                                            src={firstImage.src}
                                                            alt={firstImage.alt || 'preview'}
                                                            className="w-24 h-24 object-cover rounded-lg border border-[var(--color-border-secondary)]"
                                                            loading="lazy"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                                {canLoadMore && (
                                    <div className="flex justify-center py-4 text-[var(--color-text-interface)]">
                                        <button
                                            onClick={() => {
                                                if (activeTab === 'all') setPageAll(p => p + 1);
                                                else if (activeTab === 'servicenotes') setPageService(p => p + 1);
                                                else setPagePatch(p => p + 1);
                                            }}
                                            className="px-4 py-2 rounded-full border border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]"
                                        >
                                            {t('announcements.loadMore')}
                                        </button>
                                    </div>
                                )}
                                {!canLoadMore && currentList.length > 0 && (
                                    AnnouncementPanelStatusText(t('announcements.endOfList'), false)
                                )}
                                {!canLoadMore && currentList.length === 0 && (
                                    AnnouncementPanelStatusText(t('announcements.noAnnouncements'), false)
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <AnnouncementModal
                isOpen={modalOpen}
                title={modalTitle}
                date={modalDate}
                content={modalContent}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
}

const AnnouncementPanelStatusText = (content: string, isLoading: boolean) => {
    return (
        <div className="flex items-center justify-center py-6">
            <div className="flex items-center gap-3 text-[var(--color-text-tertiary)]">
                <span className="h-px w-10 bg-[var(--color-border-secondary)]" />
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{content}</span>
                <span className="h-px w-10 bg-[var(--color-border-secondary)]" />
            </div>
        </div>
    );
}

export default AnnouncementsPanel;
