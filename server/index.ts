import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { promises as fsp } from 'fs';

// ---- Types ----
interface PutBody {
    lastSaved: number;
    backup: unknown;
}
interface GetBody {
    backup: unknown;
}

interface ApiError extends Error {
    status?: number;
}

// ---- App setup ----
const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

const PORT = Number(process.env.PORT ?? 3001);
const DATA_DIR = path.resolve(process.cwd(), 'data');

// ---- Utils ----

// 파일명 검증 (영문/숫자/언더스코어/하이픈만 허용)
function sanitizeClientId(input: string): string {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(input)) {
        const err: ApiError = new Error('Invalid clientId format');
        err.status = 400;
        throw err;
    }
    return input;
}

function filePath(clientId: string): string {
    return path.join(DATA_DIR, `${clientId}.json`);
}

async function ensureDataDir(): Promise<void> {
    await fsp.mkdir(DATA_DIR, { recursive: true });
}

async function readSavedData(clientId: string): Promise<PutBody | null> {
    try {
        const json = await fsp.readFile(filePath(clientId), 'utf-8');
        const parsed = JSON.parse(json) as PutBody;
        if (
            typeof parsed === 'object' &&
            parsed !== null &&
            typeof parsed.lastSaved === 'number' &&
            'backup' in parsed
        ) {
            return parsed;
        }
        return null;
    } catch (err: any) {
        if (err?.code === 'ENOENT') return null; // 파일 없음
        throw err; // 그 외 I/O 에러는 상위에서 처리
    }
}

async function writeSavedData(clientId: string, payload: PutBody): Promise<void> {
    await fsp.writeFile(filePath(clientId), JSON.stringify(payload));
}

// ---- Routes ----
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
});

app.get(
    '/api/sync/:clientId',
    async (req: Request<{ clientId: string }, any, GetBody>, res: Response, next: NextFunction) => {
        try {
            const clientId = sanitizeClientId(req.params.clientId);
            const data = await readSavedData(clientId);

            if (!data) {
                return res.status(404).json({ error: 'No data found for this clientId' });
            }

            // 기존 동작 유지: backup만 반환
            return res.json(data.backup);
        } catch (err) {
            next(err);
        }
    }
);

app.put(
    '/api/sync/:clientId',
    async (req: Request<{ clientId: string }, any, PutBody>, res: Response, next: NextFunction) => {
        try {
            const clientId = sanitizeClientId(req.params.clientId);
            const { lastSaved, backup } = req.body ?? {};

            if (typeof lastSaved !== 'number' || !Number.isFinite(lastSaved) || backup === undefined) {
                return res.status(400).json({ error: 'Invalid body: require { lastSaved:number, backup:any }' });
            }

            const saved = await readSavedData(clientId);

            // 최초 저장이거나 최신이면 덮어쓰기
            if (!saved || lastSaved > saved.lastSaved) {
                await writeSavedData(clientId, { lastSaved, backup });
                return res.json({ ok: true });
            }

            // 더 오래된 데이터인 경우 충돌
            return res.status(409).json({
                error: 'Conflict: incoming data is older than saved data',
                currentlastSaved: saved.lastSaved,
            });
        } catch (err) {
            next(err);
        }
    }
);

// ---- Not found & Error handlers ----
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.use((err: ApiError, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status ?? 500;
    if (status >= 500) {
        console.error('[Server Error]', err);
    }
    res.status(status).json({ error: err.message ?? 'Internal Server Error' });
});

ensureDataDir().then(() => {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
        console.log(`Data directory: ${DATA_DIR}`);
        console.log('Press Ctrl+C to stop the server');
    });
});