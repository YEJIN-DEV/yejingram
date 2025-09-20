import React, { useEffect, useState } from 'react';
import { Palette, BrainCircuit, X, Plus, Trash2, Edit3, AlertTriangle, Code, Minus } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { selectArtStyles, selectSelectedArtStyleId } from '../../../entities/setting/image/selectors';
import { settingsActions } from '../../../entities/setting/slice';
import type { ArtStyle } from '../../../entities/setting/image/types';

interface ArtStyleModalProps {
    isOpen: boolean;
    editingArtStyle: ArtStyle | null;
    onClose: () => void;
    onSave: (artStyle: Omit<ArtStyle, 'id'>) => void;
}


export function ArtStyleModal({
    isOpen,
    editingArtStyle,
    onClose,
    onSave,
}: ArtStyleModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        prompt: '',
        negativePrompt: ''
    });

    useEffect(() => {
        setFormData({
            name: editingArtStyle?.name || '',
            description: editingArtStyle?.description || '',
            prompt: editingArtStyle?.positivePrompt || '',
            negativePrompt: editingArtStyle?.negativePrompt || ''
        });
    }, [editingArtStyle]);

    const handleInputChange = (field: keyof typeof formData) => (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        setFormData(prev => ({
            ...prev,
            [field]: e.target.value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) return;
        onSave({
            name: formData.name.trim(),
            description: formData.description.trim(),
            positivePrompt: formData.prompt.trim(),
            negativePrompt: formData.negativePrompt.trim(),
        });
        setFormData({
            name: '',
            description: '',
            prompt: '',
            negativePrompt: ''
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-[var(--color-bg-shadow)]/50">
            <div className="bg-[var(--color-bg-main)] border-[var(--color-border)] rounded-lg p-6 w-full max-w-md mx-4 shadow-xl border">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                        {editingArtStyle?.id ? '그림체 수정' : '새 그림체 추가'}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-[var(--color-bg-hover)] rounded-full">
                        <X className="w-5 h-5 text-[var(--color-icon-tertiary)]" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="flex items-center text-sm font-medium mb-2 text-[var(--color-text-interface)]">
                            <Palette className="w-4 h-4 mr-2" />
                            이름
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={handleInputChange('name')}
                            placeholder="그림체 이름을 입력하세요"
                            className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] transition-all duration-200 text-sm bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]"
                            required
                        />
                    </div>

                    <div>
                        <label className="flex items-center text-sm font-medium mb-2 text-[var(--color-text-interface)]">
                            <BrainCircuit className="w-4 h-4 mr-2" />
                            설명
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={handleInputChange('description')}
                            placeholder="이 그림체는 어떤 특징을 가지고 있는지 설명해주세요"
                            rows={3}
                            className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] transition-all duration-200 text-sm bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]"
                        />
                    </div>

                    <div>
                        <label className="flex items-center text-sm font-medium mb-2 text-[var(--color-text-interface)]">
                            <Code className="w-4 h-4 mr-2" />
                            프롬프트 태그
                        </label>
                        <textarea
                            value={formData.prompt}
                            onChange={handleInputChange('prompt')}
                            placeholder="예: anime style, soft shading, pastel colors"
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] transition-all duration-200 text-sm font-mono bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]"
                            required
                        />
                        <p className="text-xs mt-1 text-[var(--color-text-informative-primary)]">
                            콤마로 구분된 영어 태그를 입력하세요. 이 태그들이 이미지 생성 시 프롬프트에 추가됩니다.
                        </p>
                    </div>

                    <div>
                        <label className="flex items-center text-sm font-medium mb-2 text-[var(--color-text-interface)]">
                            <Minus className="w-4 h-4 mr-2" />
                            네거티브 프롬프트 태그
                        </label>
                        <textarea
                            value={formData.negativePrompt}
                            onChange={handleInputChange('negativePrompt')}
                            placeholder="예: blurry, low quality, deformed"
                            rows={4}
                            className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] transition-all duration-200 text-sm font-mono bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)]"
                        />
                        <p className="text-xs mt-1 text-[var(--color-text-informative-primary)]">
                            콤마로 구분된 영어 태그를 입력하세요. 이 태그들이 이미지 생성 시 네거티브 프롬프트에 추가됩니다.
                        </p>
                    </div>

                    <div className="flex gap-2 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 rounded-lg transition-colors bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] text-[var(--color-text-interface)] border border-[var(--color-border)]"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-2.5 px-4 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg transition-colors"
                        >
                            {editingArtStyle?.id ? '수정' : '추가'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function ArtStyleList() {
    const dispatch = useDispatch();
    const artStyles = useSelector(selectArtStyles);
    const selectedId = useSelector(selectSelectedArtStyleId);
    const selected = useSelector(selectSelectedArtStyleId);

    const [editingArtStyle, setEditingArtStyle] = useState<ArtStyle | null>(null);
    const [showModal, setShowModal] = useState(false);

    const openAdd = () => {
        setEditingArtStyle({ id: '', name: '', description: '', positivePrompt: '', negativePrompt: '' });
        setShowModal(true);
    };
    const openEdit = (style: ArtStyle) => {
        setEditingArtStyle(style);
        setShowModal(true);
    };
    const closeModal = () => {
        setShowModal(false);
        setEditingArtStyle(null);
    };

    const saveArtStyle = (data: Omit<ArtStyle, 'id'>) => {
        if (editingArtStyle?.id) {
            // 수정
            dispatch(settingsActions.updateArtStyleInImageSettings({ id: editingArtStyle.id, ...data }));
        } else {
            // 추가
            dispatch(settingsActions.addArtStyleToImageSettings(data));
        }
        closeModal();
    };

    const deleteArtStyle = (id: string) => {
        if (!confirm('이 그림체를 삭제하시겠습니까?')) return;
        dispatch(settingsActions.deleteArtStyleFromImageSettings(id));
    };

    const selectArtStyle = (id: string) => dispatch(settingsActions.selectArtStyleInImageSettings(id));

    return (
        <>
            <ArtStyleModal
                isOpen={showModal}
                editingArtStyle={editingArtStyle}
                onClose={closeModal}
                onSave={saveArtStyle}
            />

            <div className="space-y-4">
                {!selected && (
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-alert-border)] bg-[var(--color-alert-bg)] text-[var(--color-alert-text)]">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="text-sm leading-5">
                            선택된 그림체가 없습니다. 하나를 선택하거나 새로 추가해주세요.
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-[var(--color-text-interface)]">그림체 관리</h4>
                    <button
                        onClick={openAdd}
                        className="px-3 py-1.5 bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] text-[var(--color-text-accent)] rounded-lg text-xs flex items-center gap-1 transition-colors"
                    >
                        <Plus className="w-3 h-3" /> 추가
                    </button>
                </div>

                <div className="space-y-2">
                    {artStyles.length > 0 ? (
                        artStyles.map((artStyle) => (
                            <div
                                key={artStyle.id}
                                className={`p-3 rounded-lg border transition-colors cursor-pointer max-h-32 overflow-hidden ${selectedId === artStyle.id
                                    ? 'border-[var(--color-preview-accent-to)] bg-[var(--color-preview-to)]'
                                    : 'border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]'
                                    }`}
                                onClick={() => selectArtStyle(artStyle.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <h5 className="font-medium text-sm text-[var(--color-text-primary)]">
                                                {artStyle.name || '이름 없음'}
                                            </h5>
                                            {selectedId === artStyle.id && (
                                                <span className="px-2 py-0.5 bg-[var(--color-preview-accent-to)]/20 text-[var(--color-preview-accent-to)] text-xs rounded-full">
                                                    선택됨
                                                </span>
                                            )}
                                        </div>
                                        {artStyle.description && (
                                            <p className="text-xs mt-1 line-clamp-2 text-[var(--color-text-informative-primary)]">
                                                {artStyle.description}
                                            </p>
                                        )}
                                        {artStyle.positivePrompt && (
                                            <p className="text-xs mt-1 line-clamp-1 text-[var(--color-text-informative-secondary)]">
                                                {artStyle.positivePrompt}
                                            </p>
                                        )}
                                        {artStyle.negativePrompt && (
                                            <p className="text-xs mt-1 line-clamp-1 text-[var(--color-textual-button-negative)]">
                                                Neg: {artStyle.negativePrompt}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEdit(artStyle);
                                            }}
                                            className="p-1 rounded transition-colors hover:bg-[var(--color-bg-hover)]"
                                        >
                                            <Edit3 className="w-3 h-3 text-[var(--color-icon-tertiary)]" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteArtStyle(artStyle.id);
                                            }}
                                            className="p-1 rounded transition-colors hover:bg-[var(--color-textual-button-negative)]/10"
                                        >
                                            <Trash2 className="w-3 h-3 text-[var(--color-textual-button-negative)]" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-[var(--color-text-informative-primary)] text-center py-8">
                            <Palette className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">등록된 그림체가 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
