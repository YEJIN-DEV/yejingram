import type { Middleware } from "redux";
import type { RootState } from "../app/store";
import { backupStateToServer } from "./backup";
import { lastSavedActions } from "../entities/lastSaved/slice";

let applying = false;
export const syncMiddleware: Middleware<{}, RootState> = store => next => (action: any) => {
    if (action.type.startsWith('persist/')) {
        return next(action);
    }

    if (action.type === 'sync/applyDeltaStart') applying = true;
    else if (action.type === 'sync/applyDeltaEnd') applying = false;
    else if (action.type !== lastSavedActions.markSaved.type) {
        const state = store.getState();
        if (!applying && state.settings.syncSettings.syncEnabled) {
            backupStateToServer(state.settings.syncSettings.syncClientId, state.settings.syncSettings.syncBaseUrl);
        }
    }

    const result = next(action);
    if (
        action.type !== lastSavedActions.markSaved.type &&
        !action.type.startsWith('persist/')
    ) {
        store.dispatch(lastSavedActions.markSaved());
    }
    console.log('Dispatching action:', action);
    return result;
};