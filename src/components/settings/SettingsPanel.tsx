import { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllSettings } from '../../entities/setting/selectors';
import type { SettingsState, ApiProvider } from '../../entities/setting/types';
import { Globe, FilePenLine, User, MessageSquarePlus, Shuffle, Download, Upload, FastForward, X, Image, CircleEllipsis, Palette, Languages, Cloud, RotateCcw, CloudUpload, Trash2, ChevronDown } from 'lucide-react';
import i18n from '../../i18n/i18n';
import { useTranslation } from 'react-i18next';
import { ProviderSettings } from './ProviderSettings';
import { backupStateToFile, restoreStateFromFile, backupStateToServer, restoreStateFromServer, wipeAllState } from '../../utils/backup';
import { settingsActions } from '../../entities/setting/slice';
import PersonaManager from './PersonaModal';
import { ImageSettings } from './image/ImageSettings';
import ThemeSettings from './ThemeSettings';
import { Toggle } from '../Toggle';

interface SettingsPanelProps {
    openPromptModal: () => void;
    onClose: () => void;
}

function SettingsPanel({ openPromptModal, onClose }: SettingsPanelProps) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const settings = useSelector(selectAllSettings);
    const tabContainerRef = useRef<HTMLDivElement>(null);

    const [localSettings, setLocalSettings] = useState<SettingsState>(settings);
    const [activeTab, setActiveTab] = useState<'ai' | 'image' | 'persona' | 'proactive' | 'others'>('ai');

    const importBackup = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";

        input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;

            try {
                await restoreStateFromFile(file, false);
                alert(t('settings.alerts.backupImported'));
            } catch (err) {
                console.error(err);
                alert(t('settings.alerts.backupImportFailed'));
            }
        };

        input.click();
    }

    // Scroll horizontally with mouse drag
    useEffect(() => {
        const container = tabContainerRef.current;
        if (!container) return;

        let isDown = false;
        let startX: number;
        let scrollLeft: number;

        const handleMouseDown = (e: MouseEvent) => {
            isDown = true;
            container.style.cursor = 'grabbing';
            startX = e.pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
        };

        const handleMouseLeave = () => {
            isDown = false;
            container.style.cursor = 'grab';
        };

        const handleMouseUp = () => {
            isDown = false;
            container.style.cursor = 'grab';
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX);
            container.scrollLeft = scrollLeft - walk;
        };

        container.style.cursor = 'grab';
        container.addEventListener('mousedown', handleMouseDown);
        container.addEventListener('mouseleave', handleMouseLeave);
        container.addEventListener('mouseup', handleMouseUp);
        container.addEventListener('mousemove', handleMouseMove);

        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            container.removeEventListener('mouseleave', handleMouseLeave);
            container.removeEventListener('mouseup', handleMouseUp);
            container.removeEventListener('mousemove', handleMouseMove);
        };
    }, []);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleSave = () => {
        dispatch(settingsActions.setSettings(localSettings));
        onClose();
    };

    const handlePromptModalOpen = () => {
        dispatch(settingsActions.setSettings(localSettings));
        openPromptModal();
    };

    const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const provider = e.target.value as ApiProvider;
        setLocalSettings(prev => ({ ...prev, apiProvider: provider }));
    };

    const handleColorThemeChange = (theme: 'light' | 'dark' | 'system' | 'custom') => {
        setLocalSettings(prev => ({ ...prev, colorTheme: theme }));
        dispatch(settingsActions.setColorTheme(theme));
    };

    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const language = e.target.value as 'ko' | 'en' | 'ja';
        setLocalSettings(prev => ({ ...prev, uiLanguage: language }));
        dispatch(settingsActions.setUILanguage(language));
        // Apply language immediately and allow detector to cache it in localStorage
        try { i18n.changeLanguage(language); } catch { /* noop */ }
    };

    return (
        <>
            <div className="fixed md:relative top-0 bottom-0 z-40 w-full md:max-w-lg left-0 md:left-auto bg-[var(--color-bg-main)] h-full flex flex-col border-r border-[var(--color-border)]">
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
                            onClick={() => setActiveTab('ai')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${activeTab === 'ai'
                                ? 'border-[var(--color-focus-border)] text-[var(--color-button-primary-accent)]'
                                : 'border-transparent text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'
                                }`}
                        >
                            <Globe className="w-4 h-4 inline mr-2" />
                            {t('settings.tabs.ai')}
                        </button>
                        {localSettings.useImageResponse && (
                            <button
                                onClick={() => setActiveTab('image')}
                                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${activeTab === 'image'
                                    ? 'border-[var(--color-focus-border)] text-[var(--color-button-primary-accent)]'
                                    : 'border-transparent text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'
                                    }`}
                            >
                                <Image className="w-4 h-4 inline mr-2" />
                                {t('settings.tabs.image')}
                            </button>
                        )}
                        <button
                            onClick={() => setActiveTab('persona')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${activeTab === 'persona'
                                ? 'border-[var(--color-focus-border)] text-[var(--color-button-primary-accent)]'
                                : 'border-transparent text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'
                                }`}
                        >
                            <User className="w-4 h-4 inline mr-2" />
                            {t('settings.tabs.persona')}
                        </button>
                        <button
                            onClick={() => setActiveTab('proactive')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${activeTab === 'proactive'
                                ? 'border-[var(--color-focus-border)] text-[var(--color-button-primary-accent)]'
                                : 'border-transparent text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'
                                }`}
                        >
                            <MessageSquarePlus className="w-4 h-4 inline mr-2" />
                            {t('settings.tabs.proactive')}
                        </button>
                        <button
                            onClick={() => setActiveTab('others')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${activeTab === 'others'
                                ? 'border-[var(--color-focus-border)] text-[var(--color-button-primary-accent)]'
                                : 'border-transparent text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'
                                }`}
                        >
                            <CircleEllipsis className="w-4 h-4 inline mr-2" />
                            {t('settings.tabs.others')}
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="mt-6">
                        {activeTab === 'ai' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2"><Globe className="w-4 h-4 mr-2" />{t('settings.ai.providerLabel')}</label>
                                    <select id="settings-api-provider" value={localSettings.apiProvider} onChange={handleProviderChange} className="w-full px-4 py-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] transition-transform duration-200 text-sm">
                                        <option value="gemini">Google Gemini</option>
                                        <option value="vertexai">Google Vertex AI</option>
                                        <option value="claude">Anthropic Claude</option>
                                        <option value="openai">OpenAI</option>
                                        <option value="grok">xAI Grok</option>
                                        <option value="openrouter">OpenRouter</option>
                                        <option value="customOpenAI">Custom OpenAI</option>
                                    </select>
                                </div>
                                <ProviderSettings settings={localSettings} setSettings={setLocalSettings} />
                                <div>
                                    <button id="open-prompt-modal" onClick={handlePromptModalOpen} className="w-full mt-2 py-2 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                        <FilePenLine className="w-4 h-4" /> {t('settings.ai.editPrompts')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'image' && <ImageSettings settings={localSettings} setSettings={setLocalSettings} />}

                        {activeTab === 'persona' && <PersonaManager />}

                        {activeTab === 'proactive' && (
                            <div className="space-y-4">
                                <Toggle
                                    id="settings-proactive-toggle"
                                    label={t('settings.proactive.enableInContacts')}
                                    checked={localSettings.proactiveChatEnabled || false}
                                    onChange={checked => setLocalSettings(prev => ({ ...prev, proactiveChatEnabled: checked }))}
                                    icon={<MessageSquarePlus className="w-4 h-4" />}
                                />
                                <Toggle
                                    id="settings-random-first-message-toggle"
                                    label={t('settings.proactive.enableRandom')}
                                    checked={localSettings.randomFirstMessageEnabled || false}
                                    onChange={checked => setLocalSettings(prev => ({ ...prev, randomFirstMessageEnabled: checked }))}
                                    icon={<Shuffle className="w-4 h-4" />}
                                />
                                {localSettings.randomFirstMessageEnabled && (
                                    <div id="random-chat-options" className="mt-4 space-y-4">
                                        <div>
                                            <label className="flex items-center justify-between text-sm font-medium text-[var(--color-text-interface)] mb-2">
                                                <span>{t('settings.proactive.countLabel')}</span>
                                                <span id="random-character-count-label" className="text-[var(--color-button-primary)] font-semibold">{localSettings.randomCharacterCount}{t('units.peopleSuffix')}</span>
                                            </label>
                                            <input id="settings-random-character-count" type="range" min="1" max="5" step="1" value={localSettings.randomCharacterCount} onChange={e => setLocalSettings(prev => ({ ...prev, randomCharacterCount: +e.target.value }))} className="w-full accent-[var(--color-button-primary)]" />
                                        </div>
                                        <div>
                                            <label className="text-sm font-medium text-[var(--color-text-interface)] mb-2 block">{t('settings.proactive.intervalLabel')}</label>
                                            <div className="flex items-center gap-2">
                                                <input id="settings-random-frequency-min" type="number" min="1" value={localSettings.randomMessageFrequencyMin} onChange={e => setLocalSettings(prev => ({ ...prev, randomMessageFrequencyMin: +e.target.value }))} className="w-full px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] text-sm" />
                                                <span className="text-[var(--color-text-secondary)]">-</span>
                                                <input id="settings-random-frequency-max" type="number" min="1" value={localSettings.randomMessageFrequencyMax} onChange={e => setLocalSettings(prev => ({ ...prev, randomMessageFrequencyMax: +e.target.value }))} className="w-full px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] text-sm" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                        )}

                        {activeTab === 'others' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="flex items-center justify-between text-sm font-medium text-[var(--color-text-interface)] mb-2">
                                        <span className="flex items-center"><FastForward className="w-4 h-4 mr-2" />{t('settings.others.speedupLabel')}</span>
                                        <span className="text-[var(--color-button-primary)] font-semibold">{localSettings.speedup}X</span>
                                    </label>
                                    <p className="text-xs text-[var(--color-text-secondary)] mt-2">{t('settings.others.speedupNote')}</p>
                                    <input id="settings-speedup" type="range" min="1" max="4" step="0.5" value={localSettings.speedup} onChange={e => setLocalSettings(prev => ({ ...prev, speedup: +e.target.value }))} className="w-full accent-[var(--color-button-primary)]" />
                                    <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mt-1"><span>{t('settings.others.slower')}</span><span>{t('settings.others.faster')}</span></div>
                                </div>
                                <div className="pt-4 border-t border-[var(--color-border)]">
                                    <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2"><Languages className="w-4 h-4 mr-2" />{t('settings.others.uiLanguageLabel')}</label>
                                    <select id="settings-ui-language" value={localSettings.uiLanguage ?? (i18n.language as 'ko' | 'en' | 'ja')} onChange={handleLanguageChange} className="w-full px-4 py-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] transition-transform duration-200 text-sm">
                                        <option value="ko">한국어</option>
                                        <option value="en">English</option>
                                        <option value="ja">日本語</option>
                                    </select>
                                </div>
                                <div className="pt-4 border-t border-[var(--color-border)]">
                                    <label className="flex items-center justify-between text-sm font-medium text-[var(--color-text-interface)] mb-2">
                                        <span className="flex items-center"><Palette className="w-4 h-4 mr-2" />{t('settings.others.uiThemeLabel')}</span>
                                    </label>
                                    {/* Four buttons 2x2 (light, dark, system, custom). Selected if matches with localSettings.colorTheme */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleColorThemeChange('light')}
                                            className={`py-2 px-4 rounded-lg text-sm font-medium border ${localSettings.colorTheme === 'light'
                                                ? 'bg-[var(--color-button-primary)] text-[var(--color-text-accent)] border-[var(--color-button-primary-accent)]'
                                                : 'bg-[var(--color-bg-input-secondary)] text-[var(--color-text-interface)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
                                                }`}
                                        >
                                            {t('settings.others.theme.light')}
                                        </button>
                                        <button
                                            onClick={() => handleColorThemeChange('dark')}
                                            className={`py-2 px-4 rounded-lg text-sm font-medium border ${localSettings.colorTheme === 'dark'
                                                ? 'bg-[var(--color-button-primary)] text-[var(--color-text-accent)] border-[var(--color-button-primary-accent)]'
                                                : 'bg-[var(--color-bg-input-secondary)] text-[var(--color-text-interface)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
                                                }`}
                                        >
                                            {t('settings.others.theme.dark')}
                                        </button>
                                        <button
                                            onClick={() => handleColorThemeChange('system')}
                                            className={`py-2 px-4 rounded-lg text-sm font-medium border ${localSettings.colorTheme === 'system'
                                                ? 'bg-[var(--color-button-primary)] text-[var(--color-text-accent)] border-[var(--color-button-primary-accent)]'
                                                : 'bg-[var(--color-bg-input-secondary)] text-[var(--color-text-interface)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
                                                }`}
                                        >
                                            {t('settings.others.theme.system')}
                                        </button>
                                        <button
                                            onClick={() => handleColorThemeChange('custom')}
                                            className={`py-2 px-4 rounded-lg text-sm font-medium border ${localSettings.colorTheme === 'custom'
                                                ? 'bg-[var(--color-button-primary)] text-[var(--color-text-accent)] border-[var(--color-button-primary-accent)]'
                                                : 'bg-[var(--color-bg-input-secondary)] text-[var(--color-text-interface)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
                                                }`}
                                        >
                                            {t('settings.others.theme.custom')}
                                        </button>
                                    </div>
                                    <div className={`pt-4 ${localSettings.colorTheme === 'custom' ? 'block' : 'hidden'}`}>
                                        <ThemeSettings />
                                    </div>
                                </div>
                                <div className="space-y-3 pt-4 border-t border-[var(--color-border)]">
                                    <button onClick={backupStateToFile} id="backup-data-btn" className="w-full py-2 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg text-sm flex items-center justify-center gap-2">
                                        <Upload className="w-4 h-4" /> {t('settings.others.backup.backupButton')}
                                    </button>
                                    <button onClick={importBackup} id="restore-data-btn" className="w-full py-2 px-4 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-lg text-sm flex items-center justify-center gap-2 border border-[var(--color-border)]">
                                        <Download className="w-4 h-4" /> {t('settings.others.backup.restoreButton')}
                                    </button>
                                </div>

                                {/* Sync to server */}
                                <div className="space-y-3 pt-4 border-t border-[var(--color-border)]">
                                    <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)]">
                                        <Cloud className="w-4 h-4 mr-2" /> {t('settings.others.sync.title')}
                                    </label>
                                    <div className="space-y-2">
                                        <label className="text-xs text-[var(--color-text-secondary)]">{t('settings.others.sync.clientIdLabel')}</label>
                                        <input value={localSettings.syncSettings.syncClientId} onChange={e => setLocalSettings(prev => ({ ...prev, syncSettings: { ...prev.syncSettings, syncClientId: e.target.value } }))} className="w-full px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] text-sm" placeholder={t('settings.others.sync.clientIdPlaceholder', { idexample: "my-device-1" })} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-[var(--color-text-secondary)]">{t('settings.others.sync.serverAddrLabel')}</label>
                                        <input value={localSettings.syncSettings.syncBaseUrl} onChange={e => setLocalSettings(prev => ({ ...prev, syncSettings: { ...prev.syncSettings, syncBaseUrl: e.target.value } }))} className="w-full px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] text-sm" placeholder={`http://${window.location.hostname}:3001`} />
                                    </div>
                                    <Toggle
                                        id="settings-sync-enabled-toggle"
                                        label={t('settings.others.sync.autoSyncTitle')}
                                        description={t('settings.others.sync.autoSyncHint')}
                                        checked={!!localSettings.syncSettings.syncEnabled}
                                        onChange={(checked) => setLocalSettings(prev => ({ ...prev, syncSettings: { ...prev.syncSettings, syncEnabled: checked } }))}
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={async () => {
                                            try {
                                                await backupStateToServer(localSettings.syncSettings.syncClientId, localSettings.syncSettings.syncBaseUrl);
                                            } catch (err) {
                                                console.error(err);
                                                if (err instanceof Error && err.cause == 'conflict') {
                                                    alert(t('settings.others.sync.conflict'));
                                                } else {
                                                    alert(t('settings.others.sync.failed'));
                                                }
                                            }
                                        }} className="w-full py-2 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg text-sm flex items-center justify-center gap-2" >
                                            <CloudUpload className="w-4 h-4" /> {t('settings.others.sync.syncNow')}
                                        </button>
                                        <button onClick={async () => {
                                            try {
                                                await restoreStateFromServer(localSettings.syncSettings.syncClientId, localSettings.syncSettings.syncBaseUrl);
                                            } catch (err) {
                                                console.error(err);
                                                alert(t('settings.others.sync.restoreFailed'));
                                            }
                                        }} className="w-full py-2 px-4 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-lg text-sm flex items-center justify-center gap-2 border border-[var(--color-border)]">
                                            <RotateCcw className="w-4 h-4" /> {t('settings.others.sync.restoreRemote')}
                                        </button>
                                    </div>
                                </div>

                                {/* Danger Zone section (collapsed by default at the very bottom) */}
                                <div className="pt-4 border-t border-[var(--color-border)]">
                                    <div className="rounded-lg border border-red-500/30 bg-red-500/5">
                                        <details className="group">
                                            <summary className="px-3 py-2 flex items-center justify-between text-sm font-medium cursor-pointer list-none">
                                                <span className="flex items-center text-red-600">
                                                    <Trash2 className="w-4 h-4 mr-2" /> {t('settings.others.reset.title')}
                                                </span>
                                                <ChevronDown className="w-4 h-4 text-[var(--color-icon-tertiary)] transition-transform group-open:rotate-180" />
                                            </summary>
                                            <div className="px-3 pb-3 space-y-3">
                                                <p className="text-xs text-[var(--color-text-secondary)]">{t('settings.others.reset.desc')}</p>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(t('settings.others.reset.confirm'))) {
                                                            wipeAllState();
                                                        }
                                                    }}
                                                    id="delete-all-data-btn"
                                                    className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm flex items-center justify-center gap-2"
                                                >
                                                    <Trash2 className="w-4 h-4" /> {t('settings.others.reset.deleteButton')}
                                                </button>
                                            </div>
                                        </details>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-6 border-t border-[var(--color-border)] shrink-0">
                    <button onClick={handleSave} className={`w-full py-2.5 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg ${activeTab !== 'others' ? 'transition-colors' : ''}`}>{t('common.save')}</button>
                </div>
            </div>
        </>
    );
}

export default SettingsPanel;
