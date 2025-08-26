/* eslint-disable react-hooks/rules-of-hooks */
import type { Room } from '../../entities/room/types';
import { Menu, Globe, Users, Phone, Video, MoreHorizontal, MessageCircle, Smile, X, Plus, ImageIcon, Edit2, Check, XCircle, StickyNote } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { selectCharacterById } from '../../entities/character/selectors';
import { useMemo, useState, useRef, useEffect } from 'react';
import { type AppDispatch, type RootState } from '../../app/store';
import { selectMessagesByRoomId } from '../../entities/message/selectors';
import MessageList from './Message';
import { messagesActions } from '../../entities/message/slice';
import { roomsActions } from '../../entities/room/slice';
import { Avatar } from '../../utils/Avatar';
import { SendMessage, SendGroupChatMessage, SendOpenChatMessage } from '../../services/LLMcaller';
import type { Sticker } from '../../entities/character/types';
import { StickerPanel } from './StickerPanel';
import type { ImageToSend } from '../../entities/message/types';
import { selectAllSettings } from '../../entities/setting/selectors';
import { replacePlaceholders } from '../../utils/placeholder';
import { nanoid } from '@reduxjs/toolkit';
import { useCharacterOnlineStatus } from '../../utils/simulateOnline';

interface MainChatProps {
  room: Room | null;
  onToggleMobileSidebar: () => void;
}

