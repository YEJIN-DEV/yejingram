import { useSelector, useDispatch } from 'react-redux';
import { useEffect, useState, useRef } from 'react';
import { Image, Upload, Download, Sparkles, MessageSquarePlus, ChevronDown } from 'lucide-react';
import { selectEditingCharacterId, selectCharacterById } from '../../entities/character/selectors';
import { charactersActions } from '../../entities/character/slice';
import type { RootState } from '../../app/store';
import { newCharacterDefault, type Character, type PersonaChatAppCharacterCard, type Sticker } from '../../entities/character/types';
import { AttributeSliders } from './AttributeSliders';
import { MemoryManager } from './MemoryManager';
import { StickerManager } from './StickerManager';
import { decodeText, encodeText } from '../../utils/imageStego';


const personaCardToCharacter = (card: PersonaChatAppCharacterCard): Character => {
    const { name, prompt, responseTime, thinkingTime, reactivity, tone, memories, proactiveEnabled } = card;

    return {
        id: Date.now(),
        name,
        prompt,
        responseTime: parseInt(responseTime, 10),
        thinkingTime: parseInt(thinkingTime, 10),
        reactivity: parseInt(reactivity, 10),
        tone: parseInt(tone, 10),
        memories: Array.isArray(memories) ? memories.map(String) : [], // Ensure memories is an array of strings
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
        memories: character.memories,
        proactiveEnabled: character.proactiveEnabled,
    };
};

