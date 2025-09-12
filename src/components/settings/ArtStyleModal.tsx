import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Palette, BrainCircuit, X, Plus, Trash2, Edit3, AlertTriangle, Code } from 'lucide-react';
import type { ArtStyle } from '../../entities/setting/types';
import { selectArtStyles, selectSelectedArtStyleId } from '../../entities/setting/selectors';
import { settingsActions } from '../../entities/setting/slice';

interface ArtStyleModalProps {
    isOpen: boolean;
    editingArtStyle: ArtStyle | null;
    onClose: () => void;
    onSave: (artStyle: Omit<ArtStyle, 'id'>) => void;
}

interface ArtStyleManagerProps {
    // Props for the main art style management component
}

// Modal component for adding/editing art styles
function ArtStyleModal({ isOpen, editingArtStyle, onClose, onSave }: ArtStyleModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [prompt, setPrompt] = useState('');

    // Reset form when editingArtStyle changes
    useEffect(() => {
        setName(editingArtStyle?.name || '');
        setDescription(editingArtStyle?.description || '');
        setPrompt(editingArtStyle?.prompt || '');
    }, [editingArtStyle]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        onSave({ 
            name: name.trim(), 
            description: description.trim(),
            prompt: prompt.trim()
        });
        setName('');
        setDescription('');
        setPrompt('');
    };

    const handleClose = () => {
        onClose();
        setName('');
        setDescription('');
        setPrompt('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {editingArtStyle?.id ? '그림체 수정' : '새 그림체 추가'}
                    </h3>
                    <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                            <Palette className="w-4 h-4 mr-2" />
                            이름
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="그림체 이름을 입력하세요"
                            className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm"
                            required
                        />
                    </div>

                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                            <BrainCircuit className="w-4 h-4 mr-2" />
                            설명
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="이 그림체는 어떤 특징을 가지고 있는지 설명해주세요"
                            rows={3}
                            className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm"
                        />
                    </div>

                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                            <Code className="w-4 h-4 mr-2" />
                            프롬프트 태그
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="ComfyUI에 전송될 프롬프트 태그들 (예: anime style, soft shading, pastel colors)"
                            rows={4}
                            className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm font-mono"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            콤마로 구분된 영어 태그를 입력하세요. 이 태그들이 이미지 생성 시 프롬프트에 추가됩니다.
                        </p>
                    </div>

                    <div className="flex gap-2 pt-4">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                        >
                            {editingArtStyle?.id ? '수정' : '추가'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Main art style management component
function ArtStyleManager({ }: ArtStyleManagerProps) {
    const dispatch = useDispatch();
    const artStyles = useSelector(selectArtStyles) || [];
    const selectedArtStyleId = useSelector(selectSelectedArtStyleId);

    const [editingArtStyle, setEditingArtStyle] = useState<ArtStyle | null>(null);
    const [showArtStyleModal, setShowArtStyleModal] = useState(false);

    const handleAddArtStyle = () => {
        setEditingArtStyle({ id: '', name: '', description: '', prompt: '' });
        setShowArtStyleModal(true);
    };

    const handleEditArtStyle = (artStyle: ArtStyle) => {
        setEditingArtStyle(artStyle);
        setShowArtStyleModal(true);
    };

    const handleDeleteArtStyle = (artStyleId: string) => {
        if (confirm('이 그림체를 삭제하시겠습니까?')) {
            dispatch(settingsActions.deleteArtStyle(artStyleId));
        }
    };

    const handleSelectArtStyle = (artStyleId: string) => {
        dispatch(settingsActions.selectArtStyle(artStyleId));
    };

    const handleSaveArtStyle = (artStyle: Omit<ArtStyle, 'id'>) => {
        if (editingArtStyle && editingArtStyle.id) {
            // 수정
            dispatch(settingsActions.updateArtStyle({ ...artStyle, id: editingArtStyle.id }));
        } else {
            // 추가
            dispatch(settingsActions.addArtStyle(artStyle));
        }
        setShowArtStyleModal(false);
        setEditingArtStyle(null);
    };

    const handleCloseArtStyleModal = () => {
        setShowArtStyleModal(false);
        setEditingArtStyle(null);
    };

    return (
        <>
            <ArtStyleModal
                isOpen={showArtStyleModal}
                editingArtStyle={editingArtStyle}
                onClose={handleCloseArtStyleModal}
                onSave={handleSaveArtStyle}
            />
            <div className="space-y-4">
                {selectedArtStyleId == null && (
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="text-sm leading-5">
                            선택된 그림체가 없습니다. 하나를 선택하거나 새로 추가해주세요.
                        </div>
                    </div>
                )}
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-gray-700">그림체 관리</h4>
                    <button
                        onClick={handleAddArtStyle}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs flex items-center gap-1 transition-colors"
                    >
                        <Plus className="w-3 h-3" /> 추가
                    </button>
                </div>

                <div className="space-y-2">
                    {artStyles && artStyles.length > 0 ? artStyles.map((artStyle) => (
                        <div
                            key={artStyle.id}
                            className={`p-3 rounded-lg border transition-colors cursor-pointer ${selectedArtStyleId === artStyle.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:bg-gray-50'
                                }`}
                            onClick={() => handleSelectArtStyle(artStyle.id)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h5 className="font-medium text-sm text-gray-900">
                                            {artStyle.name || '이름 없음'}
                                        </h5>
                                        {selectedArtStyleId === artStyle.id && (
                                            <span className="px-2 py-0.5 bg-blue-200 text-blue-700 text-xs rounded-full">
                                                선택됨
                                            </span>
                                        )}
                                    </div>
                                    {artStyle.description && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                            {artStyle.description}
                                        </p>
                                    )}
                                    {artStyle.prompt && (
                                        <p className="text-xs text-gray-400 mt-1 font-mono line-clamp-1">
                                            {artStyle.prompt}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditArtStyle(artStyle);
                                        }}
                                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                                    >
                                        <Edit3 className="w-3 h-3 text-gray-500" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteArtStyle(artStyle.id);
                                        }}
                                        className="p-1 hover:bg-red-100 rounded transition-colors"
                                    >
                                        <Trash2 className="w-3 h-3 text-red-500" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-8 text-gray-500">
                            <Palette className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">등록된 그림체가 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default ArtStyleManager;
export { ArtStyleModal };