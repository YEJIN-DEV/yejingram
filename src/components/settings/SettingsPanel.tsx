import { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectAllSettings } from '../../entities/setting/selectors';
import type { SettingsState, ApiProvider } from '../../entities/setting/types';
import { Globe, FilePenLine, User, MessageSquarePlus, Shuffle, Download, Upload, FastForward, X, Image, CircleEllipsis, Palette } from 'lucide-react';
import { ProviderSettings } from './ProviderSettings';
import { backupStateToFile, restoreStateFromFile } from '../../utils/backup';
import { settingsActions } from '../../entities/setting/slice';
import PersonaManager from './PersonaModal';
import { ImageSettings } from './image/ImageSettings';
import ThemeSettings from './ThemeSettings';

interface SettingsPanelProps {
    openPromptModal: () => void;
    onClose: () => void;
}

function SettingsPanel({ openPromptModal, onClose }: SettingsPanelProps) {
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
                await restoreStateFromFile(file);
                alert("백업 파일이 성공적으로 불러와졌습니다.");
            } catch (err) {
                console.error(err);
                alert("백업 파일 불러오기 실패");
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

    return (
        <>
            <div className="fixed md:relative top-0 bottom-0 z-40 w-full max-w-sm md:max-w-lg left-0 md:left-auto bg-[var(--color-bg-main)] h-full flex flex-col border-r border-[var(--color-border)]">
                <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] shrink-0">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">설정</h3>
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
                            AI
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
                                이미지
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
                            페르소나
                        </button>
                        <button
                            onClick={() => setActiveTab('proactive')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${activeTab === 'proactive'
                                ? 'border-[var(--color-focus-border)] text-[var(--color-button-primary-accent)]'
                                : 'border-transparent text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'
                                }`}
                        >
                            <MessageSquarePlus className="w-4 h-4 inline mr-2" />
                            선톡
                        </button>
                        <button
                            onClick={() => setActiveTab('others')}
                            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors flex-shrink-0 ${activeTab === 'others'
                                ? 'border-[var(--color-focus-border)] text-[var(--color-button-primary-accent)]'
                                : 'border-transparent text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'
                                }`}
                        >
                            <CircleEllipsis className="w-4 h-4 inline mr-2" />
                            기타 설정
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="mt-6">
                        {activeTab === 'ai' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2"><Globe className="w-4 h-4 mr-2" />AI 제공업체</label>
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
                                        <FilePenLine className="w-4 h-4" /> 프롬프트 수정
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'image' && <ImageSettings settings={localSettings} setSettings={setLocalSettings} />}

                        {activeTab === 'persona' && <PersonaManager />}

                        {activeTab === 'proactive' && (
                            <div className="space-y-4">
                                <div className="py-2">
                                    <label className="flex items-center justify-between text-sm font-medium text-[var(--color-text-interface)] cursor-pointer">
                                        <span className="flex items-center"><MessageSquarePlus className="w-4 h-4 mr-2" />연락처 내 선톡 활성화</span>
                                        <div className="relative inline-block w-10 align-middle select-none">
                                            <input type="checkbox" id="settings-proactive-toggle" checked={localSettings.proactiveChatEnabled} onChange={e => setLocalSettings(prev => ({ ...prev, proactiveChatEnabled: e.target.checked }))} className="absolute opacity-0 w-0 h-0 peer" />
                                            <label htmlFor="settings-proactive-toggle" className="block overflow-hidden h-6 rounded-full bg-[var(--color-toggle-off)] cursor-pointer peer-checked:bg-[var(--color-toggle-on)]"></label>
                                            <span className="absolute left-0.5 top-0.5 block w-5 h-5 rounded-full bg-[var(--color-bg-main)] transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                                        </div>
                                    </label>
                                </div>
                                <div className="py-2 border-t border-[var(--color-border)] mt-2 pt-2">
                                    <label className="flex items-center justify-between text-sm font-medium text-[var(--color-text-interface)] cursor-pointer">
                                        <span className="flex items-center"><Shuffle className="w-4 h-4 mr-2" />랜덤 선톡 활성화</span>
                                        <div className="relative inline-block w-10 align-middle select-none">
                                            <input type="checkbox" id="settings-random-first-message-toggle" checked={localSettings.randomFirstMessageEnabled} onChange={e => setLocalSettings(prev => ({ ...prev, randomFirstMessageEnabled: e.target.checked }))} className="absolute opacity-0 w-0 h-0 peer" />
                                            <label htmlFor="settings-random-first-message-toggle" className="block overflow-hidden h-6 rounded-full bg-[var(--color-toggle-off)] cursor-pointer peer-checked:bg-[var(--color-toggle-on)]"></label>
                                            <span className="absolute left-0.5 top-0.5 block w-5 h-5 rounded-full bg-[var(--color-bg-main)] transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                                        </div>
                                    </label>
                                    {localSettings.randomFirstMessageEnabled && (
                                        <div id="random-chat-options" className="mt-4 space-y-4">
                                            <div>
                                                <label className="flex items-center justify-between text-sm font-medium text-[var(--color-text-interface)] mb-2">
                                                    <span>생성할 인원 수</span>
                                                    <span id="random-character-count-label" className="text-[var(--color-button-primary)] font-semibold">{localSettings.randomCharacterCount}명</span>
                                                </label>
                                                <input id="settings-random-character-count" type="range" min="1" max="5" step="1" value={localSettings.randomCharacterCount} onChange={e => setLocalSettings(prev => ({ ...prev, randomCharacterCount: +e.target.value }))} className="w-full accent-[var(--color-button-primary)]" />
                                            </div>
                                            <div>
                                                <label className="text-sm font-medium text-[var(--color-text-interface)] mb-2 block">선톡 시간 간격 (분 단위)</label>
                                                <div className="flex items-center gap-2">
                                                    <input id="settings-random-frequency-min" type="number" min="1" value={localSettings.randomMessageFrequencyMin} onChange={e => setLocalSettings(prev => ({ ...prev, randomMessageFrequencyMin: +e.target.value }))} className="w-full px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] text-sm" placeholder="최소" />
                                                    <span className="text-[var(--color-text-secondary)]">-</span>
                                                    <input id="settings-random-frequency-max" type="number" min="1" value={localSettings.randomMessageFrequencyMax} onChange={e => setLocalSettings(prev => ({ ...prev, randomMessageFrequencyMax: +e.target.value }))} className="w-full px-3 py-2 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] text-sm" placeholder="최대" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'others' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="flex items-center justify-between text-sm font-medium text-[var(--color-text-interface)] mb-2">
                                        <span className="flex items-center"><FastForward className="w-4 h-4 mr-2" />메시지 입력 가속</span>
                                        <span className="text-[var(--color-button-primary)] font-semibold">{localSettings.speedup}X</span>
                                    </label>
                                    <p className="text-xs text-[var(--color-text-secondary)] mt-2">* 구조화된 출력 사용중에는 적용되지 않습니다.</p>
                                    <input id="settings-speedup" type="range" min="1" max="4" step="0.5" value={localSettings.speedup} onChange={e => setLocalSettings(prev => ({ ...prev, speedup: +e.target.value }))} className="w-full accent-[var(--color-button-primary)]" />
                                    <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mt-1"><span>느리게</span><span>빠르게</span></div>
                                </div>
                                <div className="pt-4 border-t border-[var(--color-border)]">
                                    <label className="flex items-center justify-between text-sm font-medium text-[var(--color-text-interface)] mb-2">
                                        <span className="flex items-center"><Palette className="w-4 h-4 mr-2" />UI 테마</span>
                                    </label>
                                    {/* Four buttons 2x2 (light, dark, system, custom). Selected if matches with localSettings.colorTheme */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => handleColorThemeChange('light')}
                                            className={`py-2 px-4 rounded-lg text-xs font-medium border transition-colors ${localSettings.colorTheme === 'light'
                                                ? 'bg-[var(--color-button-primary)] text-[var(--color-text-accent)] border-[var(--color-button-primary-accent)]'
                                                : 'bg-[var(--color-bg-input-secondary)] text-[var(--color-text-interface)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
                                                }`}
                                        >
                                            라이트 테마
                                        </button>
                                        <button
                                            onClick={() => handleColorThemeChange('dark')}
                                            className={`py-2 px-4 rounded-lg text-xs font-medium border transition-colors ${localSettings.colorTheme === 'dark'
                                                ? 'bg-[var(--color-button-primary)] text-[var(--color-text-accent)] border-[var(--color-button-primary-accent)]'
                                                : 'bg-[var(--color-bg-input-secondary)] text-[var(--color-text-interface)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
                                                }`}
                                        >
                                            다크 테마
                                        </button>
                                        <button
                                            onClick={() => handleColorThemeChange('system')}
                                            className={`py-2 px-4 rounded-lg text-xs font-medium border transition-colors ${localSettings.colorTheme === 'system'
                                                ? 'bg-[var(--color-button-primary)] text-[var(--color-text-accent)] border-[var(--color-button-primary-accent)]'
                                                : 'bg-[var(--color-bg-input-secondary)] text-[var(--color-text-interface)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
                                                }`}
                                        >
                                            시스템 기본값
                                        </button>
                                        <button
                                            onClick={() => handleColorThemeChange('custom')}
                                            className={`py-2 px-4 rounded-lg text-xs font-medium border transition-colors ${localSettings.colorTheme === 'custom'
                                                ? 'bg-[var(--color-button-primary)] text-[var(--color-text-accent)] border-[var(--color-button-primary-accent)]'
                                                : 'bg-[var(--color-bg-input-secondary)] text-[var(--color-text-interface)] border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
                                                }`}
                                        >
                                            커스텀 테마
                                        </button>
                                    </div>
                                    <div className={`pt-4 ${localSettings.colorTheme === 'custom' ? 'block' : 'hidden'}`}>
                                        <ThemeSettings />
                                    </div>
                                </div>
                                <div className="space-y-3 pt-4 border-t border-[var(--color-border)]">
                                    <button onClick={backupStateToFile} id="backup-data-btn" className="w-full py-2 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                        <Download className="w-4 h-4" /> 백업하기
                                    </button>
                                    <button onClick={importBackup} id="restore-data-btn" className="w-full py-2 px-4 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-lg transition-colors text-sm flex items-center justify-center gap-2 border border-[var(--color-border)]">
                                        <Upload className="w-4 h-4" /> 불러오기
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-6 border-t border-[var(--color-border)] shrink-0">
                    <button onClick={handleSave} className="w-full py-2.5 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg transition-colors">저장</button>
                </div>
            </div>
        </>
    );
}

export default SettingsPanel;
