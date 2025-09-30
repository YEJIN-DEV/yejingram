import { useSelector, useDispatch } from 'react-redux';
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Upload, Download, ChevronDown } from 'lucide-react';
import { selectEditingCharacterId, selectCharacterById } from '../../entities/character/selectors';
import { charactersActions } from '../../entities/character/slice';
import type { RootState } from '../../app/store';
import { newCharacterDefault, type Character, type PersonaChatAppCharacterCard } from '../../entities/character/types';
import { AttributeSliders } from './AttributeSliders';
import { StickerManager } from './StickerManager';
import { decodeText, encodeText } from '../../utils/imageStego';
import { LorebookEditor } from './LorebookEditor';
import { extractBasicCharacterInfo } from '../../utils/risuai/risuCharacterCard';

const personaCardToCharacter = (card: PersonaChatAppCharacterCard, imageUrl: string | null): Character => {
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
        avatar: imageUrl || null,
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
    const { t } = useTranslation();
    const editingId = useSelector(selectEditingCharacterId);
    const editingCharacter = useSelector((state: RootState) => editingId ? selectCharacterById(state, editingId) : null);
    // const proactiveChatEnabled = useSelector((state: RootState) => state.settings.proactiveChatEnabled)

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
                                    const imageUrl = await new Promise<string>((resolve, reject) => {
                                        const reader = new FileReader();
                                        reader.onload = () => resolve(reader.result as string);
                                        reader.onerror = reject;
                                        reader.readAsDataURL(file);
                                    });
                                    characterFromCard = personaCardToCharacter(jsonData, imageUrl);
                                }
                                console.log("불러온 연락처 데이터:", characterFromCard);
                                setChar(characterFromCard);
                            } catch (e) {
                                console.error("Failed to parse character card:", e);
                                alert(t('characterPanel.alerts.invalidCardFormat'));
                            }
                        } else {
                            alert(t('characterPanel.alerts.noContactDataInImage'));
                        }
                    } catch (err) {
                        console.error(err);
                        alert(t('characterPanel.alerts.importFailed'));
                    }
                };
                reader.readAsDataURL(file);
            } else {
                alert(t('characterPanel.alerts.unsupportedFileType'));
            }
        };

        input.click();
    }

    const exportPersonaImage = async (method: "png-trailer" | "alpha-channel") => {
        if (!char.avatar) {
            alert(t('characterPanel.alerts.missingAvatar'));
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
        <div className="fixed inset-y-0 right-0 z-40 w-96 max-w-full bg-[var(--color-bg-main)] border-l border-[var(--color-border)] shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)] shrink-0">
                <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">{isNew ? t('characterPanel.titleAdd') : t('characterPanel.titleEdit')}</h3>
            </div>
            <div className="flex border-b border-[var(--color-border)]">
                <button
                    className={`py-3 px-6 text-sm font-medium transition-colors ${activeTab === 'basicInfo' ? 'text-[var(--color-button-primary-accent)] border-b-2 border-[var(--color-focus-border)]' : 'text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'}`}
                    onClick={() => setActiveTab('basicInfo')}
                >
                    {t('characterPanel.tabs.basicInfo')}
                </button>
                <button
                    className={`py-3 px-6 text-sm font-medium transition-colors ${activeTab === 'lorebook' ? 'text-[var(--color-button-primary-accent)] border-b-2 border-[var(--color-focus-border)]' : 'text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'}`}
                    onClick={() => setActiveTab('lorebook')}
                >
                    {t('characterPanel.tabs.lorebook')}
                </button>
                <button
                    className={`py-3 px-6 text-sm font-medium transition-colors ${activeTab === 'backup' ? 'text-[var(--color-button-primary-accent)] border-b-2 border-[var(--color-focus-border)]' : 'text-[var(--color-icon-tertiary)] hover:text-[var(--color-text-interface)]'}`}
                    onClick={() => setActiveTab('backup')}
                >
                    {t('characterPanel.tabs.backup')}
                </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
                {activeTab === 'basicInfo' && (
                    <>
                        <div className="flex items-center space-x-4">
                            <div className="w-20 h-20 rounded-full bg-[var(--color-bg-input-primary)] flex items-center justify-center overflow-hidden shrink-0 border-2 border-[var(--color-border)]">
                                {char.avatar ? <img src={char.avatar} alt="Avatar Preview" className="w-full h-full object-cover" /> : <Image className="w-8 h-8 text-[var(--color-icon-secondary)]" />}
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => avatarInputRef.current?.click()} className="py-2 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                    <Image className="w-4 h-4" /> {t('characterPanel.profileImage')}
                                </button>
                                <button onClick={importPersonaImage} className="py-2 px-4 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                    <Upload className="w-4 h-4" /> {t('characterPanel.importContact')}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-[var(--color-text-interface)] mb-2 block">{t('characterPanel.nameLabel')}</label>
                            <input id="character-name" type="text" placeholder={t('characterPanel.namePlaceholder')} value={char.name} onChange={e => handleInputChange('name', e.target.value)} className="w-full px-4 py-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] text-sm" />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-[var(--color-text-interface)]">{t('characterPanel.personInfoLabel')}</label>
                            </div>
                            <textarea id="character-prompt" placeholder={t('characterPanel.personInfoPlaceholder')} value={char.prompt} onChange={e => handleInputChange('prompt', e.target.value)} className="w-full px-4 py-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] text-sm" rows={6}></textarea>
                        </div>
                        {/* {proactiveChatEnabled && (

                            <Toggle
                                id="character-proactive-toggle"
                                label={t('characterPanel.allowProactive')}
                                checked={char.proactiveEnabled || false}
                                onChange={checked => handleInputChange('proactiveEnabled', checked)}
                                icon={<MessageSquarePlus className="w-4 h-4" />}
                            />

                        )} */}

                        <details className="group/additional border-t border-[var(--color-border)] pt-4">
                            <summary className="flex items-center justify-between cursor-pointer list-none">
                                <span className="text-base font-medium text-[var(--color-text-primary)]">{t('characterPanel.additionalSettings')}</span>
                                <ChevronDown className="w-5 h-5 text-[var(--color-icon-secondary)] transition-transform duration-300 group-open/additional:rotate-180" />
                            </summary>
                            <div className="content-wrapper">
                                <div className="content-inner pt-6 space-y-6">
                                    <details className="group/sticker border-t border-[var(--color-border)] pt-2">
                                        <summary className="flex items-center justify-between cursor-pointer list-none py-2">
                                            <h4 className="text-sm font-medium text-[var(--color-text-interface)]">{t('characterPanel.stickers')}</h4>
                                            <ChevronDown className="w-5 h-5 text-[var(--color-icon-secondary)] transition-transform duration-300 group-open/sticker:rotate-180" />
                                        </summary>
                                        <StickerManager characterId={char.id} draft={char} onDraftChange={setChar} />
                                    </details>
                                    {/* 메모리는 별도 탭으로 이동 */}
                                    <details className="group/attribute border-t border-[var(--color-border)] pt-2">
                                        <summary className="flex items-center justify-between cursor-pointer list-none py-2">
                                            <h4 className="text-sm font-medium text-[var(--color-text-interface)]">{t('characterPanel.messageReactivity')}</h4>
                                            <ChevronDown className="w-5 h-5 text-[var(--color-icon-secondary)] transition-transform duration-300 group-open/attribute:rotate-180" />
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
                        <h4 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('characterPanel.backupSettings')}</h4>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => exportPersonaImage("alpha-channel")} className="py-3 px-4 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-lg transition-colors text-sm flex items-center justify-center gap-2 border border-[var(--color-border)]">
                                <Download className="w-4 h-4" /> {t('characterPanel.shareArisutalk')}
                            </button>
                            <button onClick={() => exportPersonaImage("png-trailer")} className="py-3 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                                <Download className="w-4 h-4" /> {t('characterPanel.shareYejingram')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <div className="p-6 mt-auto border-t border-[var(--color-border)] shrink-0 flex justify-end space-x-3">
                <button onClick={() => { dispatch(charactersActions.resetEditingCharacterId()); onClose(); }} className="flex-1 py-2.5 px-4 bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] rounded-lg transition-colors">{t('common.cancel')}</button>
                <button onClick={handleSave} className="flex-1 py-2.5 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg transition-colors">{t('characterPanel.save')}</button>
            </div>
            {/* 숨겨진 파일 입력: 어디서든 아바타 업로드 버튼이 동작하도록 전역 배치 */}
            <input type="file" accept="image/png,image/jpeg" ref={avatarInputRef} onChange={handleAvatarChange} className="hidden" />
        </div>
    );
}

export default CharacterPanel;
