import { useSelector, useDispatch } from 'react-redux';
import { selectIsSettingsModalOpen, selectAllSettings } from '../../entities/setting/selectors';
import { useEffect, useState } from 'react';
import type { SettingsState, ApiProvider } from '../../entities/setting/types';
import { X, ChevronDown, Globe, FilePenLine, Type, User, BrainCircuit, MessageSquarePlus, Shuffle, Download, Upload } from 'lucide-react';
import { ProviderSettings } from './ProviderSettings';
import { backupStateToFile, restoreStateFromFile } from '../../utils/backup';
import { settingsActions } from '../../entities/setting/slice';

function SettingsModal() {
  const dispatch = useDispatch();
  const isOpen = useSelector(selectIsSettingsModalOpen);
  const settings = useSelector(selectAllSettings);

  const [localSettings, setLocalSettings] = useState<SettingsState>(settings);
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
  }, [settings, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    dispatch(settingsActions.closeSettingsModal());
  };

  const handleSave = () => {
    dispatch(settingsActions.setSettings(localSettings));
    handleClose();
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provider = e.target.value as ApiProvider;
    setLocalSettings(prev => ({ ...prev, apiProvider: provider }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl w-full max-w-md mx-4 flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between p-6 border-b border-gray-700 shrink-0">
          <h3 className="text-lg font-semibold text-white">설정</h3>
          <button onClick={handleClose} className="p-1 hover:bg-gray-700 rounded-full"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-2 overflow-y-auto">
          <details className="group border-b border-gray-700 pb-2">
            <summary className="flex items-center justify-between cursor-pointer list-none py-2">
              <span className="text-base font-medium text-gray-200">AI 설정</span>
              <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div className="content-wrapper">
              <div className="content-inner pt-4 space-y-4">
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-300 mb-2"><Globe className="w-4 h-4 mr-2" />AI 제공업체</label>
                  <select id="settings-api-provider" value={localSettings.apiProvider} onChange={handleProviderChange} className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border-0 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 text-sm">
                    <option value="gemini">Google Gemini</option>
                    <option value="vertexai">Google Vertex AI</option>
                    <option value="claude">Anthropic Claude</option>
                    <option value="openai">OpenAI ChatGPT</option>
                    <option value="grok">xAI Grok</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="customOpenAI">Custom OpenAI</option>
                  </select>
                </div>
                <ProviderSettings settings={localSettings} setSettings={setLocalSettings} />
                <div>
                  <button id="open-prompt-modal" onClick={() => dispatch(settingsActions.openPromptModal())} className="w-full mt-2 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                    <FilePenLine className="w-4 h-4" /> 프롬프트 수정
                  </button>
                </div>
              </div>
            </div>
          </details>
          <details className="group border-b border-gray-700 pb-2">
            <summary className="flex items-center justify-between cursor-pointer list-none py-2">
              <span className="text-base font-medium text-gray-200">배율</span>
              <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div className="content-wrapper">
              <div className="content-inner pt-4 space-y-4">
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-300 mb-2"><Type className="w-4 h-4 mr-2" />UI 크기</label>
                  <input id="settings-font-scale" type="range" min="0.8" max="1.4" step="0.1" value={localSettings.fontScale} onChange={e => setLocalSettings(prev => ({ ...prev, fontScale: +e.target.value }))} className="w-full" />
                  <div className="flex justify-between text-xs text-gray-400 mt-1"><span>작게</span><span>크게</span></div>
                </div>
              </div>
            </div>
          </details>
          <details className="group border-b border-gray-700 pb-2">
            <summary className="flex items-center justify-between cursor-pointer list-none py-2">
              <span className="text-base font-medium text-gray-200">당신의 페르소나</span>
              <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div className="content-wrapper">
              <div className="content-inner pt-4 space-y-4">
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-300 mb-2"><User className="w-4 h-4 mr-2" />당신을 어떻게 불러야 할까요?</label>
                  <input id="settings-user-name" type="text" placeholder="이름, 혹은 별명을 적어주세요" value={localSettings.userName} onChange={e => setLocalSettings(prev => ({ ...prev, userName: e.target.value }))} className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border-0 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 text-sm" />
                </div>
                <div>
                  <label className="flex items-center text-sm font-medium text-gray-300 mb-2"><BrainCircuit className="w-4 h-4 mr-2" />당신은 어떤 사람인가요?</label>
                  <textarea id="settings-user-desc" placeholder="어떤 사람인지 알려주세요" value={localSettings.userDescription} onChange={e => setLocalSettings(prev => ({ ...prev, userDescription: e.target.value }))} className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border-0 focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 text-sm" rows={3}></textarea>
                </div>
              </div>
            </div>
          </details>
          <details className="group border-b border-gray-700 pb-2">
            <summary className="flex items-center justify-between cursor-pointer list-none py-2">
              <span className="text-base font-medium text-gray-200">선톡 설정</span>
              <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div className="content-wrapper">
              <div className="content-inner pt-4 space-y-4">
                <div className="py-2">
                  <label className="flex items-center justify-between text-sm font-medium text-gray-300 cursor-pointer">
                    <span className="flex items-center"><MessageSquarePlus className="w-4 h-4 mr-2" />연락처 내 선톡 활성화</span>
                    <div className="relative inline-block w-10 align-middle select-none">
                      <input type="checkbox" id="settings-proactive-toggle" checked={localSettings.proactiveChatEnabled} onChange={e => setLocalSettings(prev => ({ ...prev, proactiveChatEnabled: e.target.checked }))} className="absolute opacity-0 w-0 h-0 peer" />
                      <label htmlFor="settings-proactive-toggle" className="block overflow-hidden h-6 rounded-full bg-gray-600 cursor-pointer peer-checked:bg-blue-600"></label>
                      <span className="absolute left-0.5 top-0.5 block w-5 h-5 rounded-full bg-white transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                    </div>
                  </label>
                </div>
                <div className="py-2 border-t border-gray-700 mt-2 pt-2">
                  <label className="flex items-center justify-between text-sm font-medium text-gray-300 cursor-pointer">
                    <span className="flex items-center"><Shuffle className="w-4 h-4 mr-2" />랜덤 선톡 활성화</span>
                    <div className="relative inline-block w-10 align-middle select-none">
                      <input type="checkbox" id="settings-random-first-message-toggle" checked={localSettings.randomFirstMessageEnabled} onChange={e => setLocalSettings(prev => ({ ...prev, randomFirstMessageEnabled: e.target.checked }))} className="absolute opacity-0 w-0 h-0 peer" />
                      <label htmlFor="settings-random-first-message-toggle" className="block overflow-hidden h-6 rounded-full bg-gray-600 cursor-pointer peer-checked:bg-blue-600"></label>
                      <span className="absolute left-0.5 top-0.5 block w-5 h-5 rounded-full bg-white transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                    </div>
                  </label>
                  {localSettings.randomFirstMessageEnabled && (
                    <div id="random-chat-options" className="mt-4 space-y-4">
                      <div>
                        <label className="flex items-center justify-between text-sm font-medium text-gray-300 mb-2">
                          <span>생성할 인원 수</span>
                          <span id="random-character-count-label" className="text-blue-400 font-semibold">{localSettings.randomCharacterCount}명</span>
                        </label>
                        <input id="settings-random-character-count" type="range" min="1" max="5" step="1" value={localSettings.randomCharacterCount} onChange={e => setLocalSettings(prev => ({ ...prev, randomCharacterCount: +e.target.value }))} className="w-full" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-300 mb-2 block">선톡 시간 간격 (분 단위)</label>
                        <div className="flex items-center gap-2">
                          <input id="settings-random-frequency-min" type="number" min="1" value={localSettings.randomMessageFrequencyMin} onChange={e => setLocalSettings(prev => ({ ...prev, randomMessageFrequencyMin: +e.target.value }))} className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border-0 focus:ring-2 focus:ring-blue-500/50 text-sm" placeholder="최소" />
                          <span className="text-gray-400">-</span>
                          <input id="settings-random-frequency-max" type="number" min="1" value={localSettings.randomMessageFrequencyMax} onChange={e => setLocalSettings(prev => ({ ...prev, randomMessageFrequencyMax: +e.target.value }))} className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border-0 focus:ring-2 focus:ring-blue-500/50 text-sm" placeholder="최대" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </details>
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer list-none py-2">
              <span className="text-base font-medium text-gray-200">데이터 관리</span>
              <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div className="content-wrapper">
              <div className="content-inner pt-4 space-y-2">
                <button onClick={backupStateToFile} id="backup-data-btn" className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> 백업하기
                </button>
                <button onClick={importBackup} id="restore-data-btn" className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" /> 불러오기
                </button>
              </div>
            </div>
          </details>
        </div>
        <div className="p-6 mt-auto border-t border-gray-700 shrink-0 flex justify-end space-x-3">
          <button onClick={handleClose} className="flex-1 py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">취소</button>
          <button onClick={handleSave} className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">저장</button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;