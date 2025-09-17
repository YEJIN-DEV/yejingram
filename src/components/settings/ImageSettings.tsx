import { useRef, useState, useEffect, type JSX } from 'react';
import { Globe, Code, Clock, Key, Image } from 'lucide-react';
import ArtStyleList from './ArtStyleManagerUI';
import jsonEditor from 'jsoneditor';
import 'jsoneditor/dist/jsoneditor.css';
import type { SettingsState } from '../../entities/setting/types';
import type { ImageApiProvider } from '../../entities/setting/image/types';
import { initialImageApiConfigs } from '../../entities/setting/image/slice';

interface ComfySettingsProps {
  settings: SettingsState;
  setSettings: React.Dispatch<React.SetStateAction<SettingsState>>;
}

type CheckResult = {
  positive: boolean;
  negative: boolean;
};

const imageModels: string[] = [
  'gemini-2.5-flash-image-preview',
  'gemini-2.0-flash-preview-image-generation',
  'nai-diffusion-4-5-curated',
  'nai-diffusion-4-full',
  'nai-diffusion-4-curated-preview',
  'comfy',
];

function checkPositiveNegative(data: any): CheckResult {
  const result: CheckResult = { positive: false, negative: false };

  function search(item: any): void {
    if (item === null || item === undefined) return;

    if (typeof item === "string") {
      if (item.includes("{{positive}}")) {
        result.positive = true;
      }
      if (item.includes("{{negative}}")) {
        result.negative = true;
      }
    } else if (Array.isArray(item)) {
      for (const v of item) {
        search(v);
        if (result.positive && result.negative) return; // 둘 다 찾으면 조기 종료
      }
    } else if (typeof item === "object") {
      for (const v of Object.values(item)) {
        search(v);
        if (result.positive && result.negative) return;
      }
    }
  }

  search(data);
  return result;
}

