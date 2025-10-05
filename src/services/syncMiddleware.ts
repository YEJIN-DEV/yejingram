import type { Middleware } from "redux";
import { type RootState } from "../app/store";
import { backupStateToServer } from "../utils/backup";
import { lastSavedActions } from "../entities/lastSaved/slice";
let applying = false;
export const syncMiddleware: Middleware<{}, RootState> = store => next => (action: any) => {
    const blacklist = ['app/resetAll', 'rooms/resetUnread'];
    const blacklistPrefixes = ['persist/', 'ui/', 'lastSaved/'];
    if (blacklist.includes(action.type) || blacklistPrefixes.some(prefix => action.type.startsWith(prefix))) {
        return next(action);
    }

    if (action.type === 'sync/applyDeltaStart' || action.type === 'messages/writingStart') applying = true;
    else if (action.type === 'sync/applyDeltaEnd' || action.type === 'messages/writingEnd') applying = false;

    if (action.type !== lastSavedActions.markSaved.type) {
        const state = store.getState();
        if (!applying && state.settings.syncSettings.syncEnabled) {
            backupStateToServer(state.settings.syncSettings.syncClientId, state.settings.syncSettings.syncBaseUrl);
        }
    }

    const result = next(action);

    store.dispatch(lastSavedActions.markSaved());
    return result;
};