import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';

// ---- Types ----
type Hash = string;
type Id = string; // server-side we normalize ids to string

type Collection<T> = { byId: Record<Id, T>; deleted: Id[] };

type Store = {
    version: number;
    characters: Collection<any>;
    rooms: Collection<any>;
    messages: Collection<any>;
    settingsByClient: Record<string, any>;
    clients: Record<string, { lastSyncAt: string }>; // per-client metadata
};

type HashMap = Record<Id, Hash>;
type Summary = {
    characters: { hashes: HashMap; deleted: Id[] };
    rooms: { hashes: HashMap; deleted: Id[] };
    messages: { hashes: HashMap; deleted: Id[] };
    settings: { hash?: Hash };
};

type PutBody = {
    clientSummary: Summary;
    upserts?: { characters?: any[]; rooms?: any[]; messages?: any[]; settings?: any };
    deletes?: { characters?: Array<string | number>; rooms?: Array<string | number>; messages?: Array<string | number> };
};

// ---- App setup ----
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = Number(process.env.PORT) || 3001;
const DATA_DIR = path.resolve(process.cwd(), 'server', 'data');

// ---- Utilities ----
function stableStringify(obj: unknown): string {
    const seen = new WeakSet<object>();
    const stringify = (value: any): string => {
        if (value === null || typeof value !== 'object') return JSON.stringify(value);
        if (seen.has(value)) return '"[Circular]"';
        seen.add(value);
        if (Array.isArray(value)) return '[' + value.map((v) => stringify(v)).join(',') + ']';
        const keys = Object.keys(value).sort();
        return '{' + keys.map((k) => JSON.stringify(k) + ':' + stringify(value[k])).join(',') + '}';
    };
    return stringify(obj);
}

function fnv1a(str: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        // 32-bit overflow with FNV prime 16777619
        h = (h >>> 0) + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24));
    }
    return (h >>> 0).toString(16);
}

function hashObject(obj: unknown): Hash {
    return fnv1a(stableStringify(obj));
}

async function ensureDataDir(): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
}

function emptyStore(): Store {
    return {
        version: 1,
        characters: { byId: {}, deleted: [] },
        rooms: { byId: {}, deleted: [] },
        messages: { byId: {}, deleted: [] },
        settingsByClient: {},
        clients: {},
    };
}

function getStoreFile(clientId: string): string {
    return path.join(DATA_DIR, `${clientId}.json`);
}

async function readStore(clientId: string): Promise<Store> {
    const file = getStoreFile(clientId);
    try {
        const txt = await fs.readFile(file, 'utf8');
        return JSON.parse(txt) as Store;
    } catch {
        return emptyStore();
    }
}

async function writeStore(clientId: string, store: Store): Promise<void> {
    const file = getStoreFile(clientId);
    await fs.writeFile(file, JSON.stringify(store, null, 2), 'utf8');
}

function buildSummaryForStore(store: Store, clientId: string): Summary {
    const toHashes = (byId: Record<Id, any>): HashMap => {
        const hashes: HashMap = {};
        for (const [id, obj] of Object.entries(byId)) hashes[id] = hashObject(obj);
        return hashes;
    };
    const settings = store.settingsByClient?.[clientId];
    return {
        characters: { hashes: toHashes(store.characters.byId), deleted: store.characters.deleted || [] },
        rooms: { hashes: toHashes(store.rooms.byId), deleted: store.rooms.deleted || [] },
        messages: { hashes: toHashes(store.messages.byId), deleted: store.messages.deleted || [] },
        settings: settings ? { hash: hashObject(settings) } : { hash: undefined },
    };
}

function computeServerDelta(store: Store, clientSummary: Summary | undefined, clientId: string) {
    const delta = {
        upserts: { characters: [] as any[], rooms: [] as any[], messages: [] as any[], settings: undefined as any },
        deletes: { characters: [] as Id[], rooms: [] as Id[], messages: [] as Id[] },
    };

    for (const key of ['characters', 'rooms', 'messages'] as const) {
        const byId = store[key].byId;
        const clientHashes: HashMap = clientSummary?.[key]?.hashes || {};
        // send upserts where client is missing or hash differs
        for (const [id, obj] of Object.entries(byId)) {
            if (clientHashes[id] !== hashObject(obj)) delta.upserts[key].push(obj);
        }
        // send deletes the client doesn't know yet
        const clientDeleted = new Set(clientSummary?.[key]?.deleted || []);
        for (const id of store[key].deleted || []) if (!clientDeleted.has(id)) delta.deletes[key].push(id);
    }

    const serverSettings = store.settingsByClient?.[clientId];
    const clientSettingsHash = clientSummary?.settings?.hash;
    if (serverSettings) {
        const h = hashObject(serverSettings);
        if (h !== clientSettingsHash) delta.upserts.settings = serverSettings;
    }
    return delta;
}

// ---- Routes ----
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
});

app.get('/api/sync/:clientId', async (req: Request<{ clientId: string }>, res: Response) => {
    try {
        await ensureDataDir();
        const { clientId } = req.params;
        const store = await readStore(clientId);
        const summary = buildSummaryForStore(store, clientId);
        res.json({ ok: true, serverVersion: store.version, summary });
    } catch (e: any) {
        res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
});

app.put('/api/sync/:clientId', async (req: Request<{ clientId: string }, any, PutBody>, res: Response) => {
    try {
        await ensureDataDir();
        const { clientId } = req.params;
        const { clientSummary, upserts, deletes } = req.body || ({} as PutBody);

        const store = await readStore(clientId);

        // Apply upserts
        const applyUpserts = (key: 'characters' | 'rooms' | 'messages', items?: any[]) => {
            if (!Array.isArray(items)) return;
            for (const it of items) {
                const id = String(it?.id ?? '');
                if (!id) continue;
                store[key].byId[id] = it;
                const idx = (store[key].deleted || []).indexOf(id);
                if (idx >= 0) store[key].deleted.splice(idx, 1);
            }
        };
        applyUpserts('characters', upserts?.characters);
        applyUpserts('rooms', upserts?.rooms);
        applyUpserts('messages', upserts?.messages);
        if (upserts?.settings) store.settingsByClient[clientId] = upserts.settings;

        // Apply deletes (optional)
        const applyDeletes = (key: 'characters' | 'rooms' | 'messages', ids?: Array<string | number>) => {
            if (!Array.isArray(ids)) return;
            for (const rawId of ids) {
                const id = String(rawId);
                delete store[key].byId[id];
                if (!store[key].deleted.includes(id)) store[key].deleted.push(id);
            }
        };
        applyDeletes('characters', deletes?.characters);
        applyDeletes('rooms', deletes?.rooms);
        applyDeletes('messages', deletes?.messages);

        // Touch client last sync
        store.clients[clientId] = { lastSyncAt: new Date().toISOString() };

        await writeStore(clientId, store);

        const delta = computeServerDelta(store, clientSummary, clientId);
        const summary = buildSummaryForStore(store, clientId);
        res.json({ ok: true, delta, summary });
    } catch (e: any) {
        res.status(500).json({ ok: false, error: String(e?.message || e) });
    }
});

// ---- Bootstrap ----
ensureDataDir()
    .then(() => app.listen(PORT, () => console.log(`Sync server listening on http://localhost:${PORT}`)))
    .catch((e) => {
        console.error('Failed to start server', e);
        process.exit(1);
    });
