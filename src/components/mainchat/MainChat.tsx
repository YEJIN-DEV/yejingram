import type { Room } from '../../entities/room/types';
import { Menu, MoreHorizontal, MessageCircle, Smile, X, Plus, Paperclip, Edit2, Check, XCircle, StickyNote, Brain, BookOpen, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';
import { selectCharacterById } from '../../entities/character/selectors';
import { useMemo, useState, useRef, useEffect } from 'react';
import { type AppDispatch, type RootState } from '../../app/store';
import { selectMessagesByRoomId } from '../../entities/message/selectors';
import MessageList from './Message';
import { messagesActions } from '../../entities/message/slice';
import { roomsActions } from '../../entities/room/slice';
import { Avatar, GroupChatAvatar } from '../../utils/Avatar';
import { SendMessage, SendGroupChatMessage } from '../../services/LLMcaller';
import type { Sticker } from '../../entities/character/types';
import { StickerPanel } from './StickerPanel';
import type { FileToSend } from '../../entities/message/types';
import { selectAllSettings } from '../../entities/setting/selectors';
import { replacePlaceholders } from '../../utils/placeholder';
import { nanoid } from '@reduxjs/toolkit';
import { useCharacterOnlineStatus } from '../../utils/simulateOnline';
import { LorebookEditor } from '../character/LorebookEditor';
import { settingsActions } from '../../entities/setting/slice';
import { charactersActions } from '../../entities/character/slice';
import { MemoryManager } from '../character/MemoryManager';
import { renderFile } from './FilePreview';

interface MainChatProps {
  room: Room | null;
  onToggleMobileSidebar: () => void;
  onToggleCharacterPanel: () => void;
  onToggleGroupchatSettings: () => void;
}

function MainChat({ room, onToggleMobileSidebar, onToggleCharacterPanel, onToggleGroupchatSettings }: MainChatProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [typingCharacterId, setTypingCharacterId] = useState<number | null>(null);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [stickerToSend, setStickerToSend] = useState<Sticker | null>(null);
  const [isEditingRoomName, setIsEditingRoomName] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [fileToSend, setFileToSend] = useState<FileToSend | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAuthorNoteOpen, setIsAuthorNoteOpen] = useState(false);
  const [tempAuthorNote, setTempAuthorNote] = useState('');
  const [isRoomMemoryOpen, setIsRoomMemoryOpen] = useState(false);
  const [isLoreBookOpen, setIsLoreBookOpen] = useState(false);

  const dispatch = useDispatch<AppDispatch>();

  // Pending LLM request management: store last pending room/message and debounce timer
  const pendingRequestRef = useRef<{ room: Room; } | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const DEBOUNCE_DELAY = 1500; // ms

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

  const handleOpenLoreBook = () => {
    if (room?.type === 'Direct' && character) {
      setIsLoreBookOpen(true);
    } else if (room?.type === 'Group' && memberChars && memberChars.length > 0) {
      setIsLoreBookOpen(true);
    } else {
      toast.error('로어북을 열 수 있는 캐릭터가 없습니다.');
    }
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

  const handleOpenFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleCancelFilePreview = () => {
    setFileToSend(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFileToSend({ dataUrl: reader.result as string, mimeType: file.type, name: file.name });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = Array.from(event.clipboardData.items).find(item => item.kind === 'file')?.getAsFile();
    if (file) {
      event.preventDefault();
      const reader = new FileReader();
      reader.onloadend = () => {
        setFileToSend({ dataUrl: reader.result as string, mimeType: file.type, name: file.name });
      };
      reader.readAsDataURL(file);
    }
  };

  // Add message immediately to UI and schedule LLM request after 1s of no further typing
  const sendPendingRequest = () => {
    // clear timer
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    const pending = pendingRequestRef.current;
    if (!pending) return;

    // Start LLM request
    setIsWaitingForResponse(true);

    const targetRoom = pending.room;
    pendingRequestRef.current = null;

    let responsePromise;
    if (targetRoom.type === 'Group') {
      responsePromise = SendGroupChatMessage(targetRoom, setTypingCharacterId);
    } else {
      responsePromise = SendMessage(targetRoom, setTypingCharacterId);
    }

    responsePromise.then(() => {
      setIsWaitingForResponse(false);
    });
  };

  const handleSendMessage = (text: string) => {
    if (!room) return;
    if (!text.trim() && !stickerToSend && !fileToSend) return;

    // Warn when no persona is explicitly selected
    if (settings?.selectedPersonaId == null) {
      toast.error('선택된 페르소나가 없습니다. 설정 > 페르소나에서 선택 또는 추가해주세요.');
      return;
    }

    const messageType = stickerToSend ? 'STICKER' : fileToSend ? (fileToSend.mimeType.startsWith('image') ? 'IMAGE' : (fileToSend.mimeType.startsWith('audio') ? 'AUDIO' : (fileToSend.mimeType.startsWith('video') ? 'VIDEO' : 'FILE'))) : 'TEXT';

    const currentCharName = room.type === 'Direct' ? (character?.name || undefined) : undefined;
    const currentUserName = settings.userName?.trim();
    const processedText = text ? replacePlaceholders(text, { user: currentUserName, char: currentCharName }) : '';

    const userMessage = {
      id: nanoid(),
      roomId: room.id,
      authorId: 0, // Assuming current user ID is '0'
      content: processedText,
      createdAt: new Date().toISOString(),
      type: messageType as 'TEXT' | 'STICKER' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'FILE',
      sticker: stickerToSend || undefined,
      file: fileToSend ? { dataUrl: fileToSend.dataUrl, mimeType: fileToSend.mimeType, name: fileToSend.name } : undefined,
    };

    // Immediately show user's message
    dispatch(messagesActions.upsertOne(userMessage));

    // clear UI selection
    setStickerToSend(null);
    setFileToSend(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Schedule (or reschedule) LLM request for this room after 1s of no typing
    pendingRequestRef.current = { room };
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    // set a 1s debounce before sending LLM request
    debounceTimerRef.current = window.setTimeout(() => {
      sendPendingRequest();
    }, DEBOUNCE_DELAY) as unknown as number;
  };

  // Called when user types or interacts with input to postpone/send LLM request
  const handleUserActivity = () => {
    // If there's a pending timer, reset it (postpone LLM call)
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    // Start a fresh 1s timer to send pending request
    debounceTimerRef.current = window.setTimeout(() => {
      sendPendingRequest();
    }, DEBOUNCE_DELAY) as unknown as number;
  };

  // Clean up debounce timer and pending request on room change or unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      pendingRequestRef.current = null;
    };
  }, [room?.id]);

  if (!room) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--color-bg-secondary)]">
        <button
          id="mobile-sidebar-toggle"
          className="absolute top-4 left-4 p-2 rounded-full hover:bg-[var(--color-bg-hover)] md:hidden"
          onClick={onToggleMobileSidebar}
        >
          <Menu className="h-5 w-5 text-[var(--color-icon-primary)]" />
        </button>
        <div className="text-center">
          <div className="w-24 h-24 bg-[var(--color-button-secondary-accent)] rounded-full flex items-center justify-center mx-auto mb-6">
            <MessageCircle className="w-12 h-12 text-[var(--color-icon-secondary)]" />
          </div>
          <h3 className="text-xl md:text-2xl font-semibold text-[var(--color-text-primary)] mb-3">
            메시지를 보내세요
          </h3>
          <p className="text-sm md:text-base text-[var(--color-text-secondary)] leading-relaxed">
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
        <RoomMemoryModal
          open={isRoomMemoryOpen}
          onClose={() => setIsRoomMemoryOpen(false)}
          roomId={room.id}
        />
        <LoreBookModal
          open={isLoreBookOpen}
          onClose={() => setIsLoreBookOpen(false)}
          characterId={room?.type === 'Direct' ? character!.id : undefined}
          memberChars={room?.type === 'Group' ? memberChars : undefined}
          roomLorebook={room?.type === 'Group' ? (room?.lorebook || []) : undefined}
          roomType={room?.type}
          roomId={room?.id}
        />
        <ChatHeader
          room={room}
          character={character}
          memberChars={memberChars}
          isEditingRoomName={isEditingRoomName}
          newRoomName={newRoomName}
          onToggleMobileSidebar={onToggleMobileSidebar}
          onEditRoomName={handleEditRoomName}
          onSaveRoomName={handleSaveRoomName}
          onCancelEditRoomName={() => setIsEditingRoomName(false)}
          onSetNewRoomName={setNewRoomName}
          onOpenAuthorNote={openAuthorNote}
          onOpenRoomMemory={() => setIsRoomMemoryOpen(true)}
          onOpenLoreBook={handleOpenLoreBook}
          onOpenCharacterPanel={onToggleCharacterPanel}
          onOpenGroupchatSettings={onToggleGroupchatSettings}
        />

        {/* Messages Container*/}
        <div id="messages-container" className="flex-1 overflow-y-auto bg-[var(--color-bg-main)]" ref={messagesContainerRef}>
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

        {/* Input Area*/}
        <div className="px-6 py-4 bg-[var(--color-bg-main)] border-t border-[var(--color-border)]">
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="*/*" className="hidden" />
          <InputArea
            room={room}
            isWaitingForResponse={isWaitingForResponse}
            stickerToSend={stickerToSend}
            fileToSend={fileToSend}
            onOpenFileUpload={handleOpenFileUpload}
            onCancelFilePreview={handleCancelFilePreview}
            onToggleUserStickerPanel={handleToggleStickerPanel}
            onStickerClear={handleCancelSticker}
            onSendMessage={handleSendMessage}
            onPaste={handlePaste}
            onFocus={handleInputFocus}
            onUserActivity={handleUserActivity}
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
    );
  }
}

