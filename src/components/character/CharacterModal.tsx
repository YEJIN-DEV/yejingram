import { useSelector, useDispatch } from 'react-redux';
import { useEffect, useState, useRef } from 'react';
import { X, Image, Upload, Download, Sparkles, MessageSquarePlus, ChevronDown } from 'lucide-react';
import { selectIsCharacterModalOpen, selectEditingCharacterId, selectCharacterById } from '../../entities/character/selectors';
import { charactersActions } from '../../entities/character/slice';
import { RootState } from '../../app/store';
import type { Character } from '../../entities/character/types';
import { AttributeSliders } from './AttributeSliders';
import { MemoryManager } from './MemoryManager';
import { StickerManager } from './StickerManager';

const newCharacterDefault: Omit<Character, 'id'> = {
    name: '',
    prompt: '',
    avatar: null,
    responseTime: '5',
    thinkingTime: '5',
    reactivity: '5',
    tone: '5',
    memories: [],
    proactiveEnabled: true,
    messageCountSinceLastSummary: 0,
    media: [],
    stickers: [],
};

function CharacterModal() {
    const dispatch = useDispatch();
    const isOpen = useSelector(selectIsCharacterModalOpen);
    const editingId = useSelector(selectEditingCharacterId);
    const editingCharacter = useSelector((state: RootState) => editingId ? selectCharacterById(state, editingId) : null);
    const proactiveChatEnabled = useSelector((state: RootState) => state.settings.proactiveChatEnabled);

    const [char, setChar] = useState<Partial<Character>>(newCharacterDefault);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    const isNew = !editingId;

    useEffect(() => {
        if (isOpen) {
            if (editingCharacter) {
                setChar(editingCharacter);
            } else {
                setChar(newCharacterDefault);
            }
        } else {
            setChar(newCharacterDefault);
        }
    }, [editingCharacter, isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleClose = () => {
        dispatch(charactersActions.closeCharacterModal());
    };

    const handleSave = () => {
        if (char.name) {
            const characterToSave = { ...newCharacterDefault, ...char, id: editingId || Date.now() };
            dispatch(charactersActions.upsertOne(characterToSave as Character));
            handleClose();
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

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setChar(prev => ({ ...prev, avatar: event.target?.result as string }));
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl w-full max-w-md mx-auto my-auto flex flex-col" style={{ maxHeight: '90vh' }}>
                <div className="flex items-center justify-between p-6 border-b border-gray-700 shrink-0">
                    <h3 className="text-xl font-semibold text-white">{isNew ? '연락처 추가' : '연락처 수정'}</h3>
                    <button onClick={handleClose} className="p-1 hover:bg-gray-700 rounded-full"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto">
                    <div className="flex items-center space-x-4">
                        <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                            {char.avatar ? <img src={char.avatar} alt="Avatar Preview" className="w-full h-full object-cover" /> : <Image className="w-8 h-8 text-gray-400" />}
                        </div>
                        <div className="flex flex-col gap-2">
                            <button onClick={() => avatarInputRef.current?.click()} className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                <Image className="w-4 h-4" /> 프로필 이미지
                            </button>
                            <button className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                <Upload className="w-4 h-4" /> 연락처 불러오기
                            </button>
                            <button className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                <Download className="w-4 h-4" /> 연락처 공유하기
                            </button>
                        </div>
                        <input type="file" accept="image/png,image/jpeg" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" />
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
                                    <StickerManager stickers={char.stickers || []} />
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
                </div>
                <div className="p-6 mt-auto border-t border-gray-700 shrink-0 flex justify-end space-x-3">
                    <button onClick={handleClose} className="flex-1 py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">취소</button>
                    <button onClick={handleSave} className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">저장</button>
                </div>
            </div>
        </div>
    );
}

export default CharacterModal;