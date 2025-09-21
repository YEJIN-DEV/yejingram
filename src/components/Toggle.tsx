import React from 'react';

interface ToggleProps {
    id: string;
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    additionalDescription?: React.ReactNode;
    icon?: React.ReactNode;
}export function Toggle({
    id,
    label,
    description,
    checked,
    onChange,
    disabled = false,
    additionalDescription,
    icon
}: ToggleProps) {
    const content = (
        <>
            <div className="flex flex-col">
                <label htmlFor={id} className="font-medium text-[var(--color-text-primary)] cursor-pointer flex items-center">
                    {icon && <span className="mr-2">{icon}</span>}
                    {label}
                </label>
                {description && (
                    <p className="text-xs text-[var(--color-text-secondary)]">{description}</p>
                )}
                {additionalDescription}
            </div>
            <label htmlFor={id} className="relative flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    id={id}
                    className="sr-only peer"
                    checked={checked}
                    onChange={e => onChange(e.target.checked)}
                    disabled={disabled}
                />
                <div className="w-11 h-6 bg-[var(--color-toggle-off)] rounded-full peer peer-focus:ring-4 peer-focus:ring-[var(--color-toggle-on)]/30 peer-checked:after:translate-x-full peer-checked:after:border-[var(--color-border)] after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-[var(--color-bg-main)] after:border-[var(--color-border-strong)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-toggle-on)] disabled:opacity-50 disabled:cursor-not-allowed"></div>
            </label>
        </>
    );

    return (
        <div className={`flex items-center justify-between p-3 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border)]`}>
            {content}
        </div>
    );
}