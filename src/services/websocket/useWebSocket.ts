import { useEffect, useRef } from 'react';
import WebSocketService from './WebSocketService';
import { type WebSocketMessage } from './type';

type Cbs = {
    onChatRequest?: (m: WebSocketMessage) => void;
    onChatResponse?: (m: WebSocketMessage) => void;
    onUnknown?: (m: WebSocketMessage) => void;
    onError?: (e: any) => void;
};

export function useWebSocket(url: string, callbacks?: Cbs) {
    const svcRef = useRef<WebSocketService | null>(null);

    useEffect(() => {
        const svc = WebSocketService.getInstance(url);
        svcRef.current = svc;
        svc.connect({ autoReconnect: true });

        const unsubs: Array<() => void> = [];
        if (callbacks?.onChatRequest) unsubs.push(svc.addListener('CHAT_REQUEST', callbacks.onChatRequest));
        if (callbacks?.onChatResponse) unsubs.push(svc.addListener('CHAT_RESPONSE', callbacks.onChatResponse));
        if (callbacks?.onError) unsubs.push(svc.onError(callbacks.onError));

        return () => {
            unsubs.forEach(fn => fn());
        };
    }, [url]);

    return {
        send: async (payload: WebSocketMessage) => {
            if (svcRef.current) {
                await svcRef.current.send(JSON.stringify(payload));
            }
        },
        disconnect: () => svcRef.current?.disconnect(),
    };
}
