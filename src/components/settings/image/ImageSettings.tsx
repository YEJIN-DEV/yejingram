import { useRef, useState, useEffect, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Code, Clock, Key, Image } from 'lucide-react';
import ArtStyleList from './ArtStyleManagerUI';
import jsonEditor from 'jsoneditor';
import 'jsoneditor/dist/jsoneditor.css';
import type { SettingsState } from '../../../entities/setting/types';
import type { ImageApiProvider } from '../../../entities/setting/image/types';
import { initialImageApiConfigs } from '../../../entities/setting/image/slice';

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
  'nai-diffusion-4-5-full',
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
  const { t } = useTranslation();
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
              message: t('settings.image.comfy.validation.positiveMissing')
            });
          }

          if (!check.negative) {
            errors.push({
              path: ['negative'],
              message: t('settings.image.comfy.validation.negativeMissing')
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
        <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2"><Key className="w-4 h-4 mr-2" />{t('settings.image.apiKeyLabel')}</label>
        <input
          type="password"
          value={imageConfig.apiKey || ''}
          onChange={e => handleImageModelConfigChange(imageProvider, 'apiKey', e.target.value)}
          placeholder={t('settings.image.apiKeyPlaceholder')}
          className="w-full px-4 py-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] transition-all duration-200 text-sm"
        />
      </div>

      {/* 이미지 생성 모델 */}
      <div>
        <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2"><Image className="w-4 h-4 mr-2" />{t('settings.image.modelLabel')}</label>
        {imageModels.length > 0 && (
          <div className="grid grid-cols-1 gap-2">
            {imageModels.map(model => (
              <button
                key={model}
                type="button"
                onClick={() => handleImageModelSelect(model)}
                className={`model-select-btn px-3 py-2 text-left text-sm rounded-lg transition-colors border ${imageConfig.model === model ? 'bg-[var(--color-button-primary)] text-[var(--color-text-accent)] border-[var(--color-button-primary)]' : 'bg-[var(--color-bg-input-secondary)] text-[var(--color-text-interface)] hover:bg-[var(--color-bg-hover)] border-[var(--color-border)]'}`}>
                {model}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Gemini 참고 */}
      {imageProvider === 'gemini' && (
        <div className="mb-3">
          <p className="text-xs text-[var(--color-text-informative-primary)]">{t('settings.image.geminiNote')}</p>
        </div>
      )}

      {/* ComfyUI 관련 설정 - ComfyUI가 선택된 경우에만 표시 */}
      {imageProvider === 'comfy' && (
        <>
          {/* ComfyUI URL */}
          <div>
            <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2">
              <Globe className="w-4 h-4 mr-2" />
              {t('settings.image.comfy.baseUrlLabel')}
            </label>
            <input
              type="url"
              value={imageConfig.custom?.baseUrl || ''}
              onChange={(e) => handleImageModelConfigChange('comfy', 'baseUrl', e.target.value)}
              className="w-full px-4 py-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)] rounded-xl border focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] transition-all duration-200 text-sm font-mono"
            />
            <p className="text-xs text-[var(--color-text-informative-primary)] mt-1">
              {t('settings.image.comfy.baseUrlHelp')}
            </p>
          </div>

          {/* Workflow JSON */}
          <div>
            <label className="flex items-center text-sm font-medium text-[var(--color-text-interface)] mb-2">
              <Code className="w-4 h-4 mr-2" />
              {t('settings.image.comfy.workflowJson')}
              {!isValidWorkflow && (
                <span className="ml-2 text-xs text-[var(--color-textual-button-negative)]">{t('settings.image.comfy.invalidJson')}</span>
              )}
            </label>

            <div
              ref={editorInstance}
              className="prose min-h-full resize-y overflow-auto border border-[var(--color-border-strong)] rounded-lg"
            />

            <p className="text-xs text-[var(--color-text-informative-primary)] mt-1" dangerouslySetInnerHTML={{ __html: t('settings.image.comfy.workflowHelp') }} />
          </div>

          {/* Timeout */}
          <div>
            <label className="flex items-center justify-between text-sm font-medium text-[var(--color-text-interface)] mb-2">
              <span className="flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                {t('settings.image.comfy.timeoutLabel')}
              </span>
              <span className="text-[var(--color-preview-accent-to)] font-semibold">
                {t('settings.image.comfy.timeoutValue', { value: imageConfig.custom?.timeout || 60 })}
              </span>
            </label>
            <input
              type="range"
              min={30}
              max={600}
              step={30}
              value={imageConfig.custom?.timeout || 60}
              onChange={(e) => handleImageModelConfigChange('comfy', 'timeout', parseInt(e.target.value))}
              className="w-full accent-[var(--color-button-primary)]"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-informative-primary)] mt-1">
              <span>{t('settings.image.comfy.timeoutMin')}</span>
              <span>{t('settings.image.comfy.timeoutMax')}</span>
            </div>
            <p className="text-xs text-[var(--color-text-informative-primary)] mt-1">
              {t('settings.image.comfy.timeoutHelp')}
            </p>
          </div>
        </>
      )}

      {/* NovelAI 스타일 인식 토글 - NovelAI가 선택된 경우에만 표시 */}
      {imageProvider === 'novelai' && (
        <div className="flex items-center justify-between p-3 bg-[var(--color-bg-input-secondary)] rounded-lg border border-[var(--color-border)]">
          <div className="flex flex-col">
            <label htmlFor="style-aware-toggle" className="font-medium text-[var(--color-text-primary)] cursor-pointer">
              {t('settings.image.novelai.styleAwareLabel')}
            </label>
            <p className="text-xs text-[var(--color-text-informative-primary)]">{t('settings.image.novelai.styleAwareHelp')}</p>
          </div>
          <label htmlFor="style-aware-toggle" className="relative flex items-center cursor-pointer">
            <input
              type="checkbox"
              id="style-aware-toggle"
              className="sr-only peer"
              checked={settings.imageSettings.styleAware}
              onChange={e => setSettings(prev => ({
                ...prev,
                imageSettings: {
                  ...prev.imageSettings,
                  styleAware: e.target.checked
                }
              }))}
            />
            <div className="w-11 h-6 bg-[var(--color-toggle-off)] rounded-full peer peer-focus:ring-4 peer-focus:ring-[var(--color-focus-border)]/20 peer-checked:after:translate-x-full peer-checked:after:border-[var(--color-text-accent)] after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-[var(--color-text-accent)] after:border-[var(--color-border)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-toggle-on)]"></div>
          </label>
        </div>
      )}

      {/* 그림체 설정 (ArtStyleManagerUI 연동) */}
      <div className="space-y-4 my-6">
        <div className="p-4 rounded-xl bg-[var(--color-bg-input-primary)]">
          <ArtStyleList />
        </div>
      </div>
    </div>
  );
}