function CharacterPanel() {
    const dispatch = useDispatch();
    const editingId = useSelector(selectEditingCharacterId);
    const editingCharacter = useSelector((state: RootState) => editingId ? selectCharacterById(state, editingId) : null);
    const proactiveChatEnabled = useSelector((state: RootState) => state.settings.proactiveChatEnabled)

    const [char, setChar] = useState<Character>(newCharacterDefault);
    const [activeTab, setActiveTab] = useState<'basicInfo' | 'backup'>('basicInfo');
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
            const characterToSave = { ...newCharacterDefault, ...char, id: editingId || Date.now() };
            dispatch(charactersActions.upsertOne(characterToSave as Character));
            dispatch(charactersActions.resetEditingCharacterId());
        }
    };

    const handleInputChange = (field: keyof Character, value: any) => {
        setChar(prev => ({ ...prev, [field]: value }));
    };

    const handleMemoryChange = (index: number, value: string) => {
        const newMemories = [...(char.memories || [])];
        newMemories[index] = value;
        setChar(prev => ({ ...prev, memories: newMemories }));
    };

    const addMemory = () => {
        const newMemories = [...(char.memories || []), ''];
        setChar(prev => ({ ...prev, memories: newMemories }));
    };

    const deleteMemory = (index: number) => {
        const newMemories = [...(char.memories || [])];
        newMemories.splice(index, 1);
        setChar(prev => ({ ...prev, memories: newMemories }));
    };

    const handleStickersChange = (stickers: Sticker[]) => {
        setChar(prev => ({ ...prev, stickers }));
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
        input.accept = "image/png";

        input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const file = target.files?.[0];
            if (!file) return;

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
        <div className="bg-gray-800 w-96 h-full flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-700 shrink-0">
                <h3 className="text-xl font-semibold text-white">{isNew ? '연락처 추가' : '연락처 수정'}</h3>
            </div>
            <div className="flex border-b border-gray-700">
                <button
                    className={`py-3 px-6 text-sm font-medium ${activeTab === 'basicInfo' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => setActiveTab('basicInfo')}
                >
                    기본정보
                </button>
                <button
                    className={`py-3 px-6 text-sm font-medium ${activeTab === 'backup' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:text-white'}`}
                    onClick={() => setActiveTab('backup')}
                >
                    백업
                </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
                {activeTab === 'basicInfo' && (
                    <>
                        <div className="flex items-center space-x-4">
                            <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                                {char.avatar ? <img src={char.avatar} alt="Avatar Preview" className="w-full h-full object-cover" /> : <Image className="w-8 h-8 text-gray-400" />}
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => avatarInputRef.current?.click()} className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                    <Image className="w-4 h-4" /> 프로필 이미지
                                </button>
                                <button onClick={importPersonaImage} className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                    <Upload className="w-4 h-4" /> 연락처 불러오기
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-gray-300 mb-2 block">이름</label>
                            <input id="character-name" type="text" placeholder="이름을 입력하세요" value={char.name} onChange={e => handleInputChange('name', e.target.value)} className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border-0 focus:ring-2 focus:ring-blue-500/50 text-sm" />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-gray-300">인물 정보</label>
                                <button id="ai-generate-character-btn" className="py-1 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> AI 생성
                                </button>
                            </div>
                            <textarea id="character-prompt" placeholder="특징, 배경, 관계, 기억 등을 자유롭게 서술해주세요." value={char.prompt} onChange={e => handleInputChange('prompt', e.target.value)} className="w-full px-4 py-3 bg-gray-700 text-white rounded-xl border-0 focus:ring-2 focus:ring-blue-500/50 text-sm" rows={6}></textarea>
                        </div>
                        {proactiveChatEnabled && (
                            <div className="border-t border-gray-700 pt-4">
                                <label className="flex items-center justify-between text-sm font-medium text-gray-300 cursor-pointer">
                                    <span className="flex items-center"><MessageSquarePlus className="w-4 h-4 mr-2" />개별 선톡 허용</span>
                                    <div className="relative inline-block w-10 align-middle select-none">
                                        <input type="checkbox" id="character-proactive-toggle" checked={char.proactiveEnabled} onChange={e => handleInputChange('proactiveEnabled', e.target.checked)} className="absolute opacity-0 w-0 h-0 peer" />
                                        <label htmlFor="character-proactive-toggle" className="block overflow-hidden h-6 rounded-full bg-gray-600 cursor-pointer peer-checked:bg-blue-600"></label>
                                        <span className="absolute left-0.5 top-0.5 block w-5 h-5 rounded-full bg-white transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                                    </div>
                                </label>
                            </div>
                        )}

                        <details className="group border-t border-gray-700 pt-4">
                            <summary className="flex items-center justify-between cursor-pointer list-none">
                                <span className="text-base font-medium text-gray-200">추가 설정</span>
                                <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
                            </summary>
                            <div className="content-wrapper">
                                <div className="content-inner pt-6 space-y-6">
                                    <details className="group border-t border-gray-700 pt-2">
                                        <summary className="flex items-center justify-between cursor-pointer list-none py-2">
                                            <h4 className="text-sm font-medium text-gray-300">스티커</h4>
                                            <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
                                        </summary>
                                        <StickerManager stickers={char.stickers || []} onStickersChange={handleStickersChange} />
                                    </details>
                                    <details className="group border-t border-gray-700 pt-2">
                                        <summary className="flex items-center justify-between cursor-pointer list-none py-2">
                                            <h4 className="text-sm font-medium text-gray-300">메모리</h4>
                                            <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
                                        </summary>
                                        <MemoryManager memories={char.memories || []} handleMemoryChange={handleMemoryChange} addMemory={addMemory} deleteMemory={deleteMemory} />
                                    </details>
                                    <details className="group border-t border-gray-700 pt-2">
                                        <summary className="flex items-center justify-between cursor-pointer list-none py-2">
                                            <h4 className="text-sm font-medium text-gray-300">메시지 응답성</h4>
                                            <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" />
                                        </summary>
                                        <AttributeSliders char={char} handleInputChange={handleInputChange} />
                                    </details>
                                </div>
                            </div>
                        </details>
                    </>
                )}
                {activeTab === 'backup' && (
                    <div className="p-6 space-y-6 overflow-y-auto">
                        <h4 className="text-lg font-semibold text-white">백업 설정</h4>
                        <div className="flex flex-col gap-2">
                            <button onClick={() => exportPersonaImage("alpha-channel")} className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                <Download className="w-4 h-4" /> 연락처 공유하기 (아리스톡)
                            </button>
                            <button onClick={() => exportPersonaImage("png-trailer")} className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                <Download className="w-4 h-4" /> 연락처 공유하기 (예진그램)
                            </button>
                        </div>
                        <input type="file" accept="image/png,image/jpeg" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" />
                    </div>
                )}
            </div>
            <div className="p-6 mt-auto border-t border-gray-700 shrink-0 flex justify-end space-x-3">
                <button onClick={() => dispatch(charactersActions.resetEditingCharacterId())} className="flex-1 py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">취소</button>
                <button onClick={handleSave} className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">저장</button>
            </div>
        </div>
    );
}

export default CharacterPanel;
