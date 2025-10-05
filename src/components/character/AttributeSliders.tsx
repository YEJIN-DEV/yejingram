import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import type { RootState } from '../../app/store';
import { selectCharacterById } from '../../entities/character/selectors';
import type { Character } from '../../entities/character/types';

interface SliderProps {
    id: string;
    description: string;
    left: string;
    right: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function Slider({ id, description, left, right, value, onChange }: SliderProps) {
    return (
        <div>
            <p className="text-sm font-medium text-[var(--color-text-tertiary)] mb-2">{description}</p>
            <input id={id} type="range" min="1" max="10" value={value} onChange={onChange} className="w-full" />
            <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mt-1">
                <span>{left}</span>
                <span>{right}</span>
            </div>
        </div>
    );
}

interface AttributeSlidersProps {
    characterId: number;
    draft?: Character;
    onDraftChange?: (character: Character) => void;
}

export function AttributeSliders({ characterId, draft, onDraftChange }: AttributeSlidersProps) {
    const { t } = useTranslation();
    const storeCharacter = useSelector((state: RootState) => selectCharacterById(state, characterId));
    const source = draft && draft.id === characterId ? draft : storeCharacter;
    if (!source) return null;

    const sliders = [
        { id: 'responseTime', description: t('characterPanel.attributes.responseTime'), left: t('characterPanel.attributes.slower'), right: t('characterPanel.attributes.faster') },
        { id: 'thinkingTime', description: t('characterPanel.attributes.thinkingTime'), left: t('characterPanel.attributes.shorter'), right: t('characterPanel.attributes.longer') },
        { id: 'reactivity', description: t('characterPanel.attributes.reactivity'), left: t('characterPanel.attributes.lower'), right: t('characterPanel.attributes.higher') },
        { id: 'tone', description: t('characterPanel.attributes.tone'), left: t('characterPanel.attributes.calm'), right: t('characterPanel.attributes.active') },
    ];

    return (
        <div className="content-inner pt-4 space-y-4">
            {sliders.map(slider => (
                <Slider
                    key={slider.id}
                    id={`character-${slider.id}`}
                    description={slider.description}
                    left={slider.left}
                    right={slider.right}
                    value={String((source as any)[slider.id] ?? '')}
                    onChange={e => {
                        const num = parseInt(e.target.value, 10);
                        if (draft && onDraftChange) {
                            onDraftChange({ ...draft, [slider.id]: num } as Character);
                        }
                    }}
                />
            ))}
        </div>
    );
}
