import { X } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { useEffect, type HTMLAttributes } from 'react';
import { formatDate } from '../../services/announcements';

export interface AnnouncementModalProps {
    isOpen: boolean;
    title: string;
    date: Date;
    content: string;
    onClose: () => void;
}

function AnnouncementModal({ isOpen, title, date, content, onClose }: AnnouncementModalProps) {
    // Close on Escape key (active only when open)
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);
    if (!isOpen) return null;
    return (
        <div
            className="fixed inset-0 bg-[var(--color-bg-shadow)]/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={(e) => {
                // Close only when clicking the backdrop, not when clicking inside the dialog
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="bg-[var(--color-bg-main)] rounded-2xl w-full max-w-5xl mx-4 shadow-xl border border-[var(--color-border)]"
                style={{ maxHeight: '90vh' }}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-[var(--color-border)]">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
                            <div className="text-sm text-[var(--color-text-interface)] mt-1">{formatDate(date)}</div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-[var(--color-bg-hover)] rounded-full transition-colors" aria-label="Close">
                            <X className="w-5 h-5 text-[var(--color-icon-tertiary)]" />
                        </button>
                    </div>
                </div>
                <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
                    {(() => {
                        const components: Components = {
                            h1: (props) => (
                                <h1 className="mt-0 mb-3 text-2xl font-bold text-[var(--color-text-primary)]" {...props} />
                            ),
                            h2: (props) => (
                                <h2 className="mt-6 mb-3 text-xl font-semibold text-[var(--color-text-primary)]" {...props} />
                            ),
                            h3: (props) => (
                                <h3 className="mt-5 mb-2 text-lg font-semibold text-[var(--color-text-primary)]" {...props} />
                            ),
                            h4: (props) => (
                                <h4 className="mt-4 mb-2 text-base font-semibold text-[var(--color-text-primary)]" {...props} />
                            ),
                            p: (props: HTMLAttributes<HTMLParagraphElement>) => {
                                const { className, style, ...rest } = props;
                                // Try to derive alignment from legacy HTML align attribute (rehype-raw may pass it) or inline style
                                const legacyAlign = (rest as unknown as { align?: string }).align;
                                const styleAlign = style?.textAlign as string | undefined;
                                const alignVal = legacyAlign || styleAlign;
                                const alignClass = alignVal === 'center' ? 'text-center' : alignVal === 'right' ? 'text-right' : alignVal === 'justify' ? 'text-justify' : '';
                                const cls = ["my-2 leading-7 text-[var(--color-text-primary)]", className, alignClass].filter(Boolean).join(' ');
                                return <p className={cls} style={style} {...rest} />;
                            },
                            strong: (props) => (
                                <strong className="font-semibold text-[var(--color-text-primary)]" {...props} />
                            ),
                            em: (props) => (
                                <em className="italic text-[var(--color-text-primary)]" {...props} />
                            ),
                            a: (props) => (
                                <a
                                    className="underline text-[var(--color-button-primary-accent)] hover:opacity-90"
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    {...props}
                                />
                            ),
                            ul: (props) => (
                                <ul className="my-3 list-disc pl-6 space-y-1" {...props} />
                            ),
                            ol: (props) => (
                                <ol className="my-3 list-decimal pl-6 space-y-1" {...props} />
                            ),
                            li: (props) => (
                                <li className="text-[var(--color-text-primary)]" {...props} />
                            ),
                            blockquote: (props) => (
                                <blockquote className="my-4 pl-4 border-l-4 border-[var(--color-border-secondary)] italic text-[var(--color-text-interface)]" {...props} />
                            ),
                            // Inline code only; block code is styled via the 'pre' component below
                            code: (props) => (
                                <code className="px-1.5 py-0.5 rounded bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)]" {...props} />
                            ),
                            pre: (props) => (
                                <pre className="my-3 overflow-auto rounded-xl bg-[var(--color-bg-input-secondary)] border border-[var(--color-border-secondary)] p-3 text-sm" {...props} />
                            ),
                            hr: (props) => (
                                <hr className="my-6 border-[var(--color-border-secondary)]" {...props} />
                            ),
                            img: (props) => (
                                <img className="my-3 max-w-full h-auto rounded-xl border border-[var(--color-border-secondary)]" {...props} />
                            ),
                            table: (props) => (
                                <div className="my-4 overflow-x-auto border border-[var(--color-border-secondary)] rounded-xl">
                                    <table className="min-w-full text-sm text-[var(--color-text-primary)]" {...props} />
                                </div>
                            ),
                            thead: (props) => (
                                <thead className="bg-[var(--color-bg-secondary)]" {...props} />
                            ),
                            th: (props) => (
                                <th className="px-3 py-2 text-left font-semibold border-b border-[var(--color-border-secondary)]" {...props} />
                            ),
                            td: (props) => (
                                <td className="px-3 py-2 align-top border-b border-[var(--color-border-secondary)]" {...props} />
                            ),
                        };

                        const schema = {
                            ...defaultSchema,
                            attributes: {
                                ...defaultSchema.attributes,
                                a: [
                                    ...((defaultSchema.attributes?.a as unknown[] | undefined) ?? []),
                                    'target',
                                    'rel',
                                ],
                                img: [
                                    ...((defaultSchema.attributes?.img as unknown[] | undefined) ?? []),
                                    'width',
                                    'height',
                                    'loading',
                                ],
                                p: [
                                    ...((defaultSchema.attributes?.p as unknown[] | undefined) ?? []),
                                    'align',
                                ],
                            },
                        };

                        return (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]} components={components}>
                                {content}
                            </ReactMarkdown>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
}

export default AnnouncementModal;
