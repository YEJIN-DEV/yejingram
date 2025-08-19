import React, { useRef, useEffect, useCallback, useState, useLayoutEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../app/store';
import { charactersAdapter } from '../../entities/character/slice';
import type { Message as MessageType } from '../../entities/message/types';
// Lucide Icons
import { Calendar, Edit3, Trash2, RefreshCw } from 'lucide-react';
import { messagesActions } from '../../entities/message/slice';

import SenderName from './SenderName';
import { Avatar } from '../../utils/Avatar';
import { SendMessage } from '../../services/LLMcaller';
import type { Room } from '../../entities/room/types';

// Helper function for date formatting
const formatDateSeparator = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  return date.toLocaleDateString(undefined, options);
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
  scrollRef: React.RefObject<HTMLDivElement | null>;

  setTypingCharacterId: React.Dispatch<React.SetStateAction<number | null>>;
  setIsWaitingForResponse: React.Dispatch<React.SetStateAction<boolean>>;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  room,
  isWaitingForResponse,
  typingCharacterId,
  currentUserId,
  scrollRef,

  setTypingCharacterId,
  setIsWaitingForResponse
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const allCharacters = useSelector((state: RootState) => charactersAdapter.getSelectors().selectAll(state.characters));
  const animatedMessageIds = useRef(new Set<string>());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [expandedStickers, setExpandedStickers] = useState<Set<string>>(new Set());
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

  const BOTTOM_THRESHOLD = 120; // ✅ 여유 넉넉히

  // 새 메시지가 추가되면 (길이 변화) 바닥이면 내려가기
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD;

    // DOM 레이아웃 확정 후 스크롤 (깜빡임/계산오차 방지)
    requestAnimationFrame(() => {
      if (!el) return;
      if (isNearBottom) {
        const delta = el.scrollHeight - el.scrollTop - el.clientHeight;
        el.scrollTo({
          top: el.scrollHeight,
          behavior: delta < 500 ? 'smooth' : 'auto', // 작은 이동은 부드럽게
        });
      }
    });
  }, [messages.length]); // ✅ 객체 전체 말고 길이만

  // 컨테이너 높이가 '늦게' 변하는 경우(이미지 로드 등)에도 바닥 유지
  useEffect(() => {
    const scroller = scrollRef.current;
    const inner = innerRef.current;
    if (!scroller || !inner) return;

    const BOTTOM_THRESHOLD = 120;
    const isNearBottom = () =>
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= BOTTOM_THRESHOLD;

    const ro = new ResizeObserver(() => {
      if (isNearBottom()) {
        scroller.scrollTop = scroller.scrollHeight;
      }
    });

    ro.observe(inner);
    return () => ro.disconnect();
  }, []);


  return (
    <>
      <div ref={innerRef} data-list-inner className="space-y-4">
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

          const hasAnimated = animatedMessageIds.current.has(msg.id.toString());
          const needsAnimation = !hasAnimated;
          if (needsAnimation) {
            animatedMessageIds.current.add(msg.id.toString());
          }

          // Placeholder for message content rendering
          const renderMessageContent = () => {
            if (editingMessageId === msg.id) { // Use msg.id for editing
              // Editing state
              return (
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {msg.type === 'IMAGE' ? ( // Use MessageType enum
                    <>
                      {/* Assuming msg.content holds the image URL for IMAGE type */}
                      <img src={msg.content} className="max-w-xs max-h-80 rounded-lg object-cover mb-2 cursor-pointer" onClick={() => window.open(msg.content)} />
                      <textarea
                        data-id={msg.id.toString()}
                        className="edit-message-textarea w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500/50 text-sm"
                        rows={2}
                        defaultValue={msg.content} // Assuming content is also text for image caption
                      ></textarea>
                    </>
                  ) : (
                    <textarea
                      data-id={msg.id.toString()}
                      className="edit-message-textarea w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500/50 text-sm"
                      rows={3}
                      defaultValue={msg.content || ''} // Default to empty string if no content
                    ></textarea>
                  )}
                  <div className="flex items-center space-x-2 mt-2">
                    <button onClick={() => {
                      setEditingMessageId(null);
                    }} data-id={msg.id.toString()} className="cancel-edit-btn text-xs text-gray-400 hover:text-white" >취소</button>
                    <button onClick={() => {
                      const textarea = document.querySelector(`textarea[data-id="${msg.id}"]`) as HTMLTextAreaElement;
                      if (textarea) {
                        const newContent = textarea.value;
                        dispatch(messagesActions.updateOne({
                          id: msg.id,
                          changes: { content: newContent }
                        }));
                        setEditingMessageId(null);
                      }
                    }} data-id={msg.id.toString()} className="save-edit-btn text-xs text-blue-400 hover:text-blue-300">저장</button>
                  </div>
                </div>
              );
            }

            // Normal message rendering
            if (msg.type === 'STICKER' && msg.sticker) { // Use MessageType enum
              const stickerData = msg.sticker;

              const isExpanded = expandedStickers.has(msg.id);
              const sizeClass = isExpanded ? 'max-w-4xl' : 'max-w-xs';
              const heightStyle = isExpanded ? { maxHeight: '720px' } : { maxHeight: '240px' };


              const imgSrc = stickerData.data;
              const stickerName = stickerData.name || '스티커';
              const stickerElement = (
                <div className="inline-block cursor-pointer transition-all duration-300" onClick={() => toggleStickerSize(msg.id.toString())}>
                  <img src={imgSrc} alt={stickerName} className={`${sizeClass} rounded-2xl object-contain`} style={heightStyle} />
                </div>
              );


              const hasTextMessage = msg.content && msg.content.trim();

              if (hasTextMessage) {
                return (
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-2 rounded-2xl text-sm md:text-base leading-relaxed ${isMe ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'} mb-2`}>
                      <div className="break-words">{msg.content}</div>
                    </div>
                    {stickerElement}
                  </div>
                );
              } else {
                return stickerElement;
              }
            } else if (msg.type === 'IMAGE') { // Use MessageType enum
              // Assuming msg.content holds the image URL
              const imageUrl = msg.content; // Or fetch from character.media if imageId is used

              const isExpanded = expandedStickers.has(msg.id);
              const sizeClass = isExpanded ? 'max-w-4xl' : 'max-w-xs';
              const heightStyle = isExpanded ? { maxHeight: '720px' } : { maxHeight: '320px' };

              const imageTag = (
                <div className="inline-block cursor-pointer transition-all duration-300" onClick={() => toggleStickerSize(msg.id.toString())}>
                  <img src={imageUrl} className={`${sizeClass} rounded-lg object-cover`} style={heightStyle} />
                </div>
              );
              // Assuming content can also be a caption for an image
              const captionTag = msg.content && msg.content.trim() ? (
                <div className={`mt-2 px-4 py-2 rounded-2xl text-sm md:text-base leading-relaxed inline-block ${isMe ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
                  <div className="break-words">{msg.content}</div>
                </div>
              ) : null;
              return (
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {imageTag}
                  {captionTag}
                </div>
              );
            } else { // TEXT type
              return (
                <div className={`px-4 py-2 rounded-2xl text-sm md:text-base leading-relaxed ${isMe ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
                  <div className="break-words">{msg.content}</div>
                </div>
              );
            }
          };

          const lastUserMessage = [...messages].reverse().find(m => m.authorId === currentUserId);
          const showUnread = isMe && lastUserMessage && msg.id === lastUserMessage.id && isWaitingForResponse && !typingCharacterId;

          let avatarElement = null;

          const showSenderInfo = !isMe && i === groupInfo.startIndex;

          if (!isMe) {
            const senderCharacter = allCharacters.find(c => c.id === msg.authorId);
            if (senderCharacter) {
              avatarElement = showSenderInfo ? <Avatar char={senderCharacter} size="sm" /> : null;
            }
          }


          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div className="flex justify-center my-4">
                  <div className="flex items-center text-xs text-gray-300 bg-gray-800/80 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-md">
                    <Calendar className="w-3 h-3.5 mr-2 text-gray-400" />
                    {formatDateSeparator(new Date(msg.createdAt))}
                  </div>
                </div>
              )}
              <div className={`group flex w-full items-start gap-3 ${needsAnimation ? 'animate-slideUp' : ''} ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && <div className="shrink-0 w-10 h-10 mt-1">{avatarElement}</div>}
                <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {showSenderInfo && <p className="text-sm text-gray-400 mb-1"><SenderName authorId={msg.authorId} /></p>}
                  <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {showUnread && <span className="text-xs text-yellow-400 self-end mb-0.5">1</span>}
                    <div className="message-content-wrapper flex-1">
                      {renderMessageContent()}
                    </div>

                    <div className="group flex items-end gap-1">
                      <div
                        className={`flex items-end ${isMe ? 'flex-row-reverse' : ''} gap-2`}
                      >

                        <div
                          className={`flex items-center ${isMe ? 'flex-row-reverse' : ''
                            } group`}
                        >
                          {/* 버튼 컨테이너: 기본 가려짐 → hover 시 폭이 생기며 타임스탬프를 밀어냄 */}
                          <div
                            className={`
          flex items-center gap-2
          overflow-hidden
          max-w-0 opacity-0
          transition-all duration-200
          group-hover:max-w-28 group-hover:opacity-100
          ${isMe ? 'ml-2' : 'mr-2'}
        `}
                          >
                            {(msg.type === 'TEXT' || (msg.type === 'IMAGE' && msg.content)) && (
                              <button
                                data-id={msg.id.toString()}
                                onClick={() => { setEditingMessageId(msg.id) }}
                                className="edit-msg-btn text-gray-500 hover:text-white"
                                aria-label="메시지 편집"
                                title="편집"
                              >
                                <Edit3 className="w-3 h-3 pointer-events-none" />
                              </button>
                            )}

                            <button
                              data-id={msg.id.toString()}
                              onClick={() => { dispatch(messagesActions.removeOne(msg.id)) }}
                              className="delete-msg-btn text-gray-500 hover:text-white"
                              aria-label="메시지 삭제"
                              title="삭제"
                            >
                              <Trash2 className="w-3 h-3 pointer-events-none" />
                            </button>

                            {!isMe && (msg.type === 'TEXT' || msg.type === 'IMAGE') && i === messages.length - 1 && !isWaitingForResponse && (
                              <button
                                data-id={msg.id.toString()}
                                onClick={() => {
                                  console.log('Reroll message', msg.id)
                                  dispatch(messagesActions.removeMany(messages.slice(groupInfo.startIndex, groupInfo.endIndex + 1).map(m => m.id)))
                                  SendMessage(room, setTypingCharacterId).then(() => {
                                    setIsWaitingForResponse(false);
                                  });
                                }}
                                className="reroll-msg-btn text-gray-500 hover:text-white"
                                aria-label="다시 생성"
                                title="다시 생성"
                              >
                                <RefreshCw className="w-3 h-3 pointer-events-none" />
                              </button>
                            )}
                          </div>

                          {/* 타임스탬프: 버튼이 펼쳐질 때 자연스럽게 옆으로 밀림 */}
                          <p
                            className="text-xs text-gray-500 shrink-0 self-end"
                          >
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {typingCharacterId && (
          <div className="flex items-start gap-3 animate-slideUp">
            <div className="shrink-0 w-10 h-10 mt-1">
              {(() => {
                const typingChar = allCharacters.find(c => c.id === typingCharacterId);
                return typingChar ? <Avatar char={typingChar} size="sm" /> : null;
              })()}
            </div>
            <div className="px-4 py-3 rounded-2xl bg-gray-700">
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MessageList;