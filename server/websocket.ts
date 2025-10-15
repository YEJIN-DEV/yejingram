// server.ts
import { createServer } from "http";
import { Server, Socket } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
    },
    transports: ["websocket"],
});

// ✅ 클라이언트 연결 이벤트
io.on("connection", (socket: Socket) => {
    console.log(`🟢 Client connected: ${socket.id}`);

    // 🏠 방 참가
    socket.on("join_room", (roomId: string) => {
        socket.join(roomId);
        console.log(`🚪 ${socket.id} joined room: ${roomId}`);
    });

    // 💬 메시지 처리
    socket.on("chat_message", (msg) => {
        console.log(`💬 [${msg.room}] ${msg.sender}: ${msg.content}`);

        // 같은 방의 모든 유저에게 메시지 브로드캐스트
        io.to(msg.room).emit("chat_message", msg);
    });

    // 📥 캐릭터별 방 목록 요청 처리: 전체 브로드캐스트
    socket.on("request_character_rooms", (req: { requesterId?: string }) => {
        const payload = { ...req, requesterId: socket.id };
        io.emit("request_character_rooms", payload);
        console.log(`📣 request_character_rooms broadcast by ${socket.id}`);
    });

    // 📤 캐릭터별 방 목록 응답 브로드캐스트 (전체)
    socket.on("character_rooms", (payload: unknown) => {
        io.emit("character_rooms", payload);
        console.log(`📤 character_rooms broadcast by ${socket.id}`);
    });

    // ✍️ 응답 인디케이터 중계: 해당 room으로만 브로드캐스트
    socket.on("reply_indicator", (payload: { room: string }) => {
        if (payload?.room) {
            io.to(payload.room).emit("reply_indicator", payload);
            console.log(`✍️ reply_indicator relayed to room ${payload.room} by ${socket.id}`);
        }
    });

    // ❌ 연결 종료
    socket.on("disconnect", (reason) => {
        console.log(`🔴 Client disconnected: ${socket.id} (${reason})`);
    });
});

// 서버 실행
const PORT = 4000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Socket.IO server running on http://localhost:${PORT}`);
});