function MainChat({ room, onToggleMobileSidebar }: MainChatProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [typingCharacterId, setTypingCharacterId] = useState<number | null>(null);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [stickerToSend, setStickerToSend] = useState<Sticker | null>(null);
  const [isEditingRoomName, setIsEditingRoomName] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [imageToSend, setImageToSend] = useState<ImageToSend | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAuthorNoteOpen, setIsAuthorNoteOpen] = useState(false);
  const [tempAuthorNote, setTempAuthorNote] = useState('');

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
  const settings = useSelector(selectAllSettings);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      // DOM 업데이트 후 스크롤이 정확하게 되도록 setTimeout 사용
      setTimeout(() => {
        scrollToBottom(container);
      }, 0);
    }
  }, [room, messages]);

  const scrollToBottom = (container: HTMLDivElement | null) => {
    // rAF보다 직접 할당이 모바일에서 더 안정적일 때가 많습니다
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  };


  const handleInputFocus = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // 모바일 키보드가 열리면 visualViewport가 resize됩니다 (특히 iOS)
    if (typeof window !== 'undefined' && 'visualViewport' in window) {
      const vv = window.visualViewport!;
      const onResize = () => {
        // 키보드가 완전히 열린 뒤 한 번 더 스크롤
        scrollToBottom(container);
        vv.removeEventListener('resize', onResize);
      };
      vv.addEventListener('resize', onResize, { once: true });

      // 혹시 resize 이벤트가 안 오더라도 대비용 딜레이
      setTimeout(scrollToBottom, 350);
    } else {
      // 안드로이드/기타 브라우저 대비: 짧은 딜레이만으로도 충분한 경우가 많음
      setTimeout(scrollToBottom, 120);
    }
  };

  const handleEditRoomName = () => {
    if (!room) return;
    setNewRoomName(room.name);
    setIsEditingRoomName(true);
  };

  const openAuthorNote = () => {
    if (!room) return;
    setTempAuthorNote(room.authorNote || '');
    setIsAuthorNoteOpen(true);
  };

  const saveAuthorNote = () => {
    if (!room) return;
    dispatch(roomsActions.upsertOne({ ...room, authorNote: tempAuthorNote }));
    setIsAuthorNoteOpen(false);
  };

  const handleSaveRoomName = () => {
    if (!room || !newRoomName.trim()) return;
    dispatch(roomsActions.upsertOne({
      ...room,
      name: newRoomName.trim(),
    }));
    setIsEditingRoomName(false);
  };

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

  const handleOpenImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleCancelImagePreview = () => {
    setImageToSend(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToSend({ dataUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = Array.from(event.clipboardData.items).find(item => item.type.startsWith('image/'))?.getAsFile();
    if (file) {
      event.preventDefault();
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToSend({ dataUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = (text: string) => {
    if (!room) return;
    if (!text.trim() && !stickerToSend && !imageToSend) return;

    setIsWaitingForResponse(true);

    const messageType = stickerToSend ? 'STICKER' : imageToSend ? 'IMAGE' : 'TEXT';

    const currentCharName = room.type === 'Direct' ? (character?.name || undefined) : undefined;
    const currentUserName = settings.userName?.trim();
    const processedText = text ? replacePlaceholders(text, { user: currentUserName, char: currentCharName }) : '';

    const userMessage = {
      id: nanoid(),
      roomId: room.id,
      authorId: 0, // Assuming current user ID is '0'
      content: processedText,
      createdAt: new Date().toISOString(),
      type: messageType as 'TEXT' | 'STICKER' | 'IMAGE',
      sticker: stickerToSend || undefined,
      image: imageToSend ? { dataUrl: imageToSend.dataUrl } : undefined,
    };

    dispatch(messagesActions.upsertOne(userMessage));


    setStickerToSend(null);
    setImageToSend(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (!memberChars) {
      setIsWaitingForResponse(false);
      return;
    }

    let responsePromise;
    if (room.type === 'Group') {
      responsePromise = SendGroupChatMessage(room, setTypingCharacterId);
    } else if (room.type === 'Open') {
      responsePromise = SendOpenChatMessage(room, setTypingCharacterId);
    } else {
      responsePromise = SendMessage(room, setTypingCharacterId);
    }

    responsePromise.then(() => {
      setIsWaitingForResponse(false);
    });
  };

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <button
          id="mobile-sidebar-toggle"
          className="absolute top-4 left-4 p-2 rounded-full hover:bg-gray-100 md:hidden"
          onClick={onToggleMobileSidebar}
        >
          <Menu className="h-5 w-5 text-gray-600" />
        </button>
        <div className="text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageCircle className="w-12 h-12 text-white" />
          </div>
          <h3 className="text-xl md:text-2xl font-semibold text-gray-800 mb-3">
            메시지를 보내세요
          </h3>
          <p className="text-sm md:text-base text-gray-500 leading-relaxed">
            친구나 그룹과 개인 사진 및 메시지를 공유하세요.
          </p>
        </div>
      </div>
    );
  }
  else {
    return (
      <>
        <AuthorNoteModal
          open={isAuthorNoteOpen}
          onClose={() => setIsAuthorNoteOpen(false)}
          value={tempAuthorNote}
          onChange={setTempAuthorNote}
          onSave={saveAuthorNote}
        />
        {room.type == "Open" ? (
          <>
            {/* Instagram DM Style Header for Open Chat */}
            <header className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  id="mobile-sidebar-toggle"
                  className="p-2 -ml-2 rounded-full hover:bg-gray-100 md:hidden"
                  onClick={onToggleMobileSidebar}
                >
                  <Menu className="h-5 w-5 text-gray-600" />
                </button>
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  {isEditingRoomName ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        className="bg-gray-100 text-gray-900 text-lg font-semibold rounded-lg px-3 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            handleSaveRoomName();
                          }
                          if (e.key === 'Escape') setIsEditingRoomName(false);
                        }}
                      />
                      <button onClick={handleSaveRoomName} className="p-1 text-green-600 hover:text-green-700">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setIsEditingRoomName(false)} className="p-1 text-red-600 hover:text-red-700">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="group flex items-center space-x-2">
                      <h2 className="font-bold text-gray-900 text-lg">{room.name}</h2>
                      <button
                        onClick={handleEditRoomName}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <p className="text-sm text-gray-500 flex items-center mt-1">
                    {room.currentParticipants?.length || 0}명 활성 · 오픈 채팅
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                  <Video className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600" title="작가의 노트" onClick={openAuthorNote}>
                  <StickyNote className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Messages Container - Instagram DM Style */}
            <div id="messages-container" className="flex-1 overflow-y-auto bg-white" ref={messagesContainerRef}>
              <MessageList
                messages={messages}
                room={room}
                isWaitingForResponse={isWaitingForResponse}
                typingCharacterId={typingCharacterId}
                currentUserId={0}
                setTypingCharacterId={setTypingCharacterId}
                setIsWaitingForResponse={setIsWaitingForResponse}
              />
              <div id="messages-end-ref"></div>
            </div>

            {/* Input Area - Instagram DM Style */}
            <div className="px-6 py-4 bg-white border-t border-gray-200">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              <InputArea
                room={room}
                isWaitingForResponse={isWaitingForResponse}
                stickerToSend={stickerToSend}
                imageToSend={imageToSend}
                onOpenImageUpload={handleOpenImageUpload}
                onCancelImagePreview={handleCancelImagePreview}
                onToggleUserStickerPanel={handleToggleStickerPanel}
                onStickerClear={handleCancelSticker}
                onSendMessage={handleSendMessage}
                onPaste={handlePaste}
                onFocus={handleInputFocus}
              />
            </div>
          </>
        ) : room.type == "Group" ? (
          <>
            {/* Instagram DM Style Header for Group Chat */}
            <header className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  id="mobile-sidebar-toggle"
                  className="p-2 -ml-2 rounded-full hover:bg-gray-100 md:hidden"
                  onClick={onToggleMobileSidebar}
                >
                  <Menu className="h-5 w-5 text-gray-600" />
                </button>
                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  {isEditingRoomName ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        className="bg-gray-100 text-gray-900 text-lg font-semibold rounded-lg px-3 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            handleSaveRoomName();
                          }
                          if (e.key === 'Escape') setIsEditingRoomName(false);
                        }}
                      />
                      <button onClick={handleSaveRoomName} className="p-1 text-green-600 hover:text-green-700">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setIsEditingRoomName(false)} className="p-1 text-red-600 hover:text-red-700">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="group flex items-center space-x-2">
                      <h2 className="font-bold text-gray-900 text-lg">{room.name}</h2>
                      <button
                        onClick={handleEditRoomName}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <p className="text-sm text-gray-500 flex items-center mt-1">
                    {memberChars && memberChars.length > 0
                      ? memberChars.map(char => char?.name).filter(Boolean).join(', ')
                      : `${room.memberIds.length}명의 참여자`}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                  <Video className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600" title="작가의 노트" onClick={openAuthorNote}>
                  <StickyNote className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Messages Container - Instagram DM Style */}
            <div id="messages-container" className="flex-1 overflow-y-auto bg-white" ref={messagesContainerRef}>
              <MessageList
                messages={messages}
                room={room}
                isWaitingForResponse={isWaitingForResponse}
                typingCharacterId={typingCharacterId}
                currentUserId={0}
                setTypingCharacterId={setTypingCharacterId}
                setIsWaitingForResponse={setIsWaitingForResponse}
              />
              <div id="messages-end-ref"></div>
            </div>

            {/* Input Area - Instagram DM Style */}
            <div className="px-6 py-4 bg-white border-t border-gray-200">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              <InputArea
                room={room}
                isWaitingForResponse={isWaitingForResponse}
                stickerToSend={stickerToSend}
                imageToSend={imageToSend}
                onOpenImageUpload={handleOpenImageUpload}
                onCancelImagePreview={handleCancelImagePreview}
                onToggleUserStickerPanel={handleToggleStickerPanel}
                onStickerClear={handleCancelSticker}
                onSendMessage={handleSendMessage}
                onPaste={handlePaste}
                onFocus={handleInputFocus}
              />
            </div>
          </>
        ) : room.type == "Direct" && character && messages ? (
          <>
            {/* Instagram DM Style Header for Direct Chat */}
            <header className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  id="mobile-sidebar-toggle"
                  className="p-2 -ml-2 rounded-full hover:bg-gray-100 md:hidden"
                  onClick={onToggleMobileSidebar}
                >
                  <Menu className="h-5 w-5 text-gray-600" />
                </button>
                <div className="relative">
                  <Avatar char={character} size="md" />
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${useCharacterOnlineStatus(character.id) ? 'bg-green-500' : 'bg-gray-500'} border-2 border-white rounded-full`}></div>
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-gray-900 text-lg">{character.name}</h2>
                  {isEditingRoomName ? (
                    <div className="flex items-center space-x-2 mt-1">
                      <input
                        type="text"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        className="bg-gray-100 text-gray-900 text-sm rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            handleSaveRoomName();
                          }
                          if (e.key === 'Escape') setIsEditingRoomName(false);
                        }}
                      />
                      <button onClick={handleSaveRoomName} className="p-1 text-green-600 hover:text-green-700">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={() => setIsEditingRoomName(false)} className="p-1 text-red-600 hover:text-red-700">
                        <XCircle className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="group flex items-center space-x-2 mt-1">
                      <p className="text-sm text-gray-500">{room.name}</p>
                      <button
                        onClick={handleEditRoomName}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                  <Video className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600" title="작가의 노트" onClick={openAuthorNote}>
                  <StickyNote className="w-5 h-5" />
                </button>
                <button className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Messages Container - Instagram DM Style */}
            <div id="messages-container" className="flex-1 overflow-y-auto bg-white" ref={messagesContainerRef}>
              <MessageList
                messages={messages}
                room={room}
                isWaitingForResponse={isWaitingForResponse}
                typingCharacterId={typingCharacterId}
                currentUserId={0}
                setTypingCharacterId={setTypingCharacterId}
                setIsWaitingForResponse={setIsWaitingForResponse}
              />
              <div id="messages-end-ref"></div>
            </div>

            {/* Input Area - Instagram DM Style */}
            <div className="px-6 py-4 bg-white border-t border-gray-200">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              <InputArea
                room={room}
                isWaitingForResponse={isWaitingForResponse}
                stickerToSend={stickerToSend}
                imageToSend={imageToSend}
                onOpenImageUpload={handleOpenImageUpload}
                onCancelImagePreview={handleCancelImagePreview}
                onToggleUserStickerPanel={handleToggleStickerPanel}
                onStickerClear={handleCancelSticker}
                onSendMessage={handleSendMessage}
                onPaste={handlePaste}
                onFocus={handleInputFocus}
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

interface InputAreaProps {
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
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;

  // (선택) 커스텀 스티커 패널 렌더링
  renderUserStickerPanel?: () => React.ReactNode;
}

function InputArea({
  isWaitingForResponse,
  imageToSend,
  stickerToSend,
  onOpenImageUpload,
  onCancelImagePreview,
  onToggleUserStickerPanel,
  onSendMessage,
  onStickerClear,
  onPaste,
  onFocus,
  renderUserStickerPanel,
}: InputAreaProps) {
  const [text, setText] = useState("");
  const [showInputOptions, setInputOptions] = useState(false);
  const hasImage = !!imageToSend;

  const placeholder = useMemo(() => {
    if (hasImage) return "캡션 추가...";
    if (stickerToSend) return "스티커와 함께 메시지...";
    return "메시지 보내기...";
  }, [hasImage, stickerToSend]);

  const handleSend = () => {
    onSendMessage(text.trim());
    setText("");
  };

  return (
    <div className="input-area-container relative">
      {/* Image Preview - Instagram DM Style */}
      {hasImage && imageToSend?.dataUrl && (
        <div className="mb-3 p-3 bg-gray-50 rounded-xl">
          <div className="relative w-16 h-16">
            <img
              src={imageToSend.dataUrl}
              className="w-full h-full object-cover rounded-xl"
              alt="미리보기"
            />
            <button
              type="button"
              onClick={onCancelImagePreview}
              className="absolute -top-2 -right-2 p-1 bg-gray-800 rounded-full text-white hover:bg-red-500 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Selected Sticker Display - Instagram DM Style */}
      {stickerToSend && (
        <div className="mb-3 p-3 bg-gray-50 rounded-xl flex items-center gap-3 text-sm text-gray-600">
          <img
            src={stickerToSend.data}
            alt={stickerToSend.name}
            className="w-8 h-8 rounded-lg object-cover"
          />
          <span className="flex-1">{stickerToSend.name}</span>
          <button
            type="button"
            onClick={onStickerClear}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Options Popover - Instagram DM Style */}
      {showInputOptions && (
        <div className="absolute bottom-full left-4 mb-2 w-48 bg-white rounded-2xl shadow-lg border border-gray-200 p-2 animate-fadeIn">
          <button
            type="button"
            onClick={() => {
              onOpenImageUpload?.();
              setInputOptions((prev) => !prev);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-xl hover:bg-gray-50 text-gray-700"
          >
            <ImageIcon className="w-4 h-4" /> 사진
          </button>
        </div>
      )}

      {/* Main Input Container - Instagram DM Style */}
      <div className="flex items-end space-x-3">
        {/* Plus Button */}
        {!hasImage && (
          <button
            id="open-input-options-btn"
            type="button"
            onClick={() => setInputOptions((prev) => !prev)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100 transition-all duration-200 flex-shrink-0"
            disabled={isWaitingForResponse}
          >
            <Plus className="w-5 h-5" />
          </button>
        )}

        {/* Input Field Container */}
        <div className="flex-1 relative">
          <div className="flex items-end bg-gray-100 rounded-3xl px-4 py-2">
            <textarea
              id="new-message-input"
              placeholder={placeholder}
              className="flex-1 bg-transparent text-gray-900 resize-none border-none outline-none text-sm placeholder-gray-500 max-h-20"
              rows={1}
              disabled={isWaitingForResponse}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                // Auto-resize textarea
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onPaste={onPaste}
              onFocus={onFocus}
              style={{ minHeight: '20px' }}
            />

            {/* Right Action Buttons */}
            <div className="flex items-center space-x-1 ml-2">
              <button
                id="sticker-btn"
                type="button"
                onClick={onToggleUserStickerPanel}
                className="p-1 text-gray-500 hover:text-gray-700 transition-all duration-200"
                disabled={isWaitingForResponse}
              >
                <Smile className="w-5 h-5" />
              </button>

              {(text.trim() || stickerToSend) ? (
                <button
                  id="send-message-btn"
                  type="button"
                  onClick={handleSend}
                  className="p-1 text-blue-500 hover:text-blue-600 transition-all duration-200 font-semibold text-sm"
                  disabled={isWaitingForResponse}
                  title="전송"
                >
                  전송
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* User Sticker Panel */}
      {renderUserStickerPanel?.()}
    </div>
  );
}

function AuthorNoteModal({ open, onClose, value, onChange, onSave }: { open: boolean; onClose: () => void; value: string; onChange: (v: string) => void; onSave: () => void; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg mx-4 bg-white rounded-2xl border border-gray-200 shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-gray-900 font-semibold">
            <StickyNote className="w-5 h-5 text-blue-500" /> 작가의 노트
          </div>
          <button className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <textarea
          className="w-full h-48 p-4 bg-gray-50 text-gray-900 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none"
          placeholder="방 전체에 적용될 메타 지침을 적어주세요. (예: 톤, 금지사항, 세계관 규칙, 줄거리 방향 등)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-3">
          <button className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors font-medium" onClick={onClose}>취소</button>
          <button className="px-4 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium" onClick={onSave}>저장</button>
        </div>
      </div>
    </div>
  );
}

export default MainChat;
