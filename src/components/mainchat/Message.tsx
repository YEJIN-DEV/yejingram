import React, { useRef, useEffect, useCallback, useState, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../app/store';
import { charactersAdapter } from '../../entities/character/slice';
import type { Message as MessageType } from '../../entities/message/types';
import { Calendar, Edit3, Trash2, RefreshCw, RotateCwSquare, Loader2, StepForward, UserCheck, UserX } from 'lucide-react';
import { messagesActions } from '../../entities/message/slice';
import { Virtuoso, type VirtuosoHandle, type Components } from 'react-virtuoso';

import SenderName from './SenderName';
import { Avatar } from '../../utils/Avatar';
import { SendMessage } from '../../services/llm/LLMcaller';
import type { Room } from '../../entities/room/types';
import { inviteCharacter } from '../../utils/inviteCharacter';
import { UrlPreview } from './chatcontents/UrlPreviewProps';
import { renderFile } from './FilePreview';
import { callImageGeneration } from '../../services/image/ImageCaller';

// Helper function for date formatting
const formatDateSeparator = (date: Date, locale: string | undefined): string => {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString(locale, options);
};

// Helper function to extract URLs from text
const extractUrls = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

// Helper function to render text with links
const renderTextWithLinks = (text: string, isMe: boolean) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline hover:opacity-80 ${isMe ? 'text-[var(--color-message-url-self)] hover:text-[var(--color-message-url-self-hover)]' : 'text-[var(--color-message-url-other)] hover:text-[var(--color-message-url-other-hover)]'
            }`}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

// Helper function to find message group
interface MessageGroupInfo {
  startIndex: number;
  endIndex: number;
  lastMessageId: string;
}

const findMessageGroup = (messages: MessageType[], currentIndex: number): MessageGroupInfo => {
  const currentMessage = messages[currentIndex];
  let startIndex = currentIndex;
  let endIndex = currentIndex;

  // Group consecutive messages from the same sender
  while (startIndex > 0 && messages[startIndex - 1].authorId === currentMessage.authorId) {
    startIndex--;
  }
  while (endIndex < messages.length - 1 && messages[endIndex + 1].authorId === currentMessage.authorId) {
    endIndex++;
  }

  return {
    startIndex,
    endIndex,
    lastMessageId: messages[endIndex].id.toString(), // Ensure string for data-id
  };
};

interface MessageListProps {
  messages: MessageType[];
  room: Room;
  isWaitingForResponse: boolean; // Assuming this is passed as a prop
  typingCharacterId: number | null;
  currentUserId: number; // Assuming current user ID is available to determine isMe

  setTypingCharacterId: React.Dispatch<React.SetStateAction<number | null>>;
  setIsWaitingForResponse: React.Dispatch<React.SetStateAction<boolean>>;
}

const MessageList = forwardRef<VirtuosoHandle, MessageListProps>(({
  messages,
  room,
  isWaitingForResponse,
  typingCharacterId,
  currentUserId,

  setTypingCharacterId,
  setIsWaitingForResponse
}, ref) => {
  const { t, i18n } = useTranslation();
  const dispatch = useDispatch<AppDispatch>();
  const allCharacters = useSelector((state: RootState) => charactersAdapter.getSelectors().selectAll(state.characters));
  const animatedMessageIds = useRef(new Set<string>());
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [expandedStickers, setExpandedStickers] = useState<Set<string>>(new Set());
  const [imageModalOpen, setImageModalOpen] = useState<boolean>(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');
  const [regeneratingImageIds, setRegeneratingImageIds] = useState<Set<string>>(new Set());
  // Mobile gesture helpers
  const [isCoarsePointer, setIsCoarsePointer] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return false;
    return window.matchMedia('(pointer: coarse)').matches;
  });
  const hideControlsTimeoutRef = useRef<number | null>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const CONTROLS_AUTOHIDE_MS = 2000; // 모바일 컨트롤 자동 숨김 시간(ms)

  const toggleStickerSize = useCallback((messageId: string) => {
    setExpandedStickers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  // Effect to handle animations (simplified for now)
  useEffect(() => {
    // This effect might be more complex if actual animation triggers are needed
    // For now, just ensuring the ref is cleared or managed
  }, [messages]);

  // Effect to handle ESC key for image modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && imageModalOpen) {
        setImageModalOpen(false);
      }
    };

    if (imageModalOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [imageModalOpen]);

  // Detect pointer type changes (desktop/mobile) and cleanup timers on unmount
  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mql = window.matchMedia('(pointer: coarse)');
    const handler = (e: MediaQueryListEvent) => setIsCoarsePointer(e.matches);

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => {
        mql.removeEventListener('change', handler);
      };
    }
  }, []);

  // Cleanup auto-hide timer on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        window.clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, []);

  const showControlsWithAutoHide = useCallback((messageId: string) => {
    setActiveMessageId(messageId);
    if (hideControlsTimeoutRef.current) {
      window.clearTimeout(hideControlsTimeoutRef.current);
    }
    hideControlsTimeoutRef.current = window.setTimeout(() => {
      setActiveMessageId(null);
    }, CONTROLS_AUTOHIDE_MS);
  }, []);

  // Mobile: hide controls when tapping outside the active message
  useEffect(() => {
    if (!isCoarsePointer) return; // 모바일(coarse pointer)에서만 동작

    const handlePointerDown = (e: PointerEvent) => {
      if (!activeMessageId) return;
      const target = e.target as Element | null;
      if (!target) return;
      const container = target.closest('[data-message-id]') as HTMLElement | null;
      const clickedId = container?.getAttribute('data-message-id');
      if (clickedId === activeMessageId) return; // 같은 메시지 내부 터치면 유지

      // 외부(또는 다른 메시지) 터치 시 컨트롤 숨김
      setActiveMessageId(null);
      if (hideControlsTimeoutRef.current) {
        window.clearTimeout(hideControlsTimeoutRef.current);
        hideControlsTimeoutRef.current = null;
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isCoarsePointer, activeMessageId]);

  const itemContent = (i: number, msg: MessageType) => {
    const prevMsg = messages[i - 1];
    const isMe = msg.authorId === currentUserId; // Derive isMe

    const showDateSeparator = (() => {
      if (!prevMsg) return true;
      const prevDate = new Date(prevMsg.createdAt);
      const currentDate = new Date(msg.createdAt);
      return prevDate.getFullYear() !== currentDate.getFullYear() ||
        prevDate.getMonth() !== currentDate.getMonth() ||
        prevDate.getDate() !== currentDate.getDate();
    })();

    const groupInfo = findMessageGroup(messages, i);
    const isGroupStart = i === groupInfo.startIndex;
    const isGroupEnd = i === groupInfo.endIndex;
    const bubbleMarginClass = isGroupEnd ? 'mb-1 md:mb-2' : 'mb-0.5';

    const cornerClass = (() => {
      if (isGroupStart && isGroupEnd) {
        return '';
      }
      if (isMe) {
        // Me (right side) - use small radius instead of square
        if (isGroupStart) return 'rounded-br-md'; // first -> right bottom slightly squared
        if (!isGroupEnd) return 'rounded-tr-md rounded-br-md'; // middle -> right top & bottom slightly squared
        return 'rounded-tr-md'; // last -> right top slightly squared
      }
      // Not me (left side)
      if (isGroupStart) return 'rounded-bl-md'; // first -> left bottom slightly squared
      if (!isGroupEnd) return 'rounded-tl-md rounded-bl-md'; // middle -> left top & bottom slightly squared
      return 'rounded-tl-md'; // last -> left top slightly squared
    })();

    const hasAnimated = animatedMessageIds.current.has(msg.id.toString());
    const needsAnimation = !hasAnimated;
    if (needsAnimation) {
      animatedMessageIds.current.add(msg.id.toString());
    }

    const renderMessageContent = () => {
      if (editingMessageId === msg.id) { // Use msg.id for editing
        // Editing state - Enhanced style with CSS variables for dark mode
        return (
          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-3`}>
            <div className="relative w-full">
              <textarea
                data-id={msg.id.toString()}
                className="edit-message-textarea w-full px-4 py-3 bg-[var(--color-bg-input-secondary)] text-[var(--color-text-primary)] rounded-2xl border border-[var(--color-border-strong)] focus:ring-2 focus:ring-[var(--color-focus-border)]/50 focus:border-[var(--color-focus-border)] text-base resize-y min-h-40 md:min-h-48 transition-all duration-300 shadow-lg hover:shadow-xl placeholder-[var(--color-text-informative-secondary)]"
                rows={5}
                defaultValue={msg.content || ''}
                placeholder={t('main.message.edit.placeholder')}
                autoFocus
              ></textarea>
              <div className="absolute bottom-3 right-3 text-xs text-[var(--color-text-informative-secondary)]">
                {t('main.message.edit.linebreakHint')}
              </div>
            </div>
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-[var(--color-text-informative-secondary)]">
                {t('main.message.edit.editing')}
              </div>
              <div className="flex items-center space-x-3">
                <button onClick={() => {
                  setEditingMessageId(null);
                }} data-id={msg.id.toString()} className="cancel-edit-btn text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-interface)] bg-[var(--color-button-secondary)] hover:bg-[var(--color-button-secondary-accent)] px-5 py-2.5 rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95 border border-[var(--color-border)]">
                  {t('common.cancel')}
                </button>
                <button onClick={() => {
                  const textarea = document.querySelector(`textarea[data-id="${msg.id}"]`) as HTMLTextAreaElement;
                  if (textarea) {
                    const newContent = textarea.value;
                    dispatch(messagesActions.updateOne({
                      id: msg.id,
                      changes: { thoughtSignature: msg.thoughtSignature, content: newContent }
                    }));
                    setEditingMessageId(null);
                  }
                }} data-id={msg.id.toString()} className="save-edit-btn text-sm text-[var(--color-text-accent)] bg-[var(--color-button-primary)] hover:bg-[var(--color-button-primary-accent)] px-6 py-2.5 rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg">
                  {t('common.save')}
                </button>
              </div>
            </div>
          </div>
        );
      }

      if (msg.type === 'STICKER' && msg.sticker) {
        const stickerData = msg.sticker;
        const isExpanded = expandedStickers.has(msg.id.toString());
        const sizeClass = isExpanded ? 'max-w-64' : 'max-w-48';

        const imgSrc = stickerData.data;
        const stickerName = stickerData.name || t('main.message.sticker.defaultName');

        return (
          <div className="space-x-1 inline-block cursor-pointer transition-all duration-300" onClick={() => toggleStickerSize(msg.id.toString())}>
            <img src={imgSrc} alt={stickerName} className={`${sizeClass} rounded-2xl object-contain transition-all duration-500`} />
          </div>
        );
      } else if ((msg.type === 'IMAGE' || msg.type === 'AUDIO' || msg.type === 'VIDEO' || msg.type === 'FILE') && msg.file?.dataUrl) {
        const isRegenerating = regeneratingImageIds.has(msg.id.toString());
        return (
          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}>
            <div
              onClick={() => {
                if (!(msg.type === 'IMAGE' && msg.file?.dataUrl) || isRegenerating) return;
                // Mobile(coarse pointer): single tap shows controls, double-tap opens modal
                if (isCoarsePointer) {
                  // First tap: show controls; second tap on same image: open modal
                  if (activeMessageId !== msg.id.toString()) {
                    showControlsWithAutoHide(msg.id.toString());
                    return;
                  }
                  setSelectedImageUrl(msg.file.dataUrl);
                  setImageModalOpen(true);
                  setActiveMessageId(null);
                  return;
                }
                // Desktop: open modal on single click
                setSelectedImageUrl(msg.file.dataUrl);
                setImageModalOpen(true);
              }}
              className={`relative ${msg.type === 'IMAGE' && !isRegenerating ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
            >
              {renderFile(msg.file, false, t)}
              {isRegenerating && (
                <div className="absolute inset-0 bg-[var(--color-bg-shadow)]/50 flex items-center justify-center rounded-lg">
                  <div className="flex flex-col items-center text-[var(--color-text-accent)]">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <span className="text-sm font-medium">{t('main.message.actions.imageRerolling')}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      } else if (msg.type === 'TEXT') {
        const urls = extractUrls(msg.content || '');
        const hasUrls = urls.length > 0;
        return (
          <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-2`}>
            <div className={`px-4 py-3 rounded-2xl text-base leading-relaxed max-w-md transition-transform duration-200 ${isMe
              ? 'bg-[var(--color-message-self)] text-[var(--color-text-accent)]'
              : 'bg-[var(--color-message-other)] text-[var(--color-text-primary)]'
              } ${cornerClass}`}>
              <div className="break-words">{renderTextWithLinks(msg.content || '', isMe)}</div>
            </div>
            {hasUrls && <UrlPreview url={urls[0]} />}
          </div>
        );
      }
    };

    const lastUserMessage = [...messages].reverse().find(m => m.authorId === currentUserId);
    const showUnread = isMe && lastUserMessage && msg.id === lastUserMessage.id && isWaitingForResponse && !typingCharacterId;

    const showSenderName = !isMe && isGroupStart;
    const showAvatar = !isMe && isGroupEnd;
    const senderCharacter = !isMe ? allCharacters.find(c => c.id === msg.authorId) : null;


    return (
      <div className="px-6 py-0.5">
        {showDateSeparator && (
          <div className="flex justify-center my-6">
            <div className="flex items-center text-sm text-[var(--color-icon-tertiary)] bg-[var(--color-bg-input-primary)] px-4 py-2 rounded-full transition-all duration-300 hover:bg-[var(--color-bg-secondary-accent)] hover:scale-105">
              <Calendar className="w-4 h-4 mr-2 text-[var(--color-icon-secondary)]" />
              {formatDateSeparator(new Date(msg.createdAt), i18n.resolvedLanguage)}
            </div>
          </div>
        )}
        {msg.type === 'SYSTEM' && (
          <div className="flex justify-center my-4">
            <div className="flex flex-col items-center text-sm text-[var(--color-icon-tertiary)] bg-[var(--color-button-secondary)] px-4 py-2 rounded-full animate-fadeIn">
              {msg.content}
              {msg.leaveCharId && (
                <span
                  className=" text-[var(--color-text-informative-secondary)] underline items-center"
                  onClick={() => inviteCharacter(
                    msg.leaveCharId ?? null,
                    room,
                    allCharacters.find(c => c.id === msg.leaveCharId)?.name || t('common.unknown'),
                    dispatch,
                    t
                  )}
                >
                  {t('main.message.system.inviteCta')}
                </span>
              )}
            </div>
          </div>
        )}
        {msg.type !== 'SYSTEM' && (
          <div className={`group flex w-full ${bubbleMarginClass} ${needsAnimation ? 'animate-slideUp' : ''} ${isMe ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex items-end ${isMe ? 'flex-row-reverse' : ''} gap-3 md:gap-4 ${editingMessageId === msg.id ? 'flex-1 w-full max-w-none' : 'max-w-full'}`}>

              {/* Avatar - for non-me messages at end of group (bottom aligned); placeholder otherwise for consistent indent */}
              {!isMe && editingMessageId !== msg.id && (
                showAvatar && senderCharacter ? (
                  <div className="shrink-0 w-10 h-10">
                    <Avatar char={senderCharacter} size="sm" />
                  </div>
                ) : (
                  <div className="shrink-0 w-10 h-10"></div>
                )
              )}

              {/* Message Content */}
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${editingMessageId === msg.id ? 'flex-1 w-full' : ''}`}>
                {/* Sender name for group messages */}
                {showSenderName && !isMe && (
                  <p className="text-sm text-[var(--color-icon-tertiary)] mb-1 px-1 animate-fadeIn">
                    <SenderName authorId={msg.authorId} />
                  </p>
                )}

                {/* Message bubble with hover controls */}
                <div
                  data-message-id={msg.id.toString()}
                  className={`relative group/message ${isMe ? 'flex-row-reverse' : ''} flex items-end gap-2 ${editingMessageId === msg.id ? 'w-full' : ''} transition-transform duration-200 ${isMe ? 'origin-bottom-right' : 'origin-bottom-left'} ${(msg.type !== 'IMAGE' && editingMessageId !== msg.id) ? 'md:hover:scale-[1.02]' : ''}`}
                >
                  <div
                    className={`message-content-wrapper ${editingMessageId === msg.id ? 'flex-1 w-full' : ''}`}
                    onClick={isCoarsePointer && msg.type !== 'IMAGE' ? () => showControlsWithAutoHide(msg.id.toString()) : undefined}
                  >
                    {renderMessageContent()}
                  </div>

                  {/* Message controls - inline (wrap with message to keep hover) */}
                  {/* min-w-17 <- This is necessary to ensure that at least 2 Message control buttons exist on each line. (8*2) */}
                  {editingMessageId !== msg.id && (
                    <div
                      className={`flex flex-wrap ${msg.type == 'TEXT' ? 'min-w-17' : ''} items-end gap-1 self-end transition-all duration-500
                        ${isCoarsePointer
                          ? (activeMessageId === msg.id.toString() ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')
                          : 'opacity-0 pointer-events-none group-hover/message:opacity-100 group-hover/message:pointer-events-auto'
                        }
                      `}
                    >
                      {msg.type === 'TEXT' && (
                        <button
                          data-id={msg.id.toString()}
                          onClick={() => { setEditingMessageId(msg.id) }}
                          className="edit-msg-btn p-2 text-[var(--color-icon-secondary)] hover:text-[var(--color-icon-primary)] bg-[var(--color-bg-main)] rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:scale-110 transform"
                          aria-label={t('main.message.actions.editAriaLabel')}
                          title={t('main.message.actions.edit')}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        data-id={msg.id.toString()}
                        onClick={() => { dispatch(messagesActions.removeOne(msg)); setActiveMessageId(null); }}
                        className="delete-msg-btn p-2 text-[var(--color-icon-secondary)] hover:text-[var(--color-button-negative)] bg-[var(--color-bg-main)] rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:scale-110 transform"
                        aria-label={t('main.message.actions.deleteAriaLabel')}
                        title={t('main.message.actions.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {!isMe && i === messages.length - 1 && !isWaitingForResponse && (
                        <>
                          <button
                            data-id={msg.id.toString()}
                            onClick={() => {
                              console.log('Reroll message', msg.id)
                              dispatch(messagesActions.removeMany(messages.slice(groupInfo.startIndex, groupInfo.endIndex + 1).map(m => m.id)))
                              setIsWaitingForResponse(true);
                              SendMessage(room, setTypingCharacterId, t)
                                .finally(() => {
                                  setIsWaitingForResponse(false);
                                });
                              setActiveMessageId(null);
                            }}
                            className="reroll-msg-btn p-2 text-[var(--color-icon-secondary)] hover:text-[var(--color-button-primary)] bg-[var(--color-bg-main)] rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:scale-110 transform hover:rotate-180"
                            aria-label={t('main.message.actions.rerollAriaLabel')}
                            title={t('main.message.actions.reroll')}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            data-id={msg.id.toString()}
                            onClick={() => {
                              console.log('Continue response', msg.id)
                              setIsWaitingForResponse(true);
                              SendMessage(room, setTypingCharacterId, t, 'continuation')
                                .finally(() => {
                                  setIsWaitingForResponse(false);
                                });
                              setActiveMessageId(null);
                            }}
                            className="continue-msg-btn p-2 text-[var(--color-icon-secondary)] hover:text-[var(--color-button-primary)] bg-[var(--color-bg-main)] rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:scale-110 transform hover:translate-x-1"
                            aria-label={t('main.message.actions.continueAriaLabel')}
                            title={t('main.message.actions.continue')}
                          >
                            <StepForward className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {!isMe && msg.type === 'IMAGE' && msg.imageGenerationSetting && (
                        <>
                          {/* isIncludingChar 토글 버튼 */}
                          <button
                            data-id={msg.id.toString()}
                            onClick={() => {
                              if (!msg.imageGenerationSetting) return;
                              dispatch(messagesActions.updateOne({
                                id: msg.id,
                                changes: {
                                  imageGenerationSetting: {
                                    ...msg.imageGenerationSetting,
                                    isIncludingChar: !msg.imageGenerationSetting.isIncludingChar,
                                  },
                                },
                              }));
                            }}
                            disabled={regeneratingImageIds.has(msg.id.toString())}
                            className={`toggle-include-char-btn p-2 bg-[var(--color-bg-main)] rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:scale-110 transform ${regeneratingImageIds.has(msg.id.toString())
                              ? 'opacity-60 cursor-not-allowed text-[var(--color-icon-tertiary)]'
                              : (msg.imageGenerationSetting.isIncludingChar
                                ? 'text-[var(--color-button-primary)] hover:text-[var(--color-button-primary-accent)]'
                                : 'text-[var(--color-icon-secondary)] hover:text-[var(--color-button-primary)]')
                              }`}
                            aria-label={t('main.message.actions.toggleIncludeCharAriaLabel')}
                            title={msg.imageGenerationSetting.isIncludingChar
                              ? t('main.message.actions.includeCharOn')
                              : t('main.message.actions.includeCharOff')}
                          >
                            {msg.imageGenerationSetting.isIncludingChar ? (
                              <UserCheck className="w-4 h-4" />
                            ) : (
                              <UserX className="w-4 h-4" />
                            )}
                          </button>

                          {/* 이미지 재생성 버튼 */}
                          <button
                            data-id={msg.id.toString()}
                            onClick={async () => {
                              const char = allCharacters.find(c => c.id === msg.authorId);
                              if (!char) return;

                              const messageId = msg.id.toString();
                              setRegeneratingImageIds(prev => new Set([...prev, messageId]));

                              try {
                                const imageResponse = await callImageGeneration(msg.imageGenerationSetting!, char);
                                const inlineDataBody = imageResponse.candidates[0].content.parts[0].inlineData;
                                if (inlineDataBody) {
                                  const newDataUrl = `data:${inlineDataBody.mimeType};base64,${inlineDataBody.data}`;
                                  dispatch(messagesActions.updateOne({
                                    id: msg.id,
                                    changes: {
                                      file: {
                                        ...msg.file,
                                        dataUrl: newDataUrl,
                                        mimeType: inlineDataBody.mimeType
                                      },
                                      thoughtSignature: imageResponse.candidates[0].content.parts[0].thoughtSignature
                                    }
                                  }));
                                }
                              } catch (error) {
                                console.error('Image reroll failed:', error);
                              } finally {
                                setRegeneratingImageIds(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(messageId);
                                  return newSet;
                                });
                              }
                            }}
                            disabled={regeneratingImageIds.has(msg.id.toString())}
                            className={`reroll-image-btn p-2 bg-[var(--color-bg-main)] rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:scale-110 transform hover:rotate-180 ${regeneratingImageIds.has(msg.id.toString())
                              ? 'opacity-60 cursor-not-allowed text-[var(--color-icon-tertiary)]'
                              : 'text-[var(--color-icon-secondary)] hover:text-[var(--color-button-primary)]'
                              }`}
                            aria-label={t('main.message.actions.imageRerollAriaLabel')}
                            title={regeneratingImageIds.has(msg.id.toString()) ? t('main.message.actions.imageRerolling') : t('main.message.actions.imageReroll')}
                          >
                            {regeneratingImageIds.has(msg.id.toString()) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCwSquare className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Timestamp and read status */}
                {(i === groupInfo.endIndex || (i < messages.length - 1 && messages[i + 1].authorId !== msg.authorId)) && (
                  <div className={`flex items-center mt-1 md:mt-2 ${isMe ? 'flex-row-reverse' : ''} gap-2 animate-fadeIn`}>
                    <p className="text-sm text-[var(--color-text-informative-secondary)]">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {showUnread && (
                      <span className="text-sm text-[var(--color-button-primary)] animate-pulse">{t('main.message.sent')}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const Footer = () => {
    if (!typingCharacterId) return null;
    return (
      <div className="flex items-end space-x-2 mt-2 md:mt-3 mb-4 animate-slideUp px-6">
        <div className="shrink-0 w-10 h-10">
          {(() => {
            const typingChar = allCharacters.find(c => c.id === typingCharacterId);
            return typingChar ? <Avatar char={typingChar} size="sm" /> : null;
          })()}
        </div>
        <div className="px-4 py-4 rounded-2xl bg-[var(--color-message-other)] rounded-bl-md min-h-[3rem]">
          <div className="flex items-center justify-center gap-2 h-full">
            <span className="w-2.5 h-2.5 bg-[var(--color-text-informative-secondary)] rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '1.4s' }}></span>
            <span className="w-2.5 h-2.5 bg-[var(--color-text-informative-secondary)] rounded-full animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '1.4s' }}></span>
            <span className="w-2.5 h-2.5 bg-[var(--color-text-informative-secondary)] rounded-full animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '1.4s' }}></span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Virtuoso
        ref={ref}
        data={messages}
        itemContent={itemContent}
        components={{ Footer }}
        followOutput="auto"
        alignToBottom
      />

      {/* Image Modal */}
      {imageModalOpen && selectedImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg-shadow)]/80 animate-fadeIn"
          onClick={() => setImageModalOpen(false)}
        >
          <div className="flex items-center justify-center">
            <div
              className="relative inline-block"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImageUrl}
                alt={t('main.message.imageModal.alt')}
                className="block max-w-[90vw] max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl animate-scaleIn"
              />
              <button
                onClick={() => setImageModalOpen(false)}
                className="absolute top-2 right-2 p-2 bg-[var(--color-bg-shadow)]/60 text-[var(--color-text-accent)] rounded-full hover:bg-[var(--color-bg-shadow)]/70 transition-all duration-200"
                aria-label={t('main.message.imageModal.closeAria')}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
});

export default MessageList;