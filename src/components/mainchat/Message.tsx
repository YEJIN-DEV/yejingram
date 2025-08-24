import React, { useRef, useEffect, useCallback, useState } from 'react';
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


  return (
    <>
      <div ref={innerRef} data-list-inner className="px-6 py-4 space-y-1">
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
              // Editing state - Instagram DM Style
              return (
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {msg.type === 'IMAGE' ? (
                    <>
                      <img src={msg.content} className="max-w-xs max-h-80 rounded-2xl object-cover mb-2 cursor-pointer" onClick={() => window.open(msg.content)} />
                      <textarea
                        data-id={msg.id.toString()}
                        className="edit-message-textarea w-full px-3 py-2 bg-gray-100 text-gray-900 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm resize-none"
                        rows={2}
                        defaultValue={msg.content}
                      ></textarea>
                    </>
                  ) : (
                    <textarea
                      data-id={msg.id.toString()}
                      className="edit-message-textarea w-full px-3 py-2 bg-gray-100 text-gray-900 rounded-2xl border border-gray-300 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-sm resize-none"
                      rows={3}
                      defaultValue={msg.content || ''}
                    ></textarea>
                  )}
                  <div className="flex items-center space-x-2 mt-2">
                    <button onClick={() => {
                      setEditingMessageId(null);
                    }} data-id={msg.id.toString()} className="cancel-edit-btn text-xs text-gray-500 hover:text-gray-700 bg-gray-100 px-3 py-1 rounded-full" >취소</button>
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
                    }} data-id={msg.id.toString()} className="save-edit-btn text-xs text-white bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded-full">저장</button>
                  </div>
                </div>
              );
            }

            // Instagram DM Style message rendering
            if (msg.type === 'STICKER' && msg.sticker) {
              const stickerData = msg.sticker;
              const isExpanded = expandedStickers.has(msg.id);
              const sizeClass = isExpanded ? 'max-w-sm' : 'max-w-32';
              const heightStyle = isExpanded ? { maxHeight: '400px' } : { maxHeight: '120px' };

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
                  <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}>
                    <div className={`px-4 py-2 rounded-2xl text-sm leading-relaxed max-w-xs ${isMe
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-gray-200 text-gray-900 rounded-bl-md'
                      }`}>
                      <div className="break-words">{msg.content}</div>
                    </div>
                    {stickerElement}
                  </div>
                );
              } else {
                return stickerElement;
              }
            } else if (msg.type === 'IMAGE' && msg.image?.dataUrl) {
              const imageUrl = msg.image?.dataUrl;
              const isExpanded = expandedStickers.has(msg.id);
              const sizeClass = isExpanded ? 'max-w-sm' : 'max-w-60';
              const heightStyle = isExpanded ? { maxHeight: '400px' } : { maxHeight: '200px' };

              const imageTag = (
                <div className="inline-block cursor-pointer transition-all duration-300" onClick={() => toggleStickerSize(msg.id.toString())}>
                  <img src={imageUrl} className={`${sizeClass} rounded-2xl object-cover`} style={heightStyle} />
                </div>
              );

              const captionTag = msg.content && msg.content.trim() ? (
                <div className={`mt-1 px-4 py-2 rounded-2xl text-sm leading-relaxed max-w-xs ${isMe
                    ? 'bg-blue-500 text-white rounded-br-md'
                    : 'bg-gray-200 text-gray-900 rounded-bl-md'
                  }`}>
                  <div className="break-words">{msg.content}</div>
                </div>
              ) : null;

              return (
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}>
                  {imageTag}
                  {captionTag}
                </div>
              );
            } else if (msg.type === 'TEXT') {
              return (
                <div className={`px-4 py-2 rounded-2xl text-sm leading-relaxed max-w-xs ${isMe
                    ? 'bg-blue-500 text-white rounded-br-md'
                    : 'bg-gray-200 text-gray-900 rounded-bl-md'
                  }`}>
                  <div className="break-words">{msg.content}</div>
                </div>
              );
            }
          };

          const lastUserMessage = [...messages].reverse().find(m => m.authorId === currentUserId);
          const showUnread = isMe && lastUserMessage && msg.id === lastUserMessage.id && isWaitingForResponse && !typingCharacterId;

          const showSenderInfo = !isMe && i === groupInfo.startIndex;
          const senderCharacter = !isMe ? allCharacters.find(c => c.id === msg.authorId) : null;


          return (
            <React.Fragment key={msg.id}>
              {showDateSeparator && (
                <div className="flex justify-center my-6">
                  <div className="flex items-center text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    <Calendar className="w-3 h-3 mr-2 text-gray-400" />
                    {formatDateSeparator(new Date(msg.createdAt))}
                  </div>
                </div>
              )}
              {msg.type === 'SYSTEM' && (
                <div className="flex justify-center my-4">
                  <div className="flex items-center text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {msg.content}
                  </div>
                </div>
              )}
              {msg.type !== 'SYSTEM' && (
                <div className={`group flex w-full mb-1 ${needsAnimation ? 'animate-slideUp' : ''} ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-end max-w-[75%] ${isMe ? 'flex-row-reverse' : ''} ${isMe ? 'space-x-reverse space-x-2' : 'space-x-2'}`}>

                    {/* Avatar - only for non-me messages at start of group */}
                    {!isMe && showSenderInfo && senderCharacter && (
                      <div className="shrink-0 w-8 h-8 mb-1">
                        <Avatar char={senderCharacter} size="sm" />
                      </div>
                    )}
                    {!isMe && !showSenderInfo && (
                      <div className="shrink-0 w-8 h-8"></div>
                    )}

                    {/* Message Content */}
                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {/* Sender name for group messages */}
                      {showSenderInfo && !isMe && (
                        <p className="text-xs text-gray-500 mb-1 px-1">
                          <SenderName authorId={msg.authorId} />
                        </p>
                      )}

                      {/* Message bubble with hover controls */}
                      <div className={`relative group/message ${isMe ? 'flex-row-reverse' : ''} flex items-end`}>
                        <div className="message-content-wrapper">
                          {renderMessageContent()}
                        </div>

                        {/* Message controls - Instagram DM style */}
                        <div className={`absolute ${isMe ? 'right-full mr-2' : 'left-full ml-2'} bottom-0 flex items-center space-x-1 opacity-0 group-hover/message:opacity-100 transition-opacity duration-200`}>
                          {(msg.type === 'TEXT' || (msg.type === 'IMAGE' && msg.content)) && (
                            <button
                              data-id={msg.id.toString()}
                              onClick={() => { setEditingMessageId(msg.id) }}
                              className="edit-msg-btn p-1 text-gray-400 hover:text-gray-600 bg-white rounded-full shadow-sm hover:shadow-md transition-all duration-200"
                              aria-label="메시지 편집"
                              title="편집"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}

                          <button
                            data-id={msg.id.toString()}
                            onClick={() => { dispatch(messagesActions.removeOne(msg.id)) }}
                            className="delete-msg-btn p-1 text-gray-400 hover:text-red-500 bg-white rounded-full shadow-sm hover:shadow-md transition-all duration-200"
                            aria-label="메시지 삭제"
                            title="삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>

                          {!isMe && (msg.type === 'TEXT' || msg.type === 'IMAGE') && i === messages.length - 1 && !isWaitingForResponse && (
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
                              className="reroll-msg-btn p-1 text-gray-400 hover:text-blue-500 bg-white rounded-full shadow-sm hover:shadow-md transition-all duration-200"
                              aria-label="다시 생성"
                              title="다시 생성"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Timestamp and read status */}
                      {(i === groupInfo.endIndex || (i < messages.length - 1 && messages[i + 1].authorId !== msg.authorId)) && (
                        <div className={`flex items-center mt-1 ${isMe ? 'flex-row-reverse' : ''} space-x-1`}>
                          <p className="text-xs text-gray-400">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {showUnread && (
                            <span className="text-xs text-blue-500">전송됨</span>
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
          <div className="flex items-end space-x-2 mb-4 animate-slideUp">
            <div className="shrink-0 w-8 h-8">
              {(() => {
                const typingChar = allCharacters.find(c => c.id === typingCharacterId);
                return typingChar ? <Avatar char={typingChar} size="sm" /> : null;
              })()}
            </div>
            <div className="px-4 py-2 rounded-2xl bg-gray-200 rounded-bl-md">
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s', animationDuration: '1.4s' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '1.4s' }}></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '1.4s' }}></span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default MessageList;