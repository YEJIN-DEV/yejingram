export interface WebSocketMessage {
    type: WebSocketMessageType;
    payload?: {
        'content': string;
    };
};

export type WebSocketMessageType = 'CHAT_REQUEST' | 'CHAT_RESPONSE' | 'ROOM_JOIN' | 'ROOM_LEAVE';
