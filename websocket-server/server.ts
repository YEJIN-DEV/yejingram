import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

interface WebSocketMessage {
    type: 'CHAT_REQUEST' | 'CHAT_RESPONSE' | 'ROOM_JOIN' | 'ROOM_LEAVE';
    payload?: {
        content: string;
    };
}

const wss = new WebSocketServer({ port: 8080 });

console.log('WebSocket server started on port 8080');

wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
    console.log('New client connected');

    ws.on('message', (data: Buffer) => {
        try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            console.log('Received message:', message);

            // Handle different message types
            switch (message.type) {
                case 'CHAT_REQUEST':
                    // Simulate a response
                    const response: WebSocketMessage = {
                        type: 'CHAT_RESPONSE',
                        payload: {
                            content: `Echo: ${message.payload?.content || 'No content'}`
                        }
                    };
                    ws.send(JSON.stringify(response));
                    break;
                case 'ROOM_JOIN':
                    console.log('Client joined room');
                    break;
                case 'ROOM_LEAVE':
                    console.log('Client left room');
                    break;
                default:
                    console.log('Unknown message type');
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});
