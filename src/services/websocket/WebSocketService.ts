import { type WebSocketMessage } from './type';

type MessageType = WebSocketMessage['type'];
type Listener = (msg: WebSocketMessage) => void;

class WebSocketService {
    private static instances = new Map<string, WebSocketService>();
    private socket: WebSocket | null = null;
    private listeners: Partial<Record<MessageType | 'UNKNOWN', Set<Listener>>> = {};
    private errorListeners: Set<(e: any) => void> = new Set();
    private reconnect = false;
    private url: string;

    private constructor(url: string) {
        this.url = url;
    }

    static getInstance(url: string) {
        // URL 별 인스턴스 (싱글톤이되 URL 스코프)
        if (!this.instances.has(url)) this.instances.set(url, new WebSocketService(url));
        return this.instances.get(url)!;
    }

    connect({ autoReconnect = true }: { autoReconnect?: boolean } = {}) {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;

        this.reconnect = autoReconnect;
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => console.log('WS open');
        this.socket.onmessage = (event) => {
            try {
                const message: WebSocketMessage = JSON.parse(event.data);
                const type = (message.type ?? 'UNKNOWN') as MessageType;
                this.emit(type, message);
            } catch (e) {
                this.errorListeners.forEach(fn => fn(e));
            }
        };
        this.socket.onclose = () => {
            console.log('WS closed');
            if (this.reconnect) setTimeout(() => this.connect({ autoReconnect: true }), 1000);
        };
        this.socket.onerror = (e) => {
            console.error('WS error:', e);
            this.errorListeners.forEach(fn => fn(e));
        };
    }

    async send(raw: string): Promise<void> {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(raw);
            return;
        }

        // If not connected, try to connect and wait
        if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
            this.connect({ autoReconnect: true });
        }

        // Wait for connection
        return new Promise((resolve, reject) => {
            const checkConnection = () => {
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(raw);
                    resolve();
                } else if (this.socket && this.socket.readyState === WebSocket.CLOSED) {
                    reject(new Error('WebSocket connection failed'));
                } else {
                    setTimeout(checkConnection, 100); // Check every 100ms
                }
            };
            checkConnection();
        });
    }

    addListener(type: MessageType, fn: Listener) {
        if (!this.listeners[type]) this.listeners[type] = new Set();
        this.listeners[type]!.add(fn);
        return () => this.listeners[type]!.delete(fn); // unsubscribe
    }
    onError(fn: (e: any) => void) {
        this.errorListeners.add(fn);
        return () => this.errorListeners.delete(fn);
    }
    private emit(type: MessageType, msg: WebSocketMessage) {
        this.listeners[type]?.forEach(fn => fn(msg));
    }

    disconnect() {
        this.reconnect = false;
        this.socket?.close();
        this.socket = null;
    }
}

export default WebSocketService;
