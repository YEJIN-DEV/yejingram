const activeRoom = {
    id: null as string | null,
};

export const setActiveRoomId = (id: string | null) => {
    activeRoom.id = id;
};

export const getActiveRoomId = (): string | null => {
    return activeRoom.id;
};
