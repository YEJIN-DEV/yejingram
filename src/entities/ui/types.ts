export interface UIState {
    // Number of concurrent sync requests in flight
    syncInFlight: number;
    // Whether we can show a concrete percent
    syncDeterminate?: boolean;
    // 0 - 100
    syncProgress?: number;
    // Number of concurrent uploads in flight (request body being sent)
    uploadInFlight?: number;
    // Force show full-screen sync modal (e.g., manual restore)
    forceShowSyncModal?: boolean;
}
