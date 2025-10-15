import { io, Socket } from "socket.io-client";
import { store } from "../app/store";
import { selectAllRooms, selectRoomById } from "../entities/room/selectors";
import { selectAllCharacters } from "../entities/character/selectors";
import { messagesActions } from "../entities/message/slice";
import { selectAllMessages } from "../entities/message/selectors";
import { nanoid } from "@reduxjs/toolkit";
import { SendMessage, SendGroupChatMessage } from "./llm/LLMcaller";
import i18n from "../i18n/i18n";

interface ChatMessage {
    room: string;
    sender: string;
    authorId: number; // for compatibility
    content: string;
    timestamp?: number;
}

interface CharacterRoomsRequest {
    requesterId?: string;     // 요청자 식별 (서버에서 채워 전달)
}

interface CharacterRoomsPayload {
    sender: string;
    // characterName -> [{ id, name }]
    roomsByCharacterName: Record<string, { id: string; name: string }[]>;
    timestamp: number;
}

interface ReplyIndicatorPayload {
    room: string;                 // roomId
    typing: boolean;              // true: 응답 중, false: 완료
    characterId?: number | null;  // 현재 응답 중인 캐릭터 ID (있을 때)
    sender: string;               // 소켓 ID
    timestamp: number;
}

let socket: Socket | null = null;
let ownId: string = "";
let joinRooms: {
    roomId: string;
    socketId: string;
}[] = [];
// 이미 소켓으로 전송한 메시지 ID를 추적하여 중복 송신 방지
const broadcastedMessageIds = new Set<string>();
const serverUrl = "ws://localhost:4000"; // 서버 URL (WebSocket 전용)

/** 서버 연결 */
export function connect() {
    if (socket && socket.connected) return null;

    socket = io(serverUrl, { transports: ["websocket"] });

    socket.on("connect", () => {
        if (!socket) return;

        console.log("✅ Socket connected:", socket.id);
        ownId = socket.id!;
        joinRoom("1-1758311125433");
        onMessage((msg) => {
            console.log(`💬 [${msg.room}] ${msg.sender}: ${msg.content}`);
        });

        // 현재 존재하는 메시지들은 전송 목록에 시드하여 초기 대량 전송 방지
        seedExistingMessages();
        // 스토어 구독을 통해 LLM이 생성한 새로운 TEXT 메시지를 소켓으로 전송
        startBroadcastNewLLMMessages();

        // 채팅 메시지 수신 시: 메시지를 해당 방에 저장하고 LLM 전송 트리거
        socket.on("chat_message", async (msg: ChatMessage) => {
            try {
                if (msg.sender === ownId) return; // 자기 자신 메시지는 무시

                const state = store.getState();
                const room = selectRoomById(state, msg.room);
                if (!room) {
                    console.warn("chat_message for unknown room:", msg.room);
                    return;
                }

                // 1) 메시지 저장
                store.dispatch(messagesActions.upsertOne({
                    id: nanoid(),
                    roomId: room.id,
                    authorId: 0, // 외부(사용자) 발화자 표기
                    createdAt: new Date().toISOString(),
                    type: "TEXT",
                    content: msg.content,
                }));

                // 2) 방 유형에 따라 LLM 전송
                const setTyping: (id: number | null) => void = (id) => {
                    if (!socket) return;

                    const payload: ReplyIndicatorPayload = {
                        room: room.id,
                        typing: id !== null,
                        characterId: id ?? null,
                        sender: ownId,
                        timestamp: Date.now(),
                    };
                    socket.emit("reply_indicator", payload);
                };
                const t = i18n.t.bind(i18n);

                if (room.type === "Group" && room.groupSettings) {
                    await SendGroupChatMessage(room, setTyping, t);
                } else {
                    await SendMessage(room, setTyping, t);
                }
            } catch (e) {
                console.error("Failed to handle incoming chat_message:", e);
            }
        });
    });

    // 요청 수신 시 현재 Redux 상태로 캐릭터별 방 목록 송신
    socket.on("request_character_rooms", (_req: CharacterRoomsRequest) => {
        try {
            const payload = buildCharacterRoomsPayload();
            sendCharacterRooms(payload);
            console.log("📤 Sent character rooms:", payload);
        } catch (e) {
            console.error("Failed to send character rooms", e);
        }
    });

    socket.on("disconnect", (reason) => {
        console.log("⚠️ Socket disconnected:", reason);
    });

    return socket;
}

