import { useState } from 'react';
import { Settings, Bot, Plus } from 'lucide-react';
import { selectAllCharacters } from '../../entities/character/selectors';
import { useDispatch, useSelector } from 'react-redux';
import CharacterList from './CharacterList';
import { openSettingsModal } from '../../entities/setting/slice';
import { charactersActions } from '../../entities/character/slice';

interface SidebarProps {
    setRoomId: (id: string | null) => void;
}

function Sidebar({ setRoomId }: SidebarProps) {
    const dispatch = useDispatch();
    const characters = useSelector(selectAllCharacters);
    const [searchQuery, setSearchQuery] = useState('');

    // TODO: messages/unreadCounts가 Redux에 있다면 selector로 가져오세요.
    // 여기선 예시로 빈 값
    const messagesByRoomId: Record<string, any[]> = {};
    const unreadCounts: Record<string, number> = {};

    const filteredCharacters = characters.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <>
            <header className="p-4 md:p-6 border-b border-gray-800">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-white mb-1">예진그램</h1>
                        <p className="text-xs md:text-sm text-gray-400">상대를 초대/대화 하세요</p>
                    </div>
                    <button id="open-settings-modal" onClick={() => dispatch(openSettingsModal())} className="p-2 md:p-2.5 rounded-full bg-gray-800 hover:bg-gray-700 transition-all duration-200">
                        <Settings className="w-5 h-5 text-gray-300" />
                    </button>
                </div>
                <div className="relative">
                    <Bot className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                    <input
                        id="search-input"
                        type="text"
                        placeholder="검색하기..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-2 md:py-3 bg-gray-800 text-white rounded-xl border-0 focus:ring-2 focus:ring-blue-500/30 focus:bg-gray-750 transition-all duration-200 text-sm placeholder-gray-500"
                    />
                </div>
            </header>

            <div className="flex-1 overflow-y-auto">
                <div className="p-4 space-y-2">
                    <button id="open-new-character-modal" onClick={() => dispatch(charactersActions.openCharacterModal(null))} className="w-full flex items-center justify-center py-3 md:py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all duration-200 font-medium shadow-lg text-sm">
                        <Plus className="w-4 h-4 mr-2" />
                        초대하기
                    </button>
                </div>

                <div className="space-y-1 px-3 pb-4">
                    {filteredCharacters.map((char) => (
                        <CharacterList
                            key={char.id}
                            character={char}
                            messagesByRoomId={messagesByRoomId}
                            unreadCounts={unreadCounts}
                            setRoomId={setRoomId}
                        />
                    ))}
                </div>
            </div>
        </>
    );
}

export default Sidebar;
