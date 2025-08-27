import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { User, BrainCircuit, X, Plus, Trash2, Edit3, AlertTriangle } from 'lucide-react';
import type { Persona } from '../../entities/setting/types';
import { selectPersonas, selectSelectedPersonaId } from '../../entities/setting/selectors';
import { settingsActions } from '../../entities/setting/slice';

interface PersonaModalProps {
    isOpen: boolean;
    editingPersona: Persona | null;
    onClose: () => void;
    onSave: (persona: Omit<Persona, 'id'>) => void;
}

interface PersonaManagerProps {
    // Props for the main persona management component
}

// Modal component for adding/editing personas
function PersonaModal({ isOpen, editingPersona, onClose, onSave }: PersonaModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    // Reset form when editingPersona changes
    useEffect(() => {
        setName(editingPersona?.name || '');
        setDescription(editingPersona?.description || '');
    }, [editingPersona]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        onSave({ name: name.trim(), description: description.trim() });
        setName('');
        setDescription('');
    };

    const handleClose = () => {
        onClose();
        setName('');
        setDescription('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {editingPersona?.id ? '페르소나 수정' : '새 페르소나 추가'}
                    </h3>
                    <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                            <User className="w-4 h-4 mr-2" />
                            이름
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="페르소나 이름을 입력하세요"
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
                            placeholder="이 페르소나는 어떤 사람인지 설명해주세요"
                            rows={4}
                            className="w-full px-4 py-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all duration-200 text-sm"
                        />
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
                            {editingPersona?.id ? '수정' : '추가'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Main persona management component
function PersonaManager({ }: PersonaManagerProps) {
    const dispatch = useDispatch();
    const personas = useSelector(selectPersonas) || [];
    const selectedPersonaId = useSelector(selectSelectedPersonaId);

    const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
    const [showPersonaModal, setShowPersonaModal] = useState(false);

    const handleAddPersona = () => {
        setEditingPersona({ id: '', name: '', description: '' });
        setShowPersonaModal(true);
    };

    const handleEditPersona = (persona: Persona) => {
        setEditingPersona(persona);
        setShowPersonaModal(true);
    };

    const handleDeletePersona = (personaId: string) => {
        if (confirm('이 페르소나를 삭제하시겠습니까?')) {
            dispatch(settingsActions.deletePersona(personaId));
        }
    };

    const handleSelectPersona = (personaId: string) => {
        dispatch(settingsActions.selectPersona(personaId));
    };

    const handleSavePersona = (persona: Omit<Persona, 'id'>) => {
        if (editingPersona && editingPersona.id) {
            // 수정
            dispatch(settingsActions.updatePersona({ ...persona, id: editingPersona.id }));
        } else {
            // 추가
            dispatch(settingsActions.addPersona(persona));
        }
        setShowPersonaModal(false);
        setEditingPersona(null);
    };

    const handleClosePersonaModal = () => {
        setShowPersonaModal(false);
        setEditingPersona(null);
    };

    return (
        <>
            <PersonaModal
                isOpen={showPersonaModal}
                editingPersona={editingPersona}
                onClose={handleClosePersonaModal}
                onSave={handleSavePersona}
            />
            <div className="space-y-4">
                {selectedPersonaId == null && (
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="text-sm leading-5">
                            선택된 페르소나가 없습니다. 하나를 선택하거나 새로 추가해주세요.
                        </div>
                    </div>
                )}
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-gray-700">페르소나 관리</h4>
                    <button
                        onClick={handleAddPersona}
                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs flex items-center gap-1 transition-colors"
                    >
                        <Plus className="w-3 h-3" /> 추가
                    </button>
                </div>

                <div className="space-y-2">
                    {personas && personas.length > 0 ? personas.map((persona) => (
                        <div
                            key={persona.id}
                            className={`p-3 rounded-lg border transition-colors cursor-pointer ${selectedPersonaId === persona.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:bg-gray-50'
                                }`}
                            onClick={() => handleSelectPersona(persona.id)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h5 className="font-medium text-sm text-gray-900">
                                            {persona.name || '이름 없음'}
                                        </h5>
                                        {selectedPersonaId === persona.id && (
                                            <span className="px-2 py-0.5 bg-blue-200 text-blue-700 text-xs rounded-full">
                                                선택됨
                                            </span>
                                        )}
                                    </div>
                                    {persona.description && (
                                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                            {persona.description}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 ml-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditPersona(persona);
                                        }}
                                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                                    >
                                        <Edit3 className="w-3 h-3 text-gray-500" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeletePersona(persona.id);
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
                            <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">등록된 페르소나가 없습니다.</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

export default PersonaManager;
export { PersonaModal };