/** 방 참여 (존재하지 않으면 생성된다고 가정) */
export function joinRoom(roomId: string) {
    if (!socket) throw new Error("Socket not connected");

    joinRooms.push({
        roomId,
        socketId: ownId,
    });
    socket.emit("join_room", roomId);
    console.log(`🚪 Joined room: ${roomId}`);
}

/** 메시지 전송 */
export function sendMessage(msg: ChatMessage) {
    if (!socket) throw new Error("Socket not connected");
    socket.emit("chat_message", { ...msg, timestamp: Date.now() });
}

/** 기존 메시지 ID들을 전송완료 집합에 시드 */
function seedExistingMessages() {
    const state = store.getState();
    const all = selectAllMessages(state);
    for (const m of all) {
        broadcastedMessageIds.add(m.id);
    }
}

/** LLM이 생성한 새 텍스트 메시지를 감지해 소켓으로 전송 */
function startBroadcastNewLLMMessages() {
    store.subscribe(() => {
        if (!socket) return;
        const state = store.getState();
        const all = selectAllMessages(state);
        for (const m of all) {
            if (broadcastedMessageIds.has(m.id)) continue;
            if (m.type == 'TEXT') {
                socket.emit("chat_message", {
                    room: m.roomId,
                    sender: ownId,
                    authorId: m.authorId,
                    content: m.content,
                    timestamp: Date.now(),
                } as ChatMessage);
            }
            broadcastedMessageIds.add(m.id);
        }
    });
}

/** 메시지 수신 리스너 등록 */
export function onMessage(callback: (msg: ChatMessage) => void) {
    if (!socket) throw new Error("Socket not connected");
    socket.on("chat_message", (msg) => {
        if (msg.sender !== ownId) {
            callback(msg);
        }
    });
}

/** 캐릭터별 방 목록 요청을 전체 브로드캐스트 */
export function requestCharacterRooms() {
    if (!socket) throw new Error("Socket not connected");
    const req: CharacterRoomsRequest = {};
    socket.emit("request_character_rooms", req);
}

/** Redux 상태를 읽어 캐릭터별 방 목록 Payload 생성 */
function buildCharacterRoomsPayload(): CharacterRoomsPayload {
    const state = store.getState();
    const rooms = selectAllRooms(state);
    const characters = selectAllCharacters(state);
    const nameById = new Map<number, string>(characters.map(c => [c.id, c.name]));

    const roomsByCharacterName: Record<string, { id: string; name: string }[]> = {};
    for (const r of rooms) {
        const entry = { id: r.id, name: r.name };
        for (const cid of r.memberIds ?? []) {
            const charName = nameById.get(cid) ?? `id:${cid}`;
            if (!roomsByCharacterName[charName]) roomsByCharacterName[charName] = [];
            roomsByCharacterName[charName].push(entry);
        }
    }

    return {
        sender: ownId,
        roomsByCharacterName,
        timestamp: Date.now(),
    };
}

/** 캐릭터별 방 목록 송신 */
export function sendCharacterRooms(payload?: CharacterRoomsPayload) {
    if (!socket) throw new Error("Socket not connected");
    const data: CharacterRoomsPayload = payload && "roomsByCharacterName" in payload
        ? (payload as CharacterRoomsPayload)
        : buildCharacterRoomsPayload();
    socket.emit("character_rooms", data);
}

/** 연결 종료 */
export function disconnect() {
    if (!socket) return;
    socket.disconnect();
    socket = null;
    console.log("🔌 Socket manually disconnected.");
}
