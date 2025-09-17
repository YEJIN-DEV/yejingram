import { useRef, useState, useEffect, type JSX } from 'react';
import { Globe, Code, Clock, Sparkles } from 'lucide-react';
import ArtStyleList from './ArtStyleManagerUI';
import jsonEditor from 'jsoneditor';
import 'jsoneditor/dist/jsoneditor.css';


type CheckResult = {
  positive: boolean;
  negative: boolean;
};

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

export function ComfySettings(): JSX.Element {
  const [baseUrl, setBaseUrl] = useState('');
  const [timeout, setTimeoutVal] = useState(60);
  const [autoImage, setAutoImage] = useState(false);
  const [isValidWorkflow, setIsValidWorkflow] = useState(true);
  const editorInstance = useRef<HTMLDivElement>(null);
  const jsonEditorRef = useRef<jsonEditor>(null);

  useEffect(() => {
    if (editorInstance.current && !jsonEditorRef.current) {
      jsonEditorRef.current = new jsonEditor(editorInstance.current, {
        mode: 'code',
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
      }, { "3": { "inputs": { "seed": 378669112180739, "steps": 28, "cfg": 6, "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0] }, "class_type": "KSampler", "_meta": { "title": "KSampler" } } });

    }

    return () => {
      if (jsonEditorRef.current) {
        jsonEditorRef.current.destroy?.();
        jsonEditorRef.current = null;
      }
    };
  }, []);


  return (
    <div className="space-y-4">
      {/* ComfyUI URL */}
      <div>
        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
          <Globe className="w-4 h-4 mr-2" />
          ComfyUI 요청 URL
        </label>
        <input
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
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
            {timeout}초
          </span>
        </label>
        <input
          type="range"
          min={30}
          max={600}
          step={30}
          value={timeout}
          onChange={(e) => setTimeoutVal(parseInt(e.target.value))}
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

      {/* 자동 이미지 생성 */}
      <div>
        <label className="flex items-center justify-between text-sm font-medium text-gray-700 cursor-pointer">
          <span className="flex items-center">
            <Sparkles className="w-4 h-4 mr-2" />
            봇 자동 이미지 생성
          </span>
          <div className="relative inline-block w-10 align-middle select-none">
            <input
              type="checkbox"
              id="auto-image-generation-toggle"
              checked={autoImage}
              onChange={(e) => setAutoImage(e.target.checked)}
              className="absolute opacity-0 w-0 h-0 peer"
            />
            <label
              htmlFor="auto-image-generation-toggle"
              className="block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer peer-checked:bg-blue-500"
            ></label>
            <span className="absolute left-0.5 top-0.5 block w-5 h-5 rounded-full bg-white transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
          </div>
        </label>
        <p className="text-xs text-gray-500 mt-2">
          활성화하면 봇이 텍스트 메시지를 보낼 때마다 자동으로 해당 내용에 맞는 이미지를 생성합니다.<br />이미지는 백그라운드에서 생성되며 완성되면 메시지에 자동으로 추가됩니다.
        </p>
      </div>

      {/* 그림체 설정 (ArtStyleManagerUI 연동) */}
      <div className="space-y-4 my-6">
        <div className="p-4 rounded-xl bg-gray-100">
          <ArtStyleList />
        </div>
      </div>
    </div>
  );
}

