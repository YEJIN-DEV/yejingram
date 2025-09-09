import React from 'react';
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
            <p className="text-sm font-medium text-gray-600 mb-2">{description}</p>
            <input id={id} type="range" min="1" max="10" value={value} onChange={onChange} className="w-full" />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
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
    const storeCharacter = useSelector((state: RootState) => selectCharacterById(state, characterId));
    const source = draft && draft.id === characterId ? draft : storeCharacter;
    if (!source) return null;

    const sliders = [
        { id: 'responseTime', description: '응답 속도', left: '느림', right: '빠름' },
        { id: 'thinkingTime', description: '생각 시간', left: '짧음', right: '김' },
        { id: 'reactivity', description: '반응성', left: '낮음', right: '높음' },
        { id: 'tone', description: '말투', left: '차분함', right: '활발함' },
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
