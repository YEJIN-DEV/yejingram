import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectIsDarkMode, selectAllSettings } from '../../entities/setting/selectors';
import { settingsActions } from '../../entities/setting/slice';
import { Globe, Code, Clock, Sparkles } from 'lucide-react';
import type { ComfyUIConfig } from '../../entities/setting/types';
import ArtStyleManager from './ArtStyleModal';
import { selectSelectedArtStyle } from '../../entities/setting/selectors';

interface ComfyUISettingsProps {
    // ComfyUI 설정을 위한 props (필요시 추가)
}

const ComfyUISettings: React.FC<ComfyUISettingsProps> = () => {
    const dispatch = useDispatch();
    const settings = useSelector(selectAllSettings);
    const isDarkMode = useSelector(selectIsDarkMode);
    const { comfyUIConfig } = settings;
    const selectedArtStyle = useSelector(selectSelectedArtStyle);

    // ComfyUI 설정 업데이트 핸들러
    const handleConfigUpdate = (updates: Partial<ComfyUIConfig>) => {
        dispatch(settingsActions.setComfyUIConfig(updates));
    };

    // 워크플로우 JSON 포맷팅 및 검증
    const formatWorkflow = (workflowStr: string) => {
        try {
            const parsed = JSON.parse(workflowStr);
            return JSON.stringify(parsed, null, 2);
        } catch {
            return workflowStr;
        }
    };

    // 워크플로우 유효성 검사
    const isValidWorkflow = (workflowStr: string) => {
        try {
            JSON.parse(workflowStr);
            return true;
        } catch {
            return false;
        }
    };

    return (
        <div className="space-y-4">
            {/* ComfyUI URL 설정 */}
            <div>
                <label className={`flex items-center text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    <Globe className="w-4 h-4 mr-2" />
                    ComfyUI 요청 URL
                </label>
                <input
                    type="url"
                    value={comfyUIConfig.baseUrl}
                    onChange={(e) => handleConfigUpdate({ baseUrl: e.target.value })}
                    placeholder="https://recordings-depend-designers-hearing.trycloudflare.com"
                    className={`w-full px-4 py-3 ${isDarkMode
                        ? 'bg-gray-700 text-gray-100 border-gray-600'
                        : 'bg-gray-50 text-gray-900 border-gray-200'
                        } rounded-xl border focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm font-mono`}
                />
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                    ComfyUI API 서버의 기본 URL을 입력하세요 (Cloudflare Tunnel 포함)
                </p>
            </div>

            {/* Workflow JSON 설정 */}
            <div>
                <label className={`flex items-center text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    <Code className="w-4 h-4 mr-2" />
                    Workflow JSON
                    {!isValidWorkflow(comfyUIConfig.workflow) && (
                        <span className="ml-2 text-xs text-red-500">⚠ Invalid JSON</span>
                    )}
                </label>
                <textarea
                    value={comfyUIConfig.workflow}
                    onChange={(e) => handleConfigUpdate({ workflow: e.target.value })}
                    placeholder='{"3": {"inputs": {"seed": 378669112180739, "steps": 28, "cfg": 6, "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}, "class_type": "KSampler", "_meta": {"title": "KSampler"}}}'
                    rows={8}
                    className={`w-full px-4 py-3 ${isDarkMode
                        ? 'bg-gray-700 text-gray-100 border-gray-600'
                        : 'bg-gray-50 text-gray-900 border-gray-200'
                        } rounded-xl border focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm font-mono resize-y ${!isValidWorkflow(comfyUIConfig.workflow) ? 'border-red-500' : ''
                        }`}
                />
                <div className="mt-2 flex gap-2">
                    <button
                        onClick={() => {
                            try {
                                const formatted = formatWorkflow(comfyUIConfig.workflow);
                                handleConfigUpdate({ workflow: formatted });
                            } catch {
                                // JSON이 유효하지 않은 경우 에러 표시는 이미 위에서 처리됨
                            }
                        }}
                        disabled={!isValidWorkflow(comfyUIConfig.workflow)}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${isValidWorkflow(comfyUIConfig.workflow)
                            ? `${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`
                            : `${isDarkMode ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-400'} cursor-not-allowed`
                            }`}
                    >
                        Format JSON
                    </button>
                </div>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                    ComfyUI API에 전송할 워크플로우 JSON 구조를 입력하세요.<br />이미지 입력에 따라 프롬프트가 동적으로 삽입됩니다.
                </p>
            </div>

            {/* Timeout 설정 */}
            <div>
                <label className={`flex items-center justify-between text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        Timeout (초)
                    </span>
                    <span className={`${isDarkMode ? 'text-blue-400' : 'text-blue-500'} font-semibold`}>
                        {comfyUIConfig.timeout}초
                    </span>
                </label>
                <input
                    type="range"
                    min="30"
                    max="600"
                    step="30"
                    value={comfyUIConfig.timeout}
                    onChange={(e) => handleConfigUpdate({ timeout: parseInt(e.target.value) })}
                    className="w-full accent-blue-500"
                />
                <div className={`flex justify-between text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                    <span>30초</span>
                    <span>10분</span>
                </div>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-1`}>
                    이미지 생성 요청의 최대 대기 시간을 설정합니다.
                </p>
            </div>

            {/* 자동 이미지 생성 설정 */}
            <div>
                <label className={`flex items-center justify-between text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} cursor-pointer`}>
                    <span className="flex items-center">
                        <Sparkles className="w-4 h-4 mr-2" />
                        봇 자동 이미지 생성
                    </span>
                    <div className="relative inline-block w-10 align-middle select-none">
                        <input
                            type="checkbox"
                            id="auto-image-generation-toggle"
                            checked={settings.autoImageGeneration}
                            onChange={(e) => dispatch(settingsActions.setAutoImageGeneration(e.target.checked))}
                            className="absolute opacity-0 w-0 h-0 peer"
                        />
                        <label
                            htmlFor="auto-image-generation-toggle"
                            className={`block overflow-hidden h-6 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'} cursor-pointer peer-checked:bg-blue-500`}
                        ></label>
                        <span className="absolute left-0.5 top-0.5 block w-5 h-5 rounded-full bg-white transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                    </div>
                </label>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-2`}>
                    활성화하면 봇이 텍스트 메시지를 보낼 때마다 자동으로 해당 내용에 맞는 이미지를 생성합니다.<br />이미지는 백그라운드에서 생성되며 완성되면 메시지에 자동으로 추가됩니다.
                </p>
            </div>

            {/* 그림체 설정 */}
            <div className="space-y-4 my-6">
                <ArtStyleManager />
            </div>

            {/* 설정 미리보기 */}
            <div className={`p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded-xl`}>
                <h4 className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                    설정 미리보기
                </h4>
                <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} font-mono space-y-1`}>
                    <div><strong>URL:</strong> {comfyUIConfig.baseUrl || '(미설정)'}</div>
                    <div><strong>Workflow 상태:</strong> {
                        isValidWorkflow(comfyUIConfig.workflow)
                            ? '✓ 유효한 JSON'
                            : '✗ 유효하지 않은 JSON'
                    }</div>
                    <div><strong>Timeout:</strong> {comfyUIConfig.timeout}초</div>
                    <div><strong>자동 이미지 생성:</strong> {settings.autoImageGeneration ? '✓ 활성화' : '✗ 비활성화'}</div>
                    <div><strong>선택된 그림체:</strong> {selectedArtStyle ? selectedArtStyle.name : '없음'}</div>
                    {selectedArtStyle && (
                        <div className="mt-1 pl-4 border-l-2 border-gray-300">
                            <div className="text-xs"><strong>프롬프트:</strong> {selectedArtStyle.prompt || '비어있음'}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ComfyUISettings;