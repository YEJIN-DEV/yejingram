export interface UIState {
    // 0 - 100
    syncProgress?: number;
    // 0 - 100 upload progress percent
    uploadProgress?: number;
    // Force show full-screen sync modal (e.g., manual restore)
    forceShowSyncModal?: boolean;
}
