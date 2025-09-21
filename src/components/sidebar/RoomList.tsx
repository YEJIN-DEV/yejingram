import { Trash2, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useCallback, memo } from 'react';
import type { RootState } from '../../app/store';
import type { Room } from '../../entities/room/types';
import { selectMessagesByRoomId } from '../../entities/message/selectors';
import { roomsActions } from '../../entities/room/slice';
import { messagesActions } from '../../entities/message/slice';
import { getMessageDisplayText } from '../../utils/message';

interface RoomListProps {
    room: Room;
    unreadCount: number;
    setRoomId: (id: string | null) => void;
    isSelected: boolean;
    useDoubleClick?: boolean;
}

function RoomList({
    room,
    unreadCount,
    setRoomId,
    isSelected,
    useDoubleClick = false
}: RoomListProps) {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const lastMessage = useSelector((state: RootState) => {
        const messages = selectMessagesByRoomId(state, room.id);
        return messages[messages.length - 1];
    });
    const formatTime = useCallback((timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return t('units.justNow');
        if (diffMins < 60) return `${diffMins}${t('units.minute')}`;
        if (diffHours < 24) return `${diffHours}${t('units.hour')}`;
        if (diffDays < 7) return `${diffDays}${t('units.days')}`;
        return date.toLocaleDateString();
    }, []);

    const handleRoomSelect = () => {
        dispatch(roomsActions.resetUnread(room.id));
        setRoomId(room.id);
    };

    const duplicateRoom = () => {
        const newRoomId = `${room.id.split('-')[0]}-${Date.now()}`;
        dispatch(roomsActions.duplicateRoom({ originalId: room.id, newId: newRoomId }));
        dispatch(messagesActions.duplicateMessages({ originalId: room.id, newId: newRoomId }));
    };

    return (
        <div
            className={`chat-room-item group relative cursor-pointer transition-transform duration-200 select-none ${isSelected ? 'bg-[var(--color-bg-roomlist)] border-l-4 border-[var(--color-focus-border)]' : 'hover:bg-[var(--color-bg-secondary)]'
                }`}
            data-chat-id={room.id}
        >
            <div
                {...(useDoubleClick ? { onDoubleClick: handleRoomSelect } : { onClick: handleRoomSelect })}
                className="flex items-center justify-between p-3"
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <h4 className={`text-sm font-medium truncate ${isSelected ? 'text-[var(--color-text-roomlist-title)]' : 'text-[var(--color-text-primary)]'}`}>
                            {room.name}
                        </h4>
                        <div className="flex items-center space-x-2 ml-2">
                            {lastMessage?.createdAt && (
                                <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0">
                                    {formatTime(lastMessage.createdAt)}
                                </span>
                            )}
                            {unreadCount > 0 && (
                                <span className="bg-[var(--color-button-primary)] text-[var(--color-text-accent)] text-xs px-1.5 py-0.5 rounded-full font-medium min-w-[18px] text-center">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </div>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] truncate mt-1">
                        {getMessageDisplayText(lastMessage, t)}
                    </p>
                </div>
            </div>

            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-1 z-10">
                <button
                    onClick={duplicateRoom}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 bg-[var(--color-bg-roomactions-positive)] hover:bg-[var(--color-bg-roomactions-positive-hover)] rounded-full text-[var(--color-button-primary-accent)]"
                    title={t('sidebar.rooms.duplicateTitle')}
                >
                    <Copy className="w-3 h-3" />
                </button>

                <button
                    onClick={() => {
                        if (confirm(t('sidebar.rooms.deleteConfirm', { name: room.name }))) {
                            dispatch(roomsActions.removeOne(room.id));
                        }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 bg-[var(--color-bg-roomactions-negative)] hover:bg-[var(--color-bg-roomactions-negative-hover)] rounded-full text-[var(--color-button-negative-accent)]"
                    title={t('sidebar.rooms.deleteTitle')}
                >
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}

export default memo(RoomList);
