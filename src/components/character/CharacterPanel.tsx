import { useSelector, useDispatch } from 'react-redux';
import { useEffect, useState, useRef } from 'react';
import { Image, Upload, Download, MessageSquarePlus, ChevronDown } from 'lucide-react';
import { selectEditingCharacterId, selectCharacterById } from '../../entities/character/selectors';
import { charactersActions } from '../../entities/character/slice';
import type { RootState } from '../../app/store';
import { newCharacterDefault, type Character, type PersonaChatAppCharacterCard } from '../../entities/character/types';
import { AttributeSliders } from './AttributeSliders';
import { StickerManager } from './StickerManager';
import { decodeText, encodeText } from '../../utils/imageStego';
import { LorebookEditor } from './LorebookEditor';
import { extractBasicCharacterInfo } from '../../utils/risuai/risuCharacterCard';

const personaCardToCharacter = (card: PersonaChatAppCharacterCard): Character => {
    const { name, prompt, responseTime, thinkingTime, reactivity, tone, proactiveEnabled } = card;

    return {
        id: Date.now(),
        name,
        prompt,
        responseTime: parseInt(responseTime, 10),
        thinkingTime: parseInt(thinkingTime, 10),
        reactivity: parseInt(reactivity, 10),
        tone: parseInt(tone, 10),
        proactiveEnabled,
        // Fields not in PersonaChatAppCharacterCard are set to default values
        avatar: null,
        messageCountSinceLastSummary: 0,
        media: [],
        stickers: [],
    };
};

const characterToPersonaCard = (character: Character): PersonaChatAppCharacterCard => {
    return {
        name: character.name,
        prompt: character.prompt,
        responseTime: String(character.responseTime),
        thinkingTime: String(character.thinkingTime),
        reactivity: String(character.reactivity),
        tone: String(character.tone),
        source: "PersonaChatAppCharacterCard",
        proactiveEnabled: character.proactiveEnabled,
    };
};

interface CharacterPanelProps {
    onClose: () => void;
}

