import { useState } from 'react';
import { X } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { roomsActions } from '../../entities/room/slice';
import { settingsActions } from '../../entities/setting/slice';
import { selectIsCreateOpenChatModalOpen } from '../../entities/setting/selectors';

function CreateOpenChatModal() {
    const dispatch = useDispatch();
    const isOpen = useSelector(selectIsCreateOpenChatModalOpen);
    const [chatName, setChatName] = useState('');

    if (!isOpen) {
        return null;
    }

    const handleCreate = () => {
        if (chatName.trim()) {
            const newRoom = {
                id: Math.random().toString(36).slice(2),
                name: chatName.trim(),
                memberIds: [], // Open chats don't have fixed members
                type: 'Open' as const,
                lastMessageId: null,
                unreadCount: 0,
                currentParticipants: [],
            };
            dispatch(roomsActions.upsertOne(newRoom));
            dispatch(settingsActions.closeCreateOpenChatModal());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-gray-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-white">새 오픈톡방</h2>
                        <button onClick={() => dispatch(settingsActions.closeCreateOpenChatModal())} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-300 mb-2">오픈톡방 이름</label>
                        <input
                            type="text"
                            value={chatName}
                            onChange={(e) => setChatName(e.target.value)}
                            placeholder="오픈톡방 이름을 입력하세요"
                            className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        />
                    </div>

                    <div className="bg-purple-900/30 p-4 rounded-lg mb-6">
                        <div className="flex items-start gap-3">
                            {/* <Info className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" /> */}
                            <div className="text-sm">
                                <p className="text-purple-200 font-medium mb-1">오픈톡방이란?</p>
                                <p className="text-purple-300 text-xs leading-relaxed">
                                    캐릭터들이 자유롭게 들어오고 나가는 열린 공간입니다.
                                    대화 내용과 분위기에 따라 캐릭터들이 자연스럽게 참여하거나 떠날 수 있습니다.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <button onClick={() => dispatch(settingsActions.closeCreateOpenChatModal())} className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors">
                            취소
                        </button>
                        <button onClick={handleCreate} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors" disabled={!chatName.trim()}>
                            만들기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CreateOpenChatModal;