import { useState } from 'react';
import { X } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { roomsActions } from '../../entities/room/slice';
import { nanoid } from '@reduxjs/toolkit';

interface CreateOpenChatModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function CreateOpenChatModal({ isOpen, onClose }: CreateOpenChatModalProps) {
    const dispatch = useDispatch();
    const [chatName, setChatName] = useState('');

    if (!isOpen) {
        return null;
    }

    const handleCreate = () => {
        if (chatName.trim()) {
            const newRoom = {
                id: nanoid(),
                name: chatName.trim(),
                memberIds: [], // Open chats don't have fixed members
                type: 'Open' as const,
                lastMessageId: null,
                unreadCount: 0,
                currentParticipants: [],
            };
            dispatch(roomsActions.upsertOne(newRoom));
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
                <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-gray-900">새 오픈톡방</h2>
                        <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">오픈톡방 이름</label>
                        <input
                            type="text"
                            value={chatName}
                            onChange={(e) => setChatName(e.target.value)}
                            placeholder="오픈톡방 이름을 입력하세요"
                            className="w-full p-3 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 focus:outline-none"
                        />
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100">
                        <div className="flex items-start gap-3">
                            {/* <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" /> */}
                            <div className="text-sm">
                                <p className="text-blue-800 font-medium mb-1">오픈톡방이란?</p>
                                <p className="text-blue-700 text-xs leading-relaxed">
                                    캐릭터들이 자유롭게 들어오고 나가는 열린 공간입니다.
                                    대화 내용과 분위기에 따라 캐릭터들이 자연스럽게 참여하거나 떠날 수 있습니다.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button onClick={onClose} className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-medium">
                            취소
                        </button>
                        <button onClick={handleCreate} className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors disabled:bg-gray-300 disabled:text-gray-500 font-medium" disabled={!chatName.trim()}>
                            만들기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CreateOpenChatModal;