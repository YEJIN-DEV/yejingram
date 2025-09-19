import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../app/store';
import { charactersAdapter } from '../../entities/character/slice';
import type { Message as MessageType } from '../../entities/message/types';
import { Calendar, Edit3, Trash2, RefreshCw, RotateCwSquare, Loader2 } from 'lucide-react';
import { messagesActions } from '../../entities/message/slice';

import SenderName from './SenderName';
import { Avatar } from '../../utils/Avatar';
import { SendMessage } from '../../services/llm/LLMcaller';
import type { Room } from '../../entities/room/types';
import { inviteCharacter } from '../../utils/inviteCharacter';
import { UrlPreview } from './chatcontents/UrlPreviewProps';
import { renderFile } from './FilePreview';
import { callImageGeneration } from '../../services/image/ImageCaller';

// Helper function for date formatting
const formatDateSeparator = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString(undefined, options);
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
          className={`underline hover:opacity-80 ${isMe ? 'text-blue-200 hover:text-blue-100' : 'text-blue-600 hover:text-blue-800'
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

const MessageList: React.FC<MessageListProps> = ({
  messages,
  room,
  isWaitingForResponse,
  typingCharacterId,
  currentUserId,

  setTypingCharacterId,
  setIsWaitingForResponse
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const allCharacters = useSelector((state: RootState) => charactersAdapter.getSelectors().selectAll(state.characters));
  const animatedMessageIds = useRef(new Set<string>());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [expandedStickers, setExpandedStickers] = useState<Set<string>>(new Set());
  const [imageModalOpen, setImageModalOpen] = useState<boolean>(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');
  const [regeneratingImageIds, setRegeneratingImageIds] = useState<Set<string>>(new Set());
  const innerRef = useRef<HTMLDivElement>(null);

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


  return (
    <>
      <div ref={innerRef} data-list-inner className="px-6 py-4">
        {messages.map((msg, i) => {
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
          const bubbleMarginClass = isGroupEnd ? 'mb-2 md:mb-3' : 'mb-1';

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
              // Editing state - Enhanced Instagram DM Style
              return (
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-3`}>
                  <div className="relative w-full">
                    <textarea
                      data-id={msg.id.toString()}
                      className="edit-message-textarea w-full px-5 py-4 bg-white text-gray-900 rounded-3xl border-2 border-gray-200 focus:ring-0 focus:border-blue-400 text-base resize-none min-h-32 md:min-h-36 transition-all duration-300 shadow-lg hover:shadow-xl placeholder-gray-400"
                      rows={4}
                      defaultValue={msg.content || ''}
                      placeholder="메시지를 입력하세요..."
                      autoFocus
                    ></textarea>
                    <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                      Enter로 줄바꿈
                    </div>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <div className="text-xs text-gray-500">
                      메시지 편집 중...
                    </div>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => {
                          setEditingMessageId(null);
                        }}
                        data-id={msg.id.toString()}
                        className="cancel-edit-btn text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 px-5 py-2.5 rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95 border border-gray-200"
                      >
                        취소
                      </button>
                      <button
                        onClick={() => {
                          const textarea = document.querySelector(`textarea[data-id="${msg.id}"]`) as HTMLTextAreaElement;
                          if (textarea) {
                            const newContent = textarea.value;
                            dispatch(messagesActions.updateOne({
                              id: msg.id,
                              changes: { content: newContent }
                            }));
                            setEditingMessageId(null);
                          }
                        }}
                        data-id={msg.id.toString()}
                        className="save-edit-btn text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 px-6 py-2.5 rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // Instagram DM Style message rendering
            if (msg.type === 'STICKER' && msg.sticker) {
              const stickerData = msg.sticker;
              const isExpanded = expandedStickers.has(msg.id.toString());
              const sizeClass = isExpanded ? 'max-w-sm' : 'max-w-32';
              const heightStyle = isExpanded ? { maxHeight: '400px' } : { maxHeight: '120px' };

              const imgSrc = stickerData.data;
              const stickerName = stickerData.name || '스티커';

              return (
                <div className="inline-block cursor-pointer transition-all duration-300 hover:scale-110 transform" onClick={() => toggleStickerSize(msg.id.toString())}>
                  <img src={imgSrc} alt={stickerName} className={`${sizeClass} rounded-2xl object-contain transition-all duration-500`} style={heightStyle} />
                </div>
              );
            } else if ((msg.type === 'IMAGE' || msg.type === 'AUDIO' || msg.type === 'VIDEO' || msg.type === 'FILE') && msg.file?.dataUrl) {
              const isRegenerating = regeneratingImageIds.has(msg.id.toString());
              return (
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}>
                  <div
                    onClick={() => {
                      if (msg.type === 'IMAGE' && msg.file?.dataUrl && !isRegenerating) {
                        setSelectedImageUrl(msg.file.dataUrl);
                        setImageModalOpen(true);
                      }
                    }}
                    className={`relative ${msg.type === 'IMAGE' && !isRegenerating ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                  >
                    {renderFile(msg.file, false)}
                    {isRegenerating && (
                      <div className="absolute inset-0 bg-black opacity-50 flex items-center justify-center rounded-lg">
                        <div className="flex flex-col items-center text-white">
                          <Loader2 className="w-8 h-8 animate-spin mb-2" />
                          <span className="text-sm font-medium">이미지 재생성 중...</span>
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
                  <div className={`px-4 py-3 rounded-2xl text-base leading-relaxed max-w-md transition-all duration-200 hover:scale-[1.02] ${isMe
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-900'
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
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div className="flex justify-center my-6">
                  <div className="flex items-center text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-full transition-all duration-300 hover:bg-gray-200 hover:scale-105">
                    <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                    {formatDateSeparator(new Date(msg.createdAt))}
                  </div>
                </div>
              )}
              {msg.type === 'SYSTEM' && (
                <div className="flex justify-center my-4">
                  <div className="flex flex-col items-center text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-full animate-fadeIn">
                    {msg.content}
                    {msg.leaveCharId && (
                      <span className=" text-gray-400 underline items-center" onClick={() => inviteCharacter(msg.leaveCharId ?? null, room, allCharacters.find(c => c.id === msg.leaveCharId)?.name || 'Unknown', dispatch)}>
                        채팅방으로 초대하기
                      </span>
                    )}
                  </div>
                </div>
              )}
              {msg.type !== 'SYSTEM' && (
                <div className={`group flex w-full ${bubbleMarginClass} ${needsAnimation ? 'animate-slideUp' : ''} ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-end ${isMe ? 'flex-row-reverse' : ''} gap-3 md:gap-4 ${editingMessageId === msg.id ? 'flex-1 w-full max-w-none' : 'max-w-[75%]'}`}>

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
                        <p className="text-sm text-gray-500 mb-1 px-1 animate-fadeIn">
                          <SenderName authorId={msg.authorId} />
                        </p>
                      )}

                      {/* Message bubble with hover controls */}
                      <div className={`relative group/message ${isMe ? 'flex-row-reverse' : ''} flex items-end ${editingMessageId === msg.id ? 'w-full' : ''}`}>
                        <div className={`message-content-wrapper ${editingMessageId === msg.id ? 'flex-1 w-full' : ''}`}>
                          {renderMessageContent()}
                        </div>

                        {/* Message controls - Instagram DM style */}
                        {editingMessageId !== msg.id && (
                          <div className={`absolute ${isMe ? 'right-full mr-2' : 'left-full ml-2'} bottom-0 flex items-center space-x-1 opacity-0 group-hover/message:opacity-100 transition-all duration-300 transform ${isMe ? 'translate-x-2' : '-translate-x-2'} group-hover/message:translate-x-0`}>
                            {msg.type === 'TEXT' && (
                              <button
                                data-id={msg.id.toString()}
                                onClick={() => { setEditingMessageId(msg.id) }}
                                className="edit-msg-btn p-2 text-gray-400 hover:text-gray-600 bg-white rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:scale-110 transform"
                                aria-label="메시지 편집"
                                title="편집"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              data-id={msg.id.toString()}
                              onClick={() => { dispatch(messagesActions.removeOne(msg.id)) }}
                              className="delete-msg-btn p-2 text-gray-400 hover:text-red-500 bg-white rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:scale-110 transform"
                              aria-label="메시지 삭제"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            {!isMe && i === messages.length - 1 && !isWaitingForResponse && (
                              <button
                                data-id={msg.id.toString()}
                                onClick={() => {
                                  console.log('Reroll message', msg.id)
                                  dispatch(messagesActions.removeMany(messages.slice(groupInfo.startIndex, groupInfo.endIndex + 1).map(m => m.id)))
                                  setIsWaitingForResponse(true);
                                  SendMessage(room, setTypingCharacterId)
                                    .finally(() => {
                                      setIsWaitingForResponse(false);
                                    });
                                }}
                                className="reroll-msg-btn p-2 text-gray-400 hover:text-blue-500 bg-white rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:scale-110 transform hover:rotate-180"
                                aria-label="다시 생성"
                                title="다시 생성"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}

                            {!isMe && msg.type === 'IMAGE' && msg.imageGenerationSetting && (
                              <button
                                data-id={msg.id.toString()}
                                onClick={async () => {
                                  const char = allCharacters.find(c => c.id === msg.authorId);
                                  if (!char) return;

                                  const messageId = msg.id.toString();
                                  setRegeneratingImageIds(prev => new Set([...prev, messageId]));

                                  try {
                                    const imageResponse = await callImageGeneration(msg.imageGenerationSetting!, char);
                                    const inlineDataBody = imageResponse.candidates[0].content.parts[0].inlineData ?? imageResponse.candidates[0].content.parts[1].inlineData ?? null;
                                    if (inlineDataBody) {
                                      const newDataUrl = `data:${inlineDataBody.mimeType};base64,${inlineDataBody.data}`;
                                      dispatch(messagesActions.updateOne({
                                        id: msg.id,
                                        changes: {
                                          file: {
                                            ...msg.file,
                                            dataUrl: newDataUrl,
                                            mimeType: inlineDataBody.mimeType
                                          }
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
                                className={`reroll-image-btn p-2 bg-white rounded-full shadow-sm hover:shadow-md transition-all duration-200 hover:scale-110 transform hover:rotate-180 ${regeneratingImageIds.has(msg.id.toString())
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-gray-400 hover:text-green-500'
                                  }`}
                                aria-label="이미지 다시 생성"
                                title={regeneratingImageIds.has(msg.id.toString()) ? "이미지 재생성 중..." : "이미지 다시 생성"}
                              >
                                {regeneratingImageIds.has(msg.id.toString()) ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <RotateCwSquare className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Timestamp and read status */}
                      {(i === groupInfo.endIndex || (i < messages.length - 1 && messages[i + 1].authorId !== msg.authorId)) && (
                        <div className={`flex items-center mt-1 md:mt-2 ${isMe ? 'flex-row-reverse' : ''} gap-2 animate-fadeIn`}>
                          <p className="text-sm text-gray-400">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {showUnread && (
                            <span className="text-sm text-blue-500 animate-pulse">전송됨</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {typingCharacterId && (
          <div className="flex items-end space-x-2 mt-2 md:mt-3 mb-4 animate-slideUp">
            <div className="shrink-0 w-10 h-10">
              {(() => {
                const typingChar = allCharacters.find(c => c.id === typingCharacterId);
                return typingChar ? <Avatar char={typingChar} size="sm" /> : null;
              })()}
            </div>
            <div className="px-4 py-4 rounded-2xl bg-gray-200 rounded-bl-md min-h-[3rem]">
              <div className="flex items-center justify-center gap-2 h-full">
                <span className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '1.4s' }}></span>
                <span className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '1.4s' }}></span>
                <span className="w-2.5 h-2.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '1.4s' }}></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {imageModalOpen && selectedImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black animate-fadeIn"
          onClick={() => setImageModalOpen(false)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
            <img
              src={selectedImageUrl}
              alt="확대된 이미지"
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-scaleIn"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setImageModalOpen(false)}
              className="absolute top-4 right-4 p-2 bg-black opacity-50 text-white rounded-full hover:opacity-70 transition-all duration-200"
              aria-label="이미지 닫기"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageList;