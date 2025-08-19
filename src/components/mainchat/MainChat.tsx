import type { Room } from '../../entities/room/types';
import { Menu, Bot, Globe, Users, Phone, Video, MoreHorizontal, MessageCircle, Send, Smile, X, Plus, ImageIcon } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { selectCharacterById } from '../../entities/character/selectors';
import { useMemo, useState, useRef } from 'react';
import { type AppDispatch, type RootState } from '../../app/store';
import { selectMessagesByRoomId } from '../../entities/message/selectors';
import MessageList from './Message';
import { messagesActions } from '../../entities/message/slice';
import { Avatar } from '../../utils/Avatar';
import { SendMessage } from '../../services/LLMcaller';
import type { Sticker } from '../../entities/character/types';
import { StickerPanel } from './StickerPanel';

interface MainChatProps {
  room: Room | null;
}

function MainChat({ room }: MainChatProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [typingCharacterId, setTypingCharacterId] = useState<number | null>(null);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [stickerToSend, setStickerToSend] = useState<Sticker | null>(null);

  const dispatch = useDispatch<AppDispatch>();

  const characterId = room?.type === 'Direct' && Array.isArray(room?.memberIds) && room.memberIds.length > 0
    ? room.memberIds[0]
    : null;

  const character = useSelector((state: RootState) =>
    characterId ? selectCharacterById(state, characterId) : null
  );

  const messages = useSelector((state: RootState) => room ? selectMessagesByRoomId(state, room.id) : []);
  const memberChars = useSelector((state: RootState) =>
    room?.memberIds.map(id => selectCharacterById(state, id))
  );

  const handleToggleStickerPanel = () => {
    setShowStickerPanel(prev => !prev);
  };

  const handleSelectSticker = (sticker: Sticker) => {
    setStickerToSend(sticker);
    setShowStickerPanel(false);
  };

  const handleCancelSticker = () => {
    setStickerToSend(null);
  };

  const handleSendMessage = (text: string) => {
    if (!room) return;
    if (!text.trim() && !stickerToSend) return;

    setIsWaitingForResponse(true);

    const messageType = stickerToSend ? 'STICKER' : 'TEXT';

    dispatch(messagesActions.upsertOne({
      id: crypto.randomUUID(),
      roomId: room.id,
      authorId: 0, // Assuming current user ID is '0'
      content: text,
      createdAt: new Date().toISOString(),
      type: messageType,
      sticker: stickerToSend || undefined,
    }));

    setStickerToSend(null);

    if (!memberChars) {
      setIsWaitingForResponse(false);
      return;
    }

    SendMessage(room, setTypingCharacterId).then(() => {
      setIsWaitingForResponse(false);
    });
  };

  if (!(room && character)) {
    return (
      <div className="flex-1 flex items-center justify-center text-center p-4">
        <button
          id="mobile-sidebar-toggle"
          className="absolute top-4 left-4 p-2 rounded-full hover:bg-gray-700 md:hidden"
        >
          <Menu className="h-5 w-5 text-gray-300" />
        </button>
        <div>
          <div className="w-20 h-20 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl md:text-2xl font-semibold text-white mb-3">
            상대를 선택하세요
          </h3>
          <p className="text-sm md:text-base text-gray-400 leading-relaxed">
            사이드 바에서 상대를 선택하여 메시지를 보내세요
            <br />
            혹은 새로운 상대를 초대하세요
          </p>
        </div>
      </div>
    );
  }
  else {
    return (
      <>
        {room.type == "Open" ? (
          <>
            <header className="p-4 bg-gray-900/80 border-b border-gray-800 glass-effect flex items-center justify-between z-10">
              <div className="flex items-center space-x-2 md:space-x-4">
                <button id="mobile-sidebar-toggle" className="p-2 -ml-2 rounded-full hover:bg-gray-700 md:hidden" /* onClick={toggleSidebar} */>
                  <Menu className="h-5 w-5 text-gray-300" />
                </button>
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-white text-base md:text-lg">{room.name}</h2>
                  <p className="text-xs md:text-sm text-gray-400 flex items-center">
                    <Globe className="w-3 h-3 mr-1.5" />
                    {/* TODO: Implement participant count for open chats */}
                    0명 접속중
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-1 md:space-x-2">
                <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700">
                  <Phone className="w-4 h-4 text-gray-300" />
                </button>
                <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700"> {/* onClick={startVideoCall} */}
                  <Video className="w-4 h-4 text-gray-300" />
                </button>
                <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700"> {/* onClick={openChatSettings} */}
                  <MoreHorizontal className="w-4 h-4 text-gray-300" />
                </button>
              </div>
            </header>

            <div id="messages-container" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4" ref={messagesContainerRef}>
              {/* {this.renderMessages()} */}
              <div id="messages-end-ref"></div>
            </div>

            <div className="p-4 bg-gray-900 border-t border-gray-800">
              {/* {this.renderInputArea()} */}
            </div>
          </>
        ) : room.type == "Group" ? (
          <>
            <header className="p-4 bg-gray-900/80 border-b border-gray-800 glass-effect flex items-center justify-between z-10">
              <div className="flex items-center space-x-2 md:space-x-4">
                <button id="mobile-sidebar-toggle" className="p-2 -ml-2 rounded-full hover:bg-gray-700 md:hidden" /* onClick={toggleSidebar} */>
                  <Menu className="h-5 w-5 text-gray-300" />
                </button>
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-white text-base md:text-lg">{room.name}</h2>
                  <p className="text-xs md:text-sm text-gray-400 flex items-center">
                    <Users className="w-3 h-3 mr-1.5" />
                    {/* TODO: Implement participant count for group chats */}
                    {room.memberIds.length}명 참여
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-1 md:space-x-2">
                <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700">
                  <Phone className="w-4 h-4 text-gray-300" />
                </button>
                <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700"> {/* onClick={startVideoCall} */}
                  <Video className="w-4 h-4 text-gray-300" />
                </button>
                <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700"> {/* onClick={openChatSettings} */}
                  <MoreHorizontal className="w-4 h-4 text-gray-300" />
                </button>
              </div>
            </header>

            <div id="messages-container" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4" ref={messagesContainerRef}>
              {/* {this.renderMessages()} */}
              <div id="messages-end-ref"></div>
            </div>

            <div className="p-4 bg-gray-900 border-t border-gray-800">
              {/* {this.renderInputArea()} */}
            </div>
          </>
        ) : room.type == "Direct" && messages ? (
          <>
            <header className="p-4 bg-gray-900/80 border-b border-gray-800 glass-effect flex items-center justify-between z-10">
              <div className="flex items-center space-x-2 md:space-x-4">
                <button id="mobile-sidebar-toggle" className="p-2 -ml-2 rounded-full hover:bg-gray-700 md:hidden" /* onClick={toggleSidebar} */>
                  <Menu className="h-5 w-5 text-gray-300" />
                </button>
                <Avatar char={character} size="sm" />
                <div>
                  <h2 className="font-semibold text-white text-base md:text-lg">{room.name}</h2>
                  <p className="text-xs md:text-sm text-gray-400 flex items-center">
                    <MessageCircle className="w-3 h-3 mr-1.5" />
                    {room.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-1 md:space-x-2">
                <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700">
                  <Phone className="w-4 h-4 text-gray-300" />
                </button>
                <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700">
                  <Video className="w-4 h-4 text-gray-300" />
                </button>
                <button className="p-2 rounded-full bg-gray-800 hover:bg-gray-700"> {/* onClick={openChatSettings} */}
                  <MoreHorizontal className="w-4 h-4 text-gray-300" />
                </button>
              </div>
            </header>

            <div id="messages-container" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4" ref={messagesContainerRef}>
              <MessageList messages={messages} room={room} isWaitingForResponse={isWaitingForResponse} typingCharacterId={typingCharacterId} currentUserId={0} setTypingCharacterId={setTypingCharacterId} setIsWaitingForResponse={setIsWaitingForResponse} scrollRef={messagesContainerRef} />
              <div id="messages-end-ref"></div>
            </div>

            <div className="p-4 bg-gray-900 border-t border-gray-800">
              <InputArea
                room={room}
                isWaitingForResponse={isWaitingForResponse}
                stickerToSend={stickerToSend}
                onToggleUserStickerPanel={handleToggleStickerPanel}
                onStickerClear={handleCancelSticker}
                onSendMessage={handleSendMessage}
                renderUserStickerPanel={() =>
                  showStickerPanel && character && (
                    <StickerPanel
                      characterId={character.id}
                      stickers={character.stickers}
                      onSelectSticker={handleSelectSticker}
                      onClose={handleToggleStickerPanel}
                    />
                  )
                }
              />
            </div>
          </>
        ) : null}
      </>
    );
  }
}

type ImageToSend = {
  dataUrl: string;
};

export interface InputAreaProps {
  room: Room;
  isWaitingForResponse: boolean;
  imageToSend?: ImageToSend | null;
  stickerToSend?: Sticker | null;

  // 이벤트 핸들러들
  onOpenImageUpload?: () => void;
  onCancelImagePreview?: () => void;
  onToggleUserStickerPanel?: () => void;
  onSendMessage: (text: string) => void;
  onStickerClear?: () => void;

  // (선택) 커스텀 스티커 패널 렌더링
  renderUserStickerPanel?: () => React.ReactNode;
}

export function InputArea({
  isWaitingForResponse,
  imageToSend,
  stickerToSend,
  onOpenImageUpload,
  onCancelImagePreview,
  onToggleUserStickerPanel,
  onSendMessage,
  onStickerClear,
  renderUserStickerPanel,
}: InputAreaProps) {
  const [text, setText] = useState("");
  const [showInputOptions, setInputOptions] = useState(false);
  const hasImage = !!imageToSend;

  const placeholder = useMemo(() => {
    if (hasImage) return "캡션 추가...";
    if (stickerToSend) return "스티커와 함께 보낼 메시지 (선택사항)...";
    return "메시지를 입력하세요...";
  }, [hasImage, stickerToSend]);

  const handleSend = () => {
    onSendMessage(text.trim());
    setText("");
  };

  return (
    <div className="input-area-container relative">
      {/* 이미지 프리뷰 */}
      {hasImage && imageToSend?.dataUrl && (
        <div className="p-2 border-b border-gray-700 mb-2">
          <div className="relative w-20 h-20">
            <img
              src={imageToSend.dataUrl}
              className="w-full h-full object-cover rounded-lg"
              alt="미리보기"
            />
            <button
              type="button"
              onClick={onCancelImagePreview}
              className="absolute -top-2 -right-2 p-1 bg-gray-900 rounded-full text-white hover:bg-red-500 transition-colors"
            >
              <X className="w-4 h-4 pointer-events-none" />
            </button>
          </div>
        </div>
      )}

      {/* 인풋 옵션 팝오버 */}
      {showInputOptions && (
        <div className="absolute bottom-full left-0 mb-2 w-48 bg-gray-700 rounded-xl shadow-lg p-2 animate-fadeIn">
          <button
            type="button"
            onClick={onOpenImageUpload}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-lg hover:bg-gray-600"
          >
            <ImageIcon className="w-4 h-4" /> 사진 업로드
          </button>
        </div>
      )}

      <div className="flex items-end space-x-3">
        {/* 플러스 버튼 (이미지 없을 때만) */}
        {!hasImage && (
          <button
            id="open-input-options-btn"
            type="button"
            onClick={() => setInputOptions((prev) => !prev)}
            className="p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 h-[48px]"
            disabled={isWaitingForResponse}
          >
            <Plus className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 relative">
          {/* 선택된 스티커 표시 */}
          {stickerToSend && (
            <div className="mb-2 p-2 bg-gray-700 rounded-lg flex items-center gap-2 text-sm text-gray-300">
              <img
                src={stickerToSend.data}
                alt={stickerToSend.name}
                className="w-6 h-6 rounded object-cover"
              />
              <span>스티커: {stickerToSend.name}</span>
              <button
                type="button"
                onClick={onStickerClear}
                className="ml-auto text-gray-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* 메시지 입력창 */}
          <textarea
            id="new-message-input"
            placeholder={placeholder}
            className="w-full pl-4 pr-20 py-3 bg-gray-800 text-white rounded-2xl border border-gray-700 resize-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50 transition-all duration-200 text-sm placeholder-gray-500"
            rows={1}
            style={{ minHeight: 48, maxHeight: 120 }}
            disabled={isWaitingForResponse}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
          />

          {/* 우측 액션 버튼들 */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <button
              id="sticker-btn"
              type="button"
              onClick={onToggleUserStickerPanel}
              className="p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-full transition-all duration-200"
              disabled={isWaitingForResponse}
            >
              <Smile className="w-4 h-4" />
            </button>

            <button
              id="send-message-btn"
              type="button"
              onClick={handleSend}
              className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              disabled={isWaitingForResponse || (!text.trim() && !stickerToSend)}
              title="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          {/* 사용자 스티커 패널 */}
          {renderUserStickerPanel?.()}
        </div>
      </div>
    </div>
  );
}

export default MainChat;