function CharacterPanel({ onClose }: CharacterPanelProps) {
    const dispatch = useDispatch();
    const editingId = useSelector(selectEditingCharacterId);
    const editingCharacter = useSelector((state: RootState) => editingId ? selectCharacterById(state, editingId) : null);
    const proactiveChatEnabled = useSelector((state: RootState) => state.settings.proactiveChatEnabled)

    const [char, setChar] = useState<Character>(newCharacterDefault);
    const [activeTab, setActiveTab] = useState<'basicInfo' | 'lorebook' | 'backup'>('basicInfo');
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const isNew = !editingId;

    useEffect(() => {
        if (editingCharacter) {
            setChar(editingCharacter);
        } else {
            setChar(newCharacterDefault);
        }
    }, [editingCharacter]);

    const handleSave = () => {
        if (char.name) {
            const charToSave = {
                ...char,
                id: editingId ?? Date.now()
            }
            dispatch(charactersActions.upsertOne(charToSave));
            dispatch(charactersActions.resetEditingCharacterId());
            onClose();
        }
    };

    const handleInputChange = (field: keyof Character, value: any) => {
        setChar(prev => ({ ...prev, [field]: value }));
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setChar(prev => ({ ...prev, avatar: event.target?.result as string }));
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    const importPersonaImage = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,.json,.charx";

        input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;

            // 1) 우선 extractBasicCharacterInfo로 시도 (PNG/JSON/CHARX/JPEG 지원)
            try {
                const info = await extractBasicCharacterInfo({ name: file.name, data: file });
                if (info) {
                    const promptParts: string[] = [];
                    if (info.description) promptParts.push(info.description);
                    if (info.personality) promptParts.push(`personality: ${info.personality}`);
                    if (info.scenario) promptParts.push(`scenario: ${info.scenario}`);

                    const characterFromCard: Character = {
                        ...newCharacterDefault,
                        id: Date.now(),
                        name: info.name || '',
                        prompt: promptParts.join('\n\n'),
                        avatar: info.avatarDataUrl ?? null,
                        lorebook: info.lorebook ?? [],
                    } as Character;
                    setChar(characterFromCard);
                    return;
                }
            } catch (err) {
                // 무시하고 기존 PNG 스테가노 경로로 폴백
                console.warn('extractBasicCharacterInfo 실패, decodeText로 폴백:', err);
            }

            // 2) 폴백: 기존 PNG 스테가노 방식 (PersonaChatAppCharacterCard/예진그램 png-trailer)
            if (file.type === 'image/png' || /\.png$/i.test(file.name)) {
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    const src = String(ev.target?.result || "");
                    try {
                        const decodeResult = await decodeText(src);
                        if (decodeResult.text) {
                            try {
                                let characterFromCard: Character;
                                if (decodeResult.method === "png-trailer") {
                                    characterFromCard = JSON.parse(decodeResult.text) as Character;
                                } else {
                                    const jsonData = JSON.parse(decodeResult.text) as PersonaChatAppCharacterCard;
                                    if (jsonData.source !== 'PersonaChatAppCharacterCard') {
                                        throw new Error("Invalid character card format.");
                                    }
                                    characterFromCard = personaCardToCharacter(jsonData);
                                }
                                console.log("불러온 연락처 데이터:", characterFromCard);
                                setChar(characterFromCard);
                            } catch (e) {
                                console.error("Failed to parse character card:", e);
                                alert("유효하지 않은 연락처 카드 형식입니다.");
                            }
                        } else {
                            alert("이 이미지에는 연락처 데이터가 없습니다.");
                        }
                    } catch (err) {
                        console.error(err);
                        alert("연락처 불러오기 실패");
                    }
                };
                reader.readAsDataURL(file);
            } else {
                alert('지원하지 않는 파일 형식입니다. PNG/JPEG/JSON/CHARX를 사용하세요.');
            }
        };

        input.click();
    }

    const exportPersonaImage = async (method: "png-trailer" | "alpha-channel") => {
        if (!char.avatar) {
            alert("아바타 이미지가 없습니다. 이미지를 먼저 추가해주세요.");
            return;
        }

        const dataURL = await encodeText(char.avatar, JSON.stringify(method === "png-trailer" ? char : characterToPersonaCard(char)), method);
        const link = document.createElement("a");
        link.href = dataURL;
        link.download = `${char.name || 'character'}_persona.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed right-0 top-0 bottom-0 z-40 w-96 max-w-full bg-white border-l border-gray-200 shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 shrink-0">
                <h3 className="text-xl font-semibold text-gray-900">{isNew ? '연락처 추가' : '연락처 수정'}</h3>
            </div>
            <div className="flex border-b border-gray-200">
                <button
                    className={`py-3 px-6 text-sm font-medium transition-colors ${activeTab === 'basicInfo' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('basicInfo')}
                >
                    기본정보
                </button>
                <button
                    className={`py-3 px-6 text-sm font-medium transition-colors ${activeTab === 'lorebook' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('lorebook')}
                >
                    로어북
                </button>
                <button
                    className={`py-3 px-6 text-sm font-medium transition-colors ${activeTab === 'backup' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setActiveTab('backup')}
                >
                    백업
                </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
                {activeTab === 'basicInfo' && (
                    <>
                        <div className="flex items-center space-x-4">
                            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden shrink-0 border-2 border-gray-200">
                                {char.avatar ? <img src={char.avatar} alt="Avatar Preview" className="w-full h-full object-cover" /> : <Image className="w-8 h-8 text-gray-400" />}
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => avatarInputRef.current?.click()} className="py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                    <Image className="w-4 h-4" /> 프로필 이미지
                                </button>
                                <button onClick={importPersonaImage} className="py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                    <Upload className="w-4 h-4" /> 연락처 불러오기
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">이름</label>
                            <input id="character-name" type="text" placeholder="이름을 입력하세요" value={char.name} onChange={e => handleInputChange('name', e.target.value)} className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm" />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-700">인물 정보</label>
                            </div>
                            <textarea id="character-prompt" placeholder="특징, 배경, 관계, 기억 등을 자유롭게 서술해주세요." value={char.prompt} onChange={e => handleInputChange('prompt', e.target.value)} className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm" rows={6}></textarea>
                        </div>
                        {proactiveChatEnabled && (
                            <div className="border-t border-gray-200 pt-4">
                                <label className="flex items-center justify-between text-sm font-medium text-gray-700 cursor-pointer">
                                    <span className="flex items-center"><MessageSquarePlus className="w-4 h-4 mr-2" />개별 선톡 허용</span>
                                    <div className="relative inline-block w-10 align-middle select-none">
                                        <input type="checkbox" id="character-proactive-toggle" checked={char.proactiveEnabled} onChange={e => handleInputChange('proactiveEnabled', e.target.checked)} className="absolute opacity-0 w-0 h-0 peer" />
                                        <label htmlFor="character-proactive-toggle" className="block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer peer-checked:bg-blue-500"></label>
                                        <span className="absolute left-0.5 top-0.5 block w-5 h-5 rounded-full bg-white transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                                    </div>
                                </label>
                            </div>
                        )}

                        <details className="group/additional border-t border-gray-200 pt-4">
                            <summary className="flex items-center justify-between cursor-pointer list-none">
                                <span className="text-base font-medium text-gray-900">추가 설정</span>
                                <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open/additional:rotate-180" />
                            </summary>
                            <div className="content-wrapper">
                                <div className="content-inner pt-6 space-y-6">
                                    <details className="group/sticker border-t border-gray-200 pt-2">
                                        <summary className="flex items-center justify-between cursor-pointer list-none py-2">
                                            <h4 className="text-sm font-medium text-gray-700">스티커</h4>
                                            <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open/sticker:rotate-180" />
                                        </summary>
                                        <StickerManager characterId={char.id} draft={char} onDraftChange={setChar} />
                                    </details>
                                    {/* 메모리는 별도 탭으로 이동 */}
                                    <details className="group/attribute border-t border-gray-200 pt-2">
                                        <summary className="flex items-center justify-between cursor-pointer list-none py-2">
                                            <h4 className="text-sm font-medium text-gray-700">메시지 응답성</h4>
                                            <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open/attribute:rotate-180" />
                                        </summary>
                                        <AttributeSliders characterId={char.id} draft={char} onDraftChange={setChar} />
                                    </details>
                                </div>
                            </div>
                        </details>
                    </>
                )}
                {activeTab === 'lorebook' && (
                    <div className="space-y-6">
                        <LorebookEditor characterId={char.id} draft={char} onDraftChange={setChar} />
                    </div>
                )}
                {activeTab === 'backup' && (
                    <div className="space-y-6">
                        <h4 className="text-lg font-semibold text-gray-900">백업 설정</h4>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => exportPersonaImage("alpha-channel")} className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 border border-gray-200">
                                <Download className="w-4 h-4" /> 연락처 공유하기 (아리스톡)
                            </button>
                            <button onClick={() => exportPersonaImage("png-trailer")} className="py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                <Download className="w-4 h-4" /> 연락처 공유하기 (예진그램)
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <div className="p-6 mt-auto border-t border-gray-200 shrink-0 flex justify-end space-x-3">
                <button onClick={() => { dispatch(charactersActions.resetEditingCharacterId()); onClose(); }} className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">취소</button>
                <button onClick={handleSave} className="flex-1 py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors">저장</button>
            </div>
            {/* 숨겨진 파일 입력: 어디서든 아바타 업로드 버튼이 동작하도록 전역 배치 */}
            <input type="file" accept="image/png,image/jpeg" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" />
        </div>
    );
}

export default CharacterPanel;