export function ImageSettings({ settings, setSettings }: ComfySettingsProps): JSX.Element {
  const [isValidWorkflow, setIsValidWorkflow] = useState(true);
  const editorInstance = useRef<HTMLDivElement>(null);
  const jsonEditorRef = useRef<jsonEditor>(null);

  const imageProvider = settings.imageSettings.imageProvider;
  const imageConfig = settings.imageSettings.config[imageProvider];

  const handleImageModelConfigChange = (provider: ImageApiProvider, key: string, value: any) => {
    setSettings(prev => {
      const currentImageProviderConfig = prev.imageSettings.config[provider] ?? initialImageApiConfigs[provider];
      if (key === 'baseUrl' || key === 'json' || key === 'timeout') {
        // For ComfyUI custom fields
        const custom = currentImageProviderConfig.custom ?? { baseUrl: '', json: '', timeout: 60 };
        return {
          ...prev,
          imageSettings: {
            ...prev.imageSettings,
            imageProvider: provider,
            config: {
              ...prev.imageSettings.config,
              [provider]: { ...currentImageProviderConfig, custom: { ...custom, [key]: value } }
            }
          }
        };
      } else {
        return {
          ...prev,
          imageSettings: {
            ...prev.imageSettings,
            imageProvider: provider,
            config: {
              ...prev.imageSettings.config,
              [provider]: { ...currentImageProviderConfig, [key]: value }
            }
          }
        };
      }
    });
  };

  const handleImageModelSelect = (model: string) => {
    let provider: ImageApiProvider;
    if (model === 'comfy') {
      provider = 'comfy';
    } else if (model.startsWith('nai-')) {
      provider = 'novelai';
    } else {
      provider = 'gemini';
    }
    handleImageModelConfigChange(provider, 'model', model);
  };

  useEffect(() => {
    if (imageProvider === 'comfy' && editorInstance.current && !jsonEditorRef.current) {
      const initialJson = imageConfig.custom?.json || '{"3": {"inputs": {"seed": 378669112180739, "steps": 28, "cfg": 6, "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}, "class_type": "KSampler", "_meta": {"title": "KSampler"}}}';
      jsonEditorRef.current = new jsonEditor(editorInstance.current, {
        mode: 'code',
        onChange: () => {
          if (jsonEditorRef.current) {
            try {
              const json = jsonEditorRef.current.get();
              handleImageModelConfigChange('comfy', 'json', JSON.stringify(json));
            } catch (e) {
              // Invalid JSON, ignore
            }
          }
        },
        onValidationError: (errors) => {
          setIsValidWorkflow(errors.length === 0);
        },
        onValidate: function (json) {
          let errors = [];

          let check = checkPositiveNegative(json);

          if (!check.positive) {
            errors.push({
              path: ['positive'],
              message: '"{{positive}}"가 누락되었습니다.'
            });
          }

          if (!check.negative) {
            errors.push({
              path: ['negative'],
              message: '"{{negative}}"가 누락되었습니다.'
            });
          }

          return errors;
        }
      }, JSON.parse(initialJson));

    } else if (imageProvider !== 'comfy' && jsonEditorRef.current) {
      // ComfyUI가 아닌 경우 jsonEditor 정리
      jsonEditorRef.current.destroy?.();
      jsonEditorRef.current = null;
    }

    return () => {
      if (jsonEditorRef.current) {
        jsonEditorRef.current.destroy?.();
        jsonEditorRef.current = null;
      }
    };
  }, [imageProvider]);


  return (
    <div className="space-y-4">
      {/* 이미지 생성용 API 키 */}
      <div>
        <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><Key className="w-4 h-4 mr-2" />이미지 생성용 API 키</label>
        <input
          type="password"
          value={imageConfig.apiKey || ''}
          onChange={e => handleImageModelConfigChange(imageProvider, 'apiKey', e.target.value)}
          placeholder="이미지 모델 API 키를 입력하세요"
          className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm"
        />
      </div>

      {/* 이미지 생성 모델 */}
      <div>
        <label className="flex items-center text-sm font-medium text-gray-700 mb-2"><Image className="w-4 h-4 mr-2" />이미지 생성 모델</label>
        {imageModels.length > 0 && (
          <div className="grid grid-cols-1 gap-2">
            {imageModels.map(model => (
              <button
                key={model}
                type="button"
                onClick={() => handleImageModelSelect(model)}
                className={`model-select-btn px-3 py-2 text-left text-sm rounded-lg transition-colors border ${imageConfig.model === model ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'}`}>
                {model}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Gemini 참고 */}
      {imageProvider === 'gemini' && (
        <div className="mb-3">
          <p className="text-xs text-gray-500">참고: Gemini는 이미지 생성이 검열될 수 있습니다.</p>
        </div>
      )}

      {/* ComfyUI 관련 설정 - ComfyUI가 선택된 경우에만 표시 */}
      {imageProvider === 'comfy' && (
        <>
          {/* ComfyUI URL */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Globe className="w-4 h-4 mr-2" />
              ComfyUI 요청 URL
            </label>
            <input
              type="url"
              value={imageConfig.custom?.baseUrl || ''}
              onChange={(e) => handleImageModelConfigChange('comfy', 'baseUrl', e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 text-gray-900 border-gray-200 rounded-xl border focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              ComfyUI API 서버의 기본 URL을 입력하세요 (Cloudflare Tunnel 포함)
            </p>
          </div>

          {/* Workflow JSON */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <Code className="w-4 h-4 mr-2" />
              Workflow JSON
              {!isValidWorkflow && (
                <span className="ml-2 text-xs text-red-500">⚠ Invalid JSON</span>
              )}
            </label>

            <div
              ref={editorInstance}
              className="prose min-h-full resize-y overflow-auto border border-gray-300 rounded-lg"
            />

            <p className="text-xs text-gray-500 mt-1">
              ComfyUI API에 전송할 워크플로우 JSON 구조를 입력하세요.<br />이미지 입력에 따라 프롬프트가 동적으로 삽입됩니다.<br />우측 하단의 핸들을 드래그하여 에디터 높이를 조절할 수 있습니다.
            </p>
          </div>

          {/* Timeout */}
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Timeout (초)
              </span>
              <span className="text-blue-500 font-semibold">
                {imageConfig.custom?.timeout || 60}초
              </span>
            </label>
            <input
              type="range"
              min={30}
              max={600}
              step={30}
              value={imageConfig.custom?.timeout || 60}
              onChange={(e) => handleImageModelConfigChange('comfy', 'timeout', parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>30초</span>
              <span>10분</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              이미지 생성 요청의 최대 대기 시간을 설정합니다.
            </p>
          </div>
        </>
      )}

      {/* 그림체 설정 (ArtStyleManagerUI 연동) */}
      <div className="space-y-4 my-6">
        <div className="p-4 rounded-xl bg-gray-100">
          <ArtStyleList />
        </div>
      </div>
    </div>
  );
}

