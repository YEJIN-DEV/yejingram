import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { selectAllSettings } from '../../entities/setting/selectors';
import { ChevronDown, Paintbrush } from 'lucide-react';
import { settingsActions } from '../../entities/setting/slice';
import type { ThemeOverrides } from '../../entities/setting/types';

function ThemeSettings() {
    const dispatch = useDispatch();
    const settings = useSelector(selectAllSettings);
    const { t } = useTranslation();
    // Parsed default colors from CSS (light = :root, dark = .dark)
    const [lightDefaults, setLightDefaults] = useState<Record<string, string>>({});
    const [darkDefaults, setDarkDefaults] = useState<Record<string, string>>({});
    const [varList, setVarList] = useState<string[]>([]);

    // Extract CSS variable defaults from index.css
    useEffect(() => {
        // Helper: safely iterate CSS rules
        const collectFromSelector = (selector: string) => {
            const result: Record<string, string> = {};
            for (const sheet of Array.from(document.styleSheets)) {
                // Some sheets may be cross-origin
                let rules: CSSRuleList | null = null;
                try {
                    rules = sheet.cssRules;
                } catch {
                    continue;
                }
                if (!rules) continue;
                for (const rule of Array.from(rules)) {
                    if ((rule as CSSStyleRule).selectorText === selector) {
                        const style = (rule as CSSStyleRule).style;
                        for (let i = 0; i < style.length; i++) {
                            const prop = style.item(i);
                            if (prop.startsWith('--color-')) {
                                const val = style.getPropertyValue(prop).trim();
                                result[prop] = val;
                            }
                        }
                    }
                }
            }
            return result;
        };
        // Collect defaults
        const light = collectFromSelector(':root');
        const dark = collectFromSelector('.dark');
        setLightDefaults(light);
        setDarkDefaults(dark);
        // Build a unified var list (sorted)
        const names = Array.from(new Set([...Object.keys(light), ...Object.keys(dark)])).sort();
        setVarList(names);
    }, []);

    // Helpers for overrides handling
    const baseKey = settings.customThemeBase === 'light' ? 'light' : 'dark';
    const defaultsForBase = settings.customThemeBase === 'light' ? lightDefaults : darkDefaults;
    const overridesForBase: Record<string, string> = settings.customTheme?.[baseKey] ?? {};

    let updated: ThemeOverrides = { light: { ...settings.customTheme.light }, dark: { ...settings.customTheme.dark } };

    const setOverride = (name: string, value: string) => {
        updated = {
            light: baseKey === 'light' ? { ...settings.customTheme.light, [name]: value } : { ...settings.customTheme.light },
            dark: baseKey === 'dark' ? { ...settings.customTheme.dark, [name]: value } : { ...settings.customTheme.dark },
        };
        // Apply the override immediately
        document.documentElement.style.setProperty(name, value);
    };

    const saveOverride = () => {
        dispatch(settingsActions.setCustomTheme(updated));
    };

    const resetOverride = (name: string) => {
        const base = { ...settings.customTheme[baseKey] };
        if (name in base) delete base[name];
        const updated: ThemeOverrides = {
            light: baseKey === 'light' ? base : { ...settings.customTheme.light },
            dark: baseKey === 'dark' ? base : { ...settings.customTheme.dark },
        };
        dispatch(settingsActions.setCustomTheme(updated));
    };

    // --- Color utilities: convert OKLCH to sRGB hex for preview/input ---
    const isOKLCH = (v: string) => v.trim().toLowerCase().startsWith('oklch(');
    const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
    const oklchToHex6 = (value: string): string | null => {
        const str = value.trim().toLowerCase();
        if (!str.startsWith('oklch(') || !str.endsWith(')')) return null;
        try {
            const inner = str.slice(6, -1).trim();
            const [left] = inner.split('/').map(s => s.trim());
            const parts = left.split(/[\s,]+/).filter(Boolean);
            if (parts.length < 3) return null;
            const lStr = parts[0];
            const cStr = parts[1];
            const hStr = parts[2];
            const L = lStr.endsWith('%') ? (parseFloat(lStr) / 100) : parseFloat(lStr);
            const C = parseFloat(cStr);
            const hDeg = parseFloat(hStr);
            if (!isFinite(L) || !isFinite(C) || !isFinite(hDeg)) return null;
            const hRad = (hDeg * Math.PI) / 180;
            const a = Math.cos(hRad) * C;
            const b = Math.sin(hRad) * C;
            // oklab -> LMS
            const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
            const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
            const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
            // cube
            const l3 = l_ * l_ * l_;
            const m3 = m_ * m_ * m_;
            const s3 = s_ * s_ * s_;
            // linear sRGB
            let r = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
            let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
            let b2 = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;
            r = clamp01(r); g = clamp01(g); b2 = clamp01(b2);
            const compand = (x: number) => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
            const R = clamp01(compand(r));
            const G = clamp01(compand(g));
            const B = clamp01(compand(b2));
            const to255 = (x: number) => Math.round(x * 255);
            const hex2 = (n: number) => n.toString(16).padStart(2, '0');
            return `#${hex2(to255(R))}${hex2(to255(G))}${hex2(to255(B))}`;
        } catch {
            return null;
        }
    };
    const toPreviewHex6 = (value: string): string | null => {
        const v = value.trim();
        if (isOKLCH(v)) return oklchToHex6(v);
        // Already hex? Normalize to 6-digit if 3-digit provided
        if (/^#([0-9a-fA-F]{6})$/.test(v)) return v.toLowerCase();
        const short = v.match(/^#([0-9a-fA-F]{3})$/);
        if (short) {
            const s = short[1];
            return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`.toLowerCase();
        }
        // Unsupported formats (rgb(), hsl(), names) → no preview conversion
        return null;
    };


    return (
        <>
            <details className="group/themecustom" >
                <summary className="flex items-center justify-between cursor-pointer list-none">
                    <span className="text-base font-medium text-[var(--color-text-primary)] flex items-center"><Paintbrush className="w-4 h-4 mr-2" />{t('themeSettings.title')}</span>
                    <ChevronDown className="w-5 h-5 text-[var(--color-icon-secondary)] transition-transform duration-300 group-open/themecustom:rotate-180" />
                </summary>
                <div className="mt-4 space-y-4">
                    <p className="text-xs text-[var(--color-text-secondary)]">{t('themeSettings.info')}</p>
                    <div>
                        <label className="text-sm font-medium text-[var(--color-text-interface)] mb-2 block">{t('themeSettings.basePalette')}</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => dispatch(settingsActions.setCustomThemeBase('light'))}
                                className={`py-2 px-4 rounded-lg text-xs font-medium border transition-colors ${settings.customThemeBase === 'light'
                                    ? 'bg-[var(--color-button-primary)] text-[var(--color-text-accent)] border-[var(--color-button-primary-accent)]'
                                    : 'bg-[var(--color-bg-input-secondary)] text-[var(--color-text-interface)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
                                    }`}
                            >
                                {t('themeSettings.lightTheme')}
                            </button>
                            <button
                                onClick={() => dispatch(settingsActions.setCustomThemeBase('dark'))}
                                className={`py-2 px-4 rounded-lg text-xs font-medium border transition-colors ${settings.customThemeBase === 'dark'
                                    ? 'bg-[var(--color-button-primary)] text-[var(--color-text-accent)] border-[var(--color-button-primary-accent)]'
                                    : 'bg-[var(--color-bg-input-secondary)] text-[var(--color-text-interface)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
                                    }`}
                            >
                                {t('themeSettings.darkTheme')}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {varList.length === 0 && (
                            <div className="col-span-2 text-xs text-[var(--color-text-secondary)]">{t('themeSettings.loadingVariables')}</div>
                        )}
                        {varList.map(name => {
                            const defaultVal = defaultsForBase[name] ?? '';
                            const overrideVal = overridesForBase[name];
                            const effectiveVal = (overrideVal ?? defaultVal).trim();
                            const isOverridden = overrideVal !== undefined;
                            const previewHex = toPreviewHex6(effectiveVal) ?? '#000000';
                            return (
                                <div key={name} className="flex flex-col gap-1 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input-secondary)]">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] text-[var(--color-text-secondary)] break-words">{name.split('--color-')[1]}</span>
                                        {isOverridden && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-button-primary)] text-[var(--color-text-accent)]">{t('themeSettings.applied')}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            id={`input-${name}`}
                                            type="color"
                                            aria-label={`${name} value`}
                                            value={previewHex}
                                            onChange={(e) => setOverride(name, e.target.value)}
                                            onBlur={saveOverride}
                                            placeholder={defaultVal}
                                            className="flex-1 px-1 text-xs rounded border border-[var(--color-border)] bg-[var(--color-bg-main)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-[var(--color-focus-border)]/40 focus:border-[var(--color-focus-border)]"
                                            title={isOKLCH(effectiveVal) ? `${effectiveVal} → ${previewHex}` : effectiveVal}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => resetOverride(name)}
                                            disabled={!isOverridden}
                                            className={`text-xs px-2 py-1 rounded border transition-colors ${isOverridden ? 'text-[var(--color-text-interface)] bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] border-[var(--color-border)]' : 'opacity-50 cursor-not-allowed border-[var(--color-border)]'}`}
                                        >
                                            {t('themeSettings.reset')}
                                        </button>
                                    </div>
                                    {!isOverridden && defaultVal && (
                                        <div className="text-[10px] text-[var(--color-text-secondary)]">{t('themeSettings.defaultValue')}: <span className="font-mono">{defaultVal}</span> {isOKLCH(defaultVal) && (<span className="ml-1 text-[var(--color-text-informative-secondary)]">→ {toPreviewHex6(defaultVal)}</span>)}</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </details>
        </>
    );
}

export default ThemeSettings;