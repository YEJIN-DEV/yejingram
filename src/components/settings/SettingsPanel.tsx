import { useSelector, useDispatch } from 'react-redux';
import { selectAllSettings } from '../../entities/setting/selectors';
import { useEffect, useState } from 'react';
import type { SettingsState, ApiProvider, ImageApiProvider } from '../../entities/setting/types';
import { Globe, FilePenLine, User, MessageSquarePlus, Shuffle, Download, Upload, FastForward, X, Search, Image } from 'lucide-react';
import { ProviderSettings } from './ProviderSettings';
import { backupStateToFile, restoreStateFromFile } from '../../utils/backup';
import { settingsActions } from '../../entities/setting/slice';
import PersonaManager from './PersonaModal';
import ComfyUISettings from './ComfyUISettings';

interface SettingsPanelProps {
    openPromptModal: () => void;
    onClose: () => void;
}

function SettingsPanel({ openPromptModal, onClose }: SettingsPanelProps) {
    const dispatch = useDispatch();
    const settings = useSelector(selectAllSettings);

    const [localSettings, setLocalSettings] = useState<SettingsState>(settings);
    const [activeTab, setActiveTab] = useState<'ai' | 'scale' | 'persona' | 'proactive' | 'data' | 'comfyui'>('ai');

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
    }

    const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const provider = e.target.value as ApiProvider;
        setLocalSettings(prev => ({ ...prev, apiProvider: provider }));
    };

    const handleImageProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const provider = e.target.value as ImageApiProvider;
        setLocalSettings(prev => ({ ...prev, imageApiProvider: provider }));
    };

    return (
        <>
            <div className="bg-white h-full w-full max-w-full flex flex-col border-r border-gray-200 text-xs md:text-sm">
                <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 shrink-0">
                    <h3 className="text-base md:text-lg font-semibold text-gray-900">설정</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><X className="w-4 h-4 md:w-5 md:h-5 text-gray-500" /></button>
                </div>
                <div className="p-4 md:p-6 space-y-3 md:space-y-4 overflow-y-auto flex-1 min-w-0">
                    {/* Tab Navigation */}
                    <div className="flex border-b border-gray-200 -mx-4 md:-mx-6 px-4 md:px-6 whitespace-nowrap overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('ai')}
                            className={`py-2 md:py-3 px-2.5 md:px-4 text-xs md:text-sm font-medium border-b-2 transition-colors ${activeTab === 'ai'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <Globe className="w-3 h-3 md:w-4 md:h-4 inline mr-1.5 md:mr-2" />
                            AI
                        </button>
                        <button
                            onClick={() => setActiveTab('scale')}
                            className={`py-2 md:py-3 px-2.5 md:px-4 text-xs md:text-sm font-medium border-b-2 transition-colors ${activeTab === 'scale'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <Search className="w-3 h-3 md:w-4 md:h-4 inline mr-1.5 md:mr-2" />
                            배율
                        </button>
                        <button
                            onClick={() => setActiveTab('persona')}
                            className={`py-2 md:py-3 px-2.5 md:px-4 text-xs md:text-sm font-medium border-b-2 transition-colors ${activeTab === 'persona'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <User className="w-3 h-3 md:w-4 md:h-4 inline mr-1.5 md:mr-2" />
                            페르소나
                        </button>
                        <button
                            onClick={() => setActiveTab('proactive')}
                            className={`py-2 md:py-3 px-2.5 md:px-4 text-xs md:text-sm font-medium border-b-2 transition-colors ${activeTab === 'proactive'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <MessageSquarePlus className="w-3 h-3 md:w-4 md:h-4 inline mr-1.5 md:mr-2" />
                            선톡
                        </button>
                        <button
                            onClick={() => setActiveTab('comfyui')}
                            className={`py-2 md:py-3 px-2.5 md:px-4 text-xs md:text-sm font-medium border-b-2 transition-colors ${activeTab === 'comfyui'
                                ? ('border-blue-500 text-blue-600')
                                : ('border-transparent text-gray-500 hover:text-gray-700')
                                }`}
                        >
                            <Image className="w-3 h-3 md:w-4 md:h-4 inline mr-1.5 md:mr-2" />
                            ComfyUI
                        </button>
                        <button
                            onClick={() => setActiveTab('data')}
                            className={`py-2 md:py-3 px-2.5 md:px-4 text-xs md:text-sm font-medium border-b-2 transition-colors ${activeTab === 'data'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <Download className="w-3 h-3 md:w-4 md:h-4 inline mr-1.5 md:mr-2" />
                            데이터
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="mt-6">
                        {activeTab === 'ai' && (
                            <div className="space-y-3 md:space-y-4">
                                <div>
                                    <label className="flex items-center text-xs md:text-sm font-medium text-gray-700 mb-2"><Globe className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" />AI 제공업체</label>
                                    <select id="settings-api-provider" value={localSettings.apiProvider} onChange={handleProviderChange} className="w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-xs md:text-sm">
                                        <option value="gemini">Google Gemini</option>
                                        <option value="vertexai">Google Vertex AI</option>
                                        <option value="claude">Anthropic Claude</option>
                                        <option value="openai">OpenAI</option>
                                        <option value="grok">xAI Grok</option>
                                        <option value="openrouter">OpenRouter</option>
                                        <option value="customOpenAI">Custom OpenAI</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={`flex items-center text-xs md:text-sm font-medium text-gray-700 mb-2`}><Image className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" />이미지 생성 제공업체</label>
                                    <select id="settings-image-api-provider" value={localSettings.imageApiProvider} onChange={handleImageProviderChange} className={`w-full px-3 md:px-4 py-2.5 md:py-3 bg-gray-50 text-gray-900 border-gray-200 rounded-xl border focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-xs md:text-sm`}>
                                        <option value="gemini">Google Gemini</option>
                                        <option value="novelai">NovelAI</option>
                                        <option value="comfyui">ComfyUI</option>
                                    </select>
                                </div>
                                <ProviderSettings settings={localSettings} setSettings={setLocalSettings} />
                                <div>
                                    <button id="open-prompt-modal" onClick={handlePromptModalOpen} className="w-full mt-2 py-2 px-3 md:px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-xs md:text-sm flex items-center justify-center gap-2">
                                        <FilePenLine className="w-4 h-4 md:w-4 md:h-4" /> 프롬프트 수정
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'scale' && (
                            <div className="space-y-3 md:space-y-4">
                                <div>
                                    <label className="flex items-center justify-between text-xs md:text-sm font-medium text-gray-700 mb-2">
                                        <span className="flex items-center"><FastForward className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" />메시지 입력 가속</span>
                                        <span className="text-blue-500 font-semibold">{localSettings.speedup}X</span>
                                    </label>
                                    <p className="text-[11px] md:text-xs text-gray-500 mt-2">* 구조화된 출력 사용중에는 적용되지 않습니다.</p>
                                    <input id="settings-speedup" type="range" min="1" max="4" step="0.5" value={localSettings.speedup} onChange={e => setLocalSettings(prev => ({ ...prev, speedup: +e.target.value }))} className="w-full accent-blue-500" />
                                    <div className="flex justify-between text-xs text-gray-500 mt-1"><span>느리게</span><span>빠르게</span></div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'persona' && <PersonaManager />}

                        {activeTab === 'proactive' && (
                            <div className="space-y-3 md:space-y-4">
                                <div className="py-2">
                                    <label className="flex items-center justify-between text-xs md:text-sm font-medium text-gray-700 cursor-pointer">
                                        <span className="flex items-center"><MessageSquarePlus className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" />연락처 내 선톡 활성화</span>
                                        <div className="relative inline-block w-9 md:w-10 align-middle select-none">
                                            <input type="checkbox" id="settings-proactive-toggle" checked={localSettings.proactiveChatEnabled} onChange={e => setLocalSettings(prev => ({ ...prev, proactiveChatEnabled: e.target.checked }))} className="absolute opacity-0 w-0 h-0 peer" />
                                            <label htmlFor="settings-proactive-toggle" className="block overflow-hidden h-5 md:h-6 rounded-full bg-gray-300 cursor-pointer peer-checked:bg-blue-500"></label>
                                            <span className="absolute left-0.5 top-0.5 block w-4 h-4 md:w-5 md:h-5 rounded-full bg-white transition-transform duration-200 ease-in-out peer-checked:translate-x-3.5 md:peer-checked:translate-x-4"></span>
                                        </div>
                                    </label>
                                </div>
                                <div className="py-2 border-t border-gray-200 mt-2 pt-2">
                                    <label className="flex items-center justify-between text-xs md:text-sm font-medium text-gray-700 cursor-pointer">
                                        <span className="flex items-center"><Shuffle className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" />랜덤 선톡 활성화</span>
                                        <div className="relative inline-block w-9 md:w-10 align-middle select-none">
                                            <input type="checkbox" id="settings-random-first-message-toggle" checked={localSettings.randomFirstMessageEnabled} onChange={e => setLocalSettings(prev => ({ ...prev, randomFirstMessageEnabled: e.target.checked }))} className="absolute opacity-0 w-0 h-0 peer" />
                                            <label htmlFor="settings-random-first-message-toggle" className="block overflow-hidden h-5 md:h-6 rounded-full bg-gray-300 cursor-pointer peer-checked:bg-blue-500"></label>
                                            <span className="absolute left-0.5 top-0.5 block w-4 h-4 md:w-5 md:h-5 rounded-full bg-white transition-transform duration-200 ease-in-out peer-checked:translate-x-3.5 md:peer-checked:translate-x-4"></span>
                                        </div>
                                    </label>
                                    {localSettings.randomFirstMessageEnabled && (
                                        <div id="random-chat-options" className="mt-4 space-y-4">
                                            <div>
                                                <label className="flex items-center justify-between text-xs md:text-sm font-medium text-gray-700 mb-2">
                                                    <span>생성할 인원 수</span>
                                                    <span id="random-character-count-label" className="text-blue-500 font-semibold">{localSettings.randomCharacterCount}명</span>
                                                </label>
                                                <input id="settings-random-character-count" type="range" min="1" max="5" step="1" value={localSettings.randomCharacterCount} onChange={e => setLocalSettings(prev => ({ ...prev, randomCharacterCount: +e.target.value }))} className="w-full accent-blue-500" />
                                            </div>
                                            <div>
                                                <label className="text-xs md:text-sm font-medium text-gray-700 mb-2 block">선톡 시간 간격 (분 단위)</label>
                                                <div className="flex items-center gap-2">
                                                    <input id="settings-random-frequency-min" type="number" min="1" value={localSettings.randomMessageFrequencyMin} onChange={e => setLocalSettings(prev => ({ ...prev, randomMessageFrequencyMin: +e.target.value }))} className="w-full px-3 py-2 bg-gray-50 text-gray-900 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-xs md:text-sm" placeholder="최소" />
                                                    <span className="text-gray-500">-</span>
                                                    <input id="settings-random-frequency-max" type="number" min="1" value={localSettings.randomMessageFrequencyMax} onChange={e => setLocalSettings(prev => ({ ...prev, randomMessageFrequencyMax: +e.target.value }))} className="w-full px-3 py-2 bg-gray-50 text-gray-900 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-xs md:text-sm" placeholder="최대" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'comfyui' && <ComfyUISettings />}

                        {activeTab === 'data' && (
                            <div className="space-y-3">
                                <button onClick={backupStateToFile} id="backup-data-btn" className="w-full py-2 px-3 md:px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-xs md:text-sm flex items-center justify-center gap-2">
                                    <Download className="w-4 h-4" /> 백업하기
                                </button>
                                <button onClick={importBackup} id="restore-data-btn" className="w-full py-2 px-3 md:px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-xs md:text-sm flex items-center justify-center gap-2 border border-gray-200">
                                    <Upload className="w-4 h-4" /> 불러오기
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-4 md:p-6 border-t border-gray-200 shrink-0">
                    <button onClick={handleSave} className="w-full py-2 md:py-2.5 px-3 md:px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">저장</button>
                </div>
            </div>
        </>
    );
}

export default SettingsPanel;
