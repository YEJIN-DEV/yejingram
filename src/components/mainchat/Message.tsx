import React, { useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../app/store';
import { messagesAdapter } from '../../entities/message/slice';
import { charactersAdapter } from '../../entities/character/slice';
import { roomsAdapter } from '../../entities/room/slice';
import type { Message as MessageType } from '../../entities/message/types';
import type { Character } from '../../entities/character/types';
import type { Room } from '../../entities/room/types';

// Lucide Icons
import { Calendar, Edit3, Trash2, RefreshCw, Music } from 'lucide-react';

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

interface MessageProps {
  selectedChatId: string | null;
  editingMessageId: string | null; // Assuming this is passed as a prop
  isWaitingForResponse: boolean; // Assuming this is passed as a prop
  typingCharacterId: string | null; // Assuming this is passed as a prop
  currentUserId: string; // Assuming current user ID is available to determine isMe
}

const Message: React.FC<MessageProps> = ({
  selectedChatId,
  editingMessageId,
  isWaitingForResponse,
  typingCharacterId,
  currentUserId,
}) => {
  const dispatch = useDispatch<AppDispatch>();

  const allMessages = useSelector((state: RootState) => messagesAdapter.getSelectors().selectAll(state.messages));
  const messages = selectedChatId ? allMessages.filter(msg => msg.roomId === selectedChatId) : [];

  const allCharacters = useSelector((state: RootState) => charactersAdapter.getSelectors().selectAll(state.characters));
  const allRooms = useSelector((state: RootState) => roomsAdapter.getSelectors().selectAll(state.rooms));

  const animatedMessageIds = useRef(new Set<string>());

  // Helper functions that depend on Redux state
  const getCurrentChatRoom = useCallback((): Room | undefined => {
    if (!selectedChatId) return undefined;
    return allRooms.find(room => room.id === selectedChatId);
  }, [selectedChatId, allRooms]);

  const isGroupChat = useCallback((chatId: string): boolean => {
    const room = allRooms.find(r => r.id === chatId);
    return room ? room.type === 'Group' : false; // Use 'Group' as per types.ts
  }, [allRooms]);

  const isOpenChat = useCallback((chatId: string): boolean => {
    const room = allRooms.find(r => r.id === chatId);
    return room ? room.type === 'Open' : false; // Use 'Open' as per types.ts
  }, [allRooms]);

  const renderAvatar = useCallback((character: Character | null | undefined, size: 'sm' | 'md' | 'lg') => {
    if (!character) return null;
    return (
      <img
        src={character.avatar || 'default-avatar.png'} // Use character.avatar
        alt={character.name}
        className={`rounded-full object-cover ${size === 'sm' ? 'w-8 h-8' : size === 'md' ? 'w-10 h-10' : 'w-12 h-12'}`}
      />
    );
  }, []);

  const toggleStickerSize = useCallback((messageId: string) => {
    // This should dispatch an action to update expandedStickers in Redux state
    console.log(`Toggle sticker size for message: ${messageId}`);
    // Example: dispatch(messageActions.toggleStickerExpansion(messageId));
  }, [dispatch]);

  // Effect to handle animations (simplified for now)
  useEffect(() => {
    // This effect might be more complex if actual animation triggers are needed
    // For now, just ensuring the ref is cleared or managed
  }, [messages]);


  return (
    <>
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
        const isLastInGroup = i === groupInfo.endIndex;

        const hasAnimated = animatedMessageIds.current.has(msg.id.toString());
        const needsAnimation = !hasAnimated;
        if (needsAnimation) {
          animatedMessageIds.current.add(msg.id.toString());
        }

        // Placeholder for message content rendering
        const renderMessageContent = () => {
          if (editingMessageId === msg.id.toString()) { // Use msg.id for editing
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
                    defaultValue={messages.slice(groupInfo.startIndex, groupInfo.endIndex + 1).map(m => m.content).join('\n')}
                  ></textarea>
                )}
                <div className="flex items-center space-x-2 mt-2">
                  <button data-id={msg.id.toString()} className="cancel-edit-btn text-xs text-gray-400 hover:text-white" onClick={() => console.log('Cancel edit', msg.id)}>취소</button>
                  <button data-id={msg.id.toString()} className="save-edit-btn text-xs text-blue-400 hover:text-blue-300" onClick={() => console.log('Save edit', msg.id)}>저장</button>
                </div>
              </div>
            );
          }

          // Normal message rendering
          if (msg.type === 'STICKER') { // Use MessageType enum
            // The original code had complex stickerData logic.
            // For now, I'll assume msg.content holds the sticker identifier
            // and that sticker data (like dataUrl, type) needs to be fetched from character.stickers
            let stickerData: any = null; // Placeholder for richer sticker data

            const character = allCharacters.find(c => c.id === msg.authorId); // Assuming authorId is characterId for stickers
            if (character && character.stickers) {
              stickerData = character.stickers.find((s: any) => { // Assuming s is an object with id, name, dataUrl, type
                return s.id == msg.content || s.name === msg.content || s.name.replace(/\.[^/.]+$/, "") === String(msg.content).replace(/\.[^/.]+$/, "");
              });
            }

            if (stickerData) {
              const isVideo = stickerData.type && (stickerData.type.startsWith('video/') || stickerData.type === 'video/mp4' || stickerData.type === 'video/webm');
              const isAudio = stickerData.type && stickerData.type.startsWith('audio/');

              let stickerElement;
              const isExpanded = false; // This state needs to be managed in Redux or locally
              const sizeClass = isExpanded ? 'max-w-4xl' : 'max-w-xs';
              const heightStyle = isExpanded ? { maxHeight: '720px' } : { maxHeight: '240px' };

              if (isAudio) {
                const audioSrc = stickerData.data || stickerData.dataUrl;
                const stickerName = stickerData.stickerName || stickerData.name || '오디오';
                stickerElement = (
                  <div className="bg-gray-700 p-3 rounded-2xl max-w-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center">
                        <Music className="w-6 h-6 text-gray-300" />
                      </div>
                      <div>
                        <div className="text-sm text-white font-medium">{stickerName}</div>
                        <audio controls className="mt-1 h-8">
                          <source src={audioSrc} type={stickerData.type} />
                        </audio>
                      </div>
                    </div>
                  </div>
                );
              } else if (isVideo) {
                const videoSrc = stickerData.data || stickerData.dataUrl;
                stickerElement = (
                  <div className="inline-block cursor-pointer transition-all duration-300" onClick={() => toggleStickerSize(msg.id.toString())}>
                    <video className={`${sizeClass} rounded-2xl`} style={heightStyle} controls muted loop autoPlay>
                      <source src={videoSrc} type={stickerData.type} />
                    </video>
                  </div>
                );
              } else {
                const imgSrc = stickerData.data || stickerData.dataUrl;
                const stickerName = stickerData.stickerName || stickerData.name || '스티커';
                stickerElement = (
                  <div className="inline-block cursor-pointer transition-all duration-300" onClick={() => toggleStickerSize(msg.id.toString())}>
                    <img src={imgSrc} alt={stickerName} className={`${sizeClass} rounded-2xl object-contain`} style={heightStyle} />
                  </div>
                );
              }

              // Assuming text content for sticker is in msg.content if it's not just a sticker
              const hasTextMessage = msg.content && msg.content.trim() && !msg.content.includes('[스티커:');

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
            } else {
              return (
                <div className="px-4 py-2 rounded-2xl text-sm md:text-base leading-relaxed bg-gray-700 text-gray-400 italic">
                  [삭제된 스티커: {msg.content}]
                </div>
              );
            }
          } else if (msg.type === 'IMAGE') { // Use MessageType enum
            // Assuming msg.content holds the image URL
            const imageUrl = msg.content; // Or fetch from character.media if imageId is used

            const isExpanded = false; // This state needs to be managed in Redux or locally
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
        let senderName = ''; // Initialize senderName

        const selectedChatRoom = getCurrentChatRoom();
        const isGroupOrOpenChat = isGroupChat(selectedChatId || '') || isOpenChat(selectedChatId || '');
        const showSenderInfo = !isMe && i === groupInfo.startIndex;

        if (!isMe) {
          const senderCharacter = allCharacters.find(c => c.id.toString() === msg.authorId); // Assuming authorId is characterId
          if (senderCharacter) {
            senderName = senderCharacter.name;
            avatarElement = showSenderInfo ? renderAvatar(senderCharacter, 'sm') : null;
          } else {
            // Fallback if sender is not a character (e.g., another user in a direct chat)
            senderName = msg.authorId; // Use authorId as sender name if character not found
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
                {showSenderInfo && <p className="text-sm text-gray-400 mb-1">{senderName}</p>}
                <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  {showUnread && <span className="text-xs text-yellow-400 self-end mb-0.5">1</span>}
                  <div className="message-content-wrapper">
                    {renderMessageContent()}
                  </div>
                  {isLastInGroup && <p className="text-xs text-gray-500 shrink-0 self-end">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                </div>
                {/* Action Buttons */}
                {isLastInGroup && (
                  <div className={`flex items-center gap-2 mt-1.5 h-5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isMe ? 'justify-end' : ''}`}>
                    {isMe && (msg.type === 'TEXT' || (msg.type === 'IMAGE' && msg.content)) && (
                      <button data-id={msg.id.toString()} className="edit-msg-btn text-gray-500 hover:text-white" onClick={() => console.log('Edit message', msg.id)}>
                        <Edit3 className="w-3 h-3 pointer-events-none" />
                      </button>
                    )}
                    <button data-id={msg.id.toString()} className="delete-msg-btn text-gray-500 hover:text-white" onClick={() => console.log('Delete message', msg.id)}>
                      <Trash2 className="w-3 h-3 pointer-events-none" />
                    </button>
                    {!isMe && (msg.type === 'TEXT' || msg.type === 'IMAGE') && i === messages.length - 1 && !isWaitingForResponse && (
                      <button data-id={msg.id.toString()} className="reroll-msg-btn text-gray-500 hover:text-white" onClick={() => console.log('Reroll message', msg.id)}>
                        <RefreshCw className="w-3 h-3 pointer-events-none" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </React.Fragment>
        );
      })}

      {typingCharacterId && typingCharacterId === selectedChatId && (
        <div className="flex items-start gap-3 animate-slideUp">
          <div className="shrink-0 w-10 h-10 mt-1">
            {renderAvatar(allCharacters.find(c => c.id.toString() === typingCharacterId), 'sm')}
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
    </>
  );
};

export default Message;