interface ChatHeaderProps {
  room: Room;
  character: any;
  memberChars: any[] | undefined;
  isEditingRoomName: boolean;
  newRoomName: string;
  onToggleMobileSidebar: () => void;
  onEditRoomName: () => void;
  onSaveRoomName: () => void;
  onCancelEditRoomName: () => void;
  onSetNewRoomName: (name: string) => void;
  onOpenAuthorNote: () => void;
  onOpenRoomMemory: () => void;
  onOpenLoreBook: () => void;
  onOpenCharacterPanel: () => void;
  onOpenGroupchatSettings: () => void;
}

function ChatHeader({
  room,
  character,
  memberChars,
  isEditingRoomName,
  newRoomName,
  onToggleMobileSidebar,
  onEditRoomName,
  onSaveRoomName,
  onCancelEditRoomName,
  onSetNewRoomName,
  onOpenAuthorNote,
  onOpenRoomMemory,
  onOpenLoreBook,
  onOpenCharacterPanel,
  onOpenGroupchatSettings
}: ChatHeaderProps) {
  const dispatch = useDispatch();
  const getHeaderAvatar = () => {
    if (room.type === 'Group') {
      return (
        <>
          <GroupChatAvatar participants={room.memberIds.map(id => memberChars?.find(c => c?.id === id)).filter(Boolean)} />
        </>
      );
    }
    if (room.type === 'Direct' && character) {
      return (
        <>
          <Avatar char={character} size="md" />
          <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${useCharacterOnlineStatus(character.id) ? 'bg-[var(--color-indicator-online)]' : 'bg-[var(--color-indicator-offline)]'} border-2 border-[var(--color-bg-main)] rounded-full`}></div>
        </>
      );
    }
    return null;
  };

  const getHeaderTitle = () => {
    if (room.type === 'Direct' && character) {
      return character.name;
    }
    return room.name;
  };

  const getHeaderSubtitle = () => {
    if (room.type === 'Group') {
      return memberChars && memberChars.length > 0
        ? memberChars.map(char => char?.name).filter(Boolean).join(', ')
        : `${room.memberIds.length}명의 참여자`;
    }
    if (room.type === 'Direct') {
      return room.name;
    }
    return '';
  };

  const getRoomNameEditSize = () => {
    if (room.type === 'Direct') {
      return "bg-[var(--color-bg-input-primary)] text-[var(--color-text-primary)] text-sm rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-border)]";
    }
    return "bg-[var(--color-bg-input-primary)] text-[var(--color-text-primary)] text-lg font-semibold rounded-lg px-3 py-1 w-full focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-border)]";
  };

  const getEditButtonSize = () => {
    if (room.type === 'Direct') {
      return "w-3 h-3";
    }
    return "w-4 h-4";
  };

  const getEditPosition = () => {
    if (room.type === 'Direct') {
      return "mt-1";
    }
    return "";
  };

  return (
    <header className="px-6 py-4 bg-[var(--color-bg-main)] border-b border-[var(--color-border)] flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <button
          id="mobile-sidebar-toggle"
          className="p-2 -ml-2 rounded-full hover:bg-[var(--color-bg-hover)] md:hidden"
          onClick={onToggleMobileSidebar}
        >
          <Menu className="h-5 w-5 text-[var(--color-icon-primary)]" />
        </button>
        <div className="relative">
          {getHeaderAvatar()}
        </div>
        <div className="flex-1">
          {isEditingRoomName ? (
            <div className={`flex items-center space-x-2 ${getEditPosition()}`}>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => onSetNewRoomName(e.target.value)}
                className={getRoomNameEditSize()}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    onSaveRoomName();
                  }
                  if (e.key === 'Escape') onCancelEditRoomName();
                }}
              />
              <button onClick={onSaveRoomName} className="p-1 text-[var(--color-button-positive)] hover:text-[var(--color-button-positive-accent)]">
                <Check className={getEditButtonSize()} />
              </button>
              <button onClick={onCancelEditRoomName} className="p-1 text-[var(--color-textual-button-negative)] hover:text-[var(--color-textual-button-negative-accent)]">
                <XCircle className={getEditButtonSize()} />
              </button>
            </div>
          ) : (
            <>
              {room.type === 'Direct' ? (
                <>
                  <h2 className="font-bold text-[var(--color-text-primary)] text-lg">{getHeaderTitle()}</h2>
                  <div className={`group flex items-center space-x-2 ${getEditPosition()}`}>
                    <p className="text-sm text-[var(--color-icon-tertiary)]">{getHeaderSubtitle()}</p>
                    <button
                      onClick={onEditRoomName}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[var(--color-icon-secondary)] hover:text-[var(--color-icon-primary)]"
                    >
                      <Edit2 className={getEditButtonSize()} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="group flex items-center space-x-2">
                    <h2 className="font-bold text-[var(--color-text-primary)] text-lg">{getHeaderTitle()}</h2>
                    <button
                      onClick={onEditRoomName}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[var(--color-icon-secondary)] hover:text-[var(--color-icon-primary)]"
                    >
                      <Edit2 className={getEditButtonSize()} />
                    </button>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] flex items-center mt-1">
                    {getHeaderSubtitle()}
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-icon-primary)]" title="작가의 노트" onClick={onOpenAuthorNote}>
          <StickyNote className="w-5 h-5" />
        </button>
        <button className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-icon-primary)]" title="방 메모리" onClick={onOpenRoomMemory}>
          <Brain className="w-5 h-5" />
        </button>
        <button className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-icon-primary)]" title="활성화된 로어북" onClick={onOpenLoreBook}>
          <BookOpen className="w-5 h-5" />
        </button>
        <button className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-icon-primary)]" title={room.type === 'Direct' ? "캐릭터 설정" : "방 설정"} onClick={() => {
          if (room.type === 'Group') {
            dispatch(settingsActions.setEditingRoomId(room.id));
            onOpenGroupchatSettings();
          } else {
            dispatch(charactersActions.setEditingCharacterId(character.id));
            onOpenCharacterPanel();
          }
        }}>
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>
    </header >
  );
}

interface InputAreaProps {
  room: Room;
  isWaitingForResponse: boolean;
  fileToSend?: FileToSend | null;
  stickerToSend?: Sticker | null;

  // 이벤트 핸들러들
  onOpenFileUpload?: () => void;
  onCancelFilePreview?: () => void;
  onToggleUserStickerPanel?: () => void;
  onSendMessage: (text: string) => void;
  onStickerClear?: () => void;
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onUserActivity?: () => void;

  // (선택) 커스텀 스티커 패널 렌더링
  renderUserStickerPanel?: () => React.ReactNode;
}

function InputArea({
  isWaitingForResponse,
  fileToSend,
  stickerToSend,
  onOpenFileUpload,
  onCancelFilePreview,
  onToggleUserStickerPanel,
  onSendMessage,
  onStickerClear,
  onPaste,
  onFocus,
  onUserActivity,
  renderUserStickerPanel,
}: InputAreaProps) {
  const [text, setText] = useState("");
  const [showInputOptions, setInputOptions] = useState(false);
  const hasFile = !!fileToSend;
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isWaitingForResponse && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isWaitingForResponse]);

  const placeholder = useMemo(() => {
    if (hasFile) return "캡션 추가...";
    if (stickerToSend) return "스티커와 함께 메시지...";
    return "메시지 보내기...";
  }, [hasFile, stickerToSend]);

  const handleSend = () => {
    onSendMessage(text.trim());
    setText("");
    // 전송 후 입력 필드에 포커스를 유지하여 키보드가 내려가지 않도록 함
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="input-area-container relative">
      {/* File Preview*/}
      {hasFile && fileToSend?.dataUrl && (
        <div className="mb-3 p-3 bg-[var(--color-bg-secondary)] rounded-xl">
          <div className="relative inline-block">
            <div className="rounded-lg overflow-hidden">
              {renderFile(fileToSend, true)}
            </div>
            <button
              type="button"
              onClick={onCancelFilePreview}
              className="absolute -top-2 -right-2 p-1 bg-[var(--color-button-tertiary)] rounded-full text-[var(--color-text-accent)] hover:bg-[var(--color-button-negative)] transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Selected Sticker Display*/}
      {stickerToSend && (
        <div className="mb-3 p-3 bg-[var(--color-bg-secondary)] rounded-xl flex items-center gap-3 text-sm text-[var(--color-icon-primary)]">
          <img
            src={stickerToSend.data}
            alt={stickerToSend.name}
            className="w-8 h-8 rounded-lg object-cover"
          />
          <span className="flex-1">{stickerToSend.name}</span>
          <button
            type="button"
            onClick={onStickerClear}
            className="text-[var(--color-icon-secondary)] hover:text-[var(--color-icon-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Input Options Popover*/}
      {showInputOptions && (
        <div className="absolute bottom-full left-4 mb-2 w-48 bg-[var(--color-bg-main)] rounded-2xl shadow-lg border border-[var(--color-border)] p-2 animate-fadeIn">
          <button
            type="button"
            onClick={() => {
              onOpenFileUpload?.();
              setInputOptions((prev) => !prev);
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-xl hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]"
          >
            <Paperclip className="w-4 h-4" /> 파일
          </button>
        </div>
      )}

      {/* Main Input Container*/}
      <div className="flex items-center space-x-3">
        {/* Plus Button */}
        {!hasFile && (
          <button
            id="open-input-options-btn"
            type="button"
            onClick={() => setInputOptions((prev) => !prev)}
            className="p-2 text-[var(--color-icon-tertiary)] hover:[var(--color-text-secondary)] rounded-full hover:bg-[var(--color-bg-hover)] transition-all duration-200 flex-shrink-0"
            disabled={isWaitingForResponse}
          >
            <Plus className="w-5 h-5" />
          </button>
        )}

        {/* Input Field Container */}
        <div className="flex-1 relative">
          <div className="flex items-end bg-[var(--color-bg-input-primary)] rounded-3xl px-4 py-2">
            <textarea
              id="new-message-input"
              ref={inputRef}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-[var(--color-text-primary)] resize-none border-none outline-none text-sm placeholder-[var(--color-text-secondary)] max-h-20"
              rows={1}
              disabled={isWaitingForResponse}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                onUserActivity?.();
                // Auto-resize textarea
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
                onUserActivity?.();
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
                className="p-1 text-[var(--color-icon-tertiary)] hover:[var(--color-button-primary-accent)] transition-all duration-200"
                disabled={isWaitingForResponse}
              >
                <Smile className="w-5 h-5" />
              </button>

              {(text.trim() || stickerToSend) ? (
                <button
                  id="send-message-btn"
                  type="button"
                  onClick={handleSend}
                  className="p-1 text-[var(--color-button-primary)] hover:text-[var(--color-button-primary-accent)] transition-all duration-200 font-semibold text-sm"
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--color-bg-shadow)]/50">
      <div className="w-full max-w-lg mx-4 bg-[var(--color-bg-main)] rounded-2xl border border-[var(--color-border)] shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[var(--color-text-primary)] font-semibold">
            <StickyNote className="w-5 h-5 text-[var(--color-button-primary)]" /> 작가의 노트
          </div>
          <button className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-icon-tertiary)] transition-colors" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <textarea
          className="w-full h-48 p-4 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-xl border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] resize-none"
          placeholder="방 전체에 적용될 메타 지침을 적어주세요. (예: 톤, 금지사항, 세계관 규칙, 줄거리 방향 등)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-3">
          <button className="px-4 py-2 rounded-xl bg-[var(--color-button-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-button-secondary-accent)] transition-colors font-medium" onClick={onClose}>취소</button>
          <button className="px-4 py-2 rounded-xl bg-[var(--color-button-primary)] text-[var(--color-text-accent)] hover:bg-[var(--color-button-primary-accent)] transition-colors font-medium" onClick={onSave}>저장</button>
        </div>
      </div>
    </div>
  );
}

function RoomMemoryModal({ open, onClose, roomId }: { open: boolean; onClose: () => void; roomId: string; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--color-bg-shadow)]/50">
      <div className="w-full max-w-2xl mx-4 bg-[var(--color-bg-main)] rounded-2xl border border-[var(--color-border)] shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[var(--color-text-primary)] font-semibold">
            <Brain className="w-5 h-5 text-[var(--color-button-primary)]" /> 방 메모리
          </div>
          <button className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-icon-tertiary)] transition-colors" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-3">이 방에만 적용되는 기억을 관리합니다. 모델은 여기의 메모리를 우선적으로 참고합니다.</p>
        <MemoryManager roomId={roomId} />
        <div className="mt-4 flex justify-end">
          <button className="px-4 py-2 rounded-xl bg-[var(--color-button-primary)] text-[var(--color-text-accent)] hover:bg-[var(--color-button-primary-accent)] transition-colors font-medium" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function LoreBookModal({ open, onClose, characterId, memberChars, roomLorebook, roomType, roomId }: { open: boolean; onClose: () => void; characterId?: number; memberChars?: any[]; roomLorebook?: any[]; roomType?: string; roomId?: string; }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--color-bg-shadow)]/50">
      <div className="w-full max-w-4xl mx-4 bg-[var(--color-bg-main)] rounded-2xl border border-[var(--color-border)] shadow-xl p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-[var(--color-text-primary)] font-semibold">
            <BookOpen className="w-5 h-5 text-[var(--color-button-primary)]" /> 로어북 편집기
          </div>
          <button className="p-2 rounded-full hover:bg-[var(--color-bg-hover)] text-[var(--color-icon-tertiary)] transition-colors" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-3">캐릭터의 로어북을 편집합니다. 로어북은 채팅에서 특정 키워드가 등장할 때 자동으로 적용됩니다.</p>
        {(roomType === 'Group') && roomLorebook && (
          <details className="mb-6">
            <summary className="flex items-center justify-between text-lg font-semibold text-[var(--color-text-primary)] mb-2 cursor-pointer hover:text-[var(--color-icon-primary)] transition-colors">
              <span>그룹 채팅 로어북</span>
              <ChevronDown className="w-5 h-5 text-[var(--color-icon-tertiary)]" />
            </summary>
            <LorebookEditor roomId={roomId} roomLorebook={roomLorebook} />
          </details>
        )}
        {memberChars && memberChars.length > 0 ? (
          memberChars.map(char => (
            <details key={char.id} className="mb-6">
              <summary className="flex items-center justify-between text-lg font-semibold text-[var(--color-text-primary)] mb-2 cursor-pointer hover:text-[var(--color-icon-primary)] transition-colors">
                <span>{char.name}의 로어북</span>
                <ChevronDown className="w-5 h-5 text-[var(--color-icon-tertiary)]" />
              </summary>
              <LorebookEditor characterId={char.id} />
            </details>
          ))
        ) : (
          characterId && (
            <LorebookEditor characterId={characterId} />
          )
        )}
        <div className="mt-4 flex justify-end">
          <button className="px-4 py-2 rounded-xl bg-[var(--color-button-primary)] text-[var(--color-text-accent)] hover:bg-[var(--color-button-primary-accent)] transition-colors font-medium" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

export default MainChat;

