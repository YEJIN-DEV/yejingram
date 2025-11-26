import fs from 'fs/promises';
import express from 'express';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import sharp from 'sharp';
import { store } from '../../src/app/store';
import { selectAllRooms, selectRoomById } from '../../src/entities/room/selectors';
import { selectMessagesByRoomId } from '../../src/entities/message/selectors';
import type { Message } from '../../src/entities/message/types';
import { buildBackupPayload, restoreStateFromPayload } from '../../src/utils/backup';
import { SendMessage } from '../../src/services/llm/LLMcaller';
import webpush, { type PushSubscription } from 'web-push';
import 'dotenv/config';
import en from '../../src/i18n/locales/en.ts';
import ko from '../../src/i18n/locales/ko.ts';
import ja from '../../src/i18n/locales/ja.ts';
import { selectCharacterById } from '../../src/entities/character/selectors.ts';
import path from 'path';
import { selectLastSaved } from '../../src/entities/lastSaved/selectors.ts';
import type { ProactiveTimeRestriction, ProactivePeriodicSettings, ProactiveProbabilisticSettings } from '../../src/entities/setting/types.ts';

const resources = {
    ko: { translation: ko },
    en: { translation: en },
    ja: { translation: ja }
};

i18next
    .use(initReactI18next)
    .init({
        resources,
        lng: 'en',
        fallbackLng: 'en',
        interpolation: { escapeValue: false },
    });

webpush.setVapidDetails(
    'https://github.com/YEJIN-DEV/yejingram',
    process.env.push_public_key!,
    process.env.push_private_key!
);

interface SubscriptionBody extends PushSubscription {
    clientId: string;
}

const SUBSCRIPTION_DIR = path.resolve(process.cwd(), 'data');
async function readSubscriptions(clientId?: string): Promise<PushSubscription | { [key: string]: PushSubscription }> {
    try {
        await fs.mkdir(SUBSCRIPTION_DIR, { recursive: true });
    } catch { }

    if (clientId) {
        const filePath = path.join(SUBSCRIPTION_DIR, `${clientId}.json`);
        const json = await fs.readFile(filePath, 'utf-8');
        const parsed: PushSubscription = JSON.parse(json);
        return parsed;
    } else {
        const entries = await fs.readdir(SUBSCRIPTION_DIR, { withFileTypes: true });
        const subs: { [key: string]: PushSubscription } = {};

        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
            try {
                const json = await fs.readFile(path.join(SUBSCRIPTION_DIR, entry.name), 'utf-8');
                subs[entry.name.replace('.json', '')] = JSON.parse(json);
            } catch {
                // 개별 파일 오류는 무시하고 나머지 파일만 사용
                continue;
            }
        }
        return subs;
    }
}

export async function saveSubscription(subscription: SubscriptionBody): Promise<void> {
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth || !subscription.clientId) {
        throw new Error('Invalid subscription object');
    }

    const { clientId, ...pure } = subscription;
    const filePath = path.join(SUBSCRIPTION_DIR, `${clientId}.json`);
    await fs.mkdir(SUBSCRIPTION_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(pure, null, 2));
}

function startSubscriptionApi(port: number = Number(process.env.HEADLESS_PORT ?? 4001)) {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(204);
        }
        next();
    });

    app.post('/api/push/subscription', async (req, res) => {
        try {
            await saveSubscription(req.body as SubscriptionBody);
            res.json({ ok: true });
        } catch (err: any) {
            console.error('[Subscription API Error]', err);
            res.status(400).json({ error: err?.message ?? 'Invalid subscription' });
        }
    });

    app.post('/api/push/unsubscribe', async (req, res) => {
        try {
            const clientId = req.body?.clientId;
            if (!clientId) {
                return res.status(400).json({ error: 'clientId is required' });
            }
            const filePath = path.join(SUBSCRIPTION_DIR, `${clientId}.json`);
            if (!(await fs.stat(filePath).catch(() => false))) {
                return res.status(404).json({ error: 'Subscription not found' });
            } else {
                await fs.unlink(filePath);
            }
            res.json({ ok: true });
        } catch (err: any) {
            console.error('[Unsubscription API Error]', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.get('/api/push/icon/:authorId', async (req, res) => {
        try {
            const authorId = Number(req.params.authorId);
            if (Number.isNaN(authorId)) {
                return res.status(400).json({ error: 'Invalid authorId' });
            }

            const state = store.getState();
            const character = selectCharacterById(state, authorId as number);

            if (!character) {
                return res.status(404).json({ error: 'Character not found' });
            }

            const avatar = character.avatar;

            if (!avatar) {
                return res.status(404).json({ error: 'Avatar not found' });
            }

            const base64Data = avatar.includes(',') ? avatar.split(',')[1] : avatar;
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const resizedPng = await sharp(imageBuffer)
                .resize(192, 192, { fit: 'cover' })
                .png()
                .toBuffer();

            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.end(resizedPng);
        } catch (err: any) {
            console.error('[Icon API Error]', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.listen(port, () => {
        console.log(`[headless] Subscription API server (express) listening on port ${port}`);
    });
}

function printMessages(messages: Message[]) {
    for (const m of messages) {
        const baseInfo = `- [${m.type}] authorId=${m.authorId} at ${m.createdAt}`;
        if (m.type === 'TEXT') {
            console.log(baseInfo + `\n  ${m.content ?? ''}`);
        } else if (m.type === 'STICKER') {
            console.log(baseInfo + `\n  [Sticker] ${m.sticker?.name ?? m.sticker?.id ?? 'unknown'}`);
        } else if (m.type === 'IMAGE') {
            console.log(baseInfo + `\n  [Image] ${m.file?.name ?? m.file?.mimeType ?? 'image'}`);
        } else {
            console.log(baseInfo);
        }
    }
}

/**
 * 현재 시간이 제한 시간대에 해당하는지 확인
 * 제한 시간대라면 true 반환 (선톡 불가)
 */
function isInRestrictedTime(timeRestriction: ProactiveTimeRestriction): boolean {
    if (!timeRestriction.enabled) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeRestriction.startHour * 60 + timeRestriction.startMinute;
    const endMinutes = timeRestriction.endHour * 60 + timeRestriction.endMinute;

    // 시작 시간이 종료 시간보다 클 경우 (예: 23:00 ~ 07:00 = 밤 시간대)
    if (startMinutes > endMinutes) {
        // 자정을 넘기는 경우
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
        // 자정을 넘기지 않는 경우 (예: 13:00 ~ 15:00)
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
}

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
function getTodayDateString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// 클라이언트별 확률적 선톡 카운트 관리 (서버 메모리)
interface ProbabilisticTriggerState {
    date: string;
    count: number;
}
const probabilisticTriggerCounts: Map<string, ProbabilisticTriggerState> = new Map();

/**
 * 확률적 선톡을 트리거할지 결정
 * 하루에 최대 N번까지 트리거되며, 설정된 확률에 따라 결정
 * 카운트는 서버 측에서 관리
 */
function shouldTriggerProbabilistic(clientId: string, settings: ProactiveProbabilisticSettings): boolean {
    if (!settings.enabled) {
        return false;
    }

    const today = getTodayDateString();
    let triggerState = probabilisticTriggerCounts.get(clientId);

    // 날짜가 바뀌었거나 처음이면 리셋
    if (!triggerState || triggerState.date !== today) {
        triggerState = { date: today, count: 0 };
        probabilisticTriggerCounts.set(clientId, triggerState);
    }

    // 오늘 최대 횟수에 도달했다면 더 이상 트리거하지 않음
    const maxTriggers = settings.maxTriggersPerDay ?? 1;
    if (triggerState.count >= maxTriggers) {
        console.log(`[${clientId}] 확률적 선톡: 오늘 최대 횟수(${maxTriggers})에 도달함 (현재: ${triggerState.count})`);
        return false;
    }

    // 확률 계산 (0-100 사이의 값)
    const roll = Math.random() * 100;
    const shouldTrigger = roll < settings.probability;

    console.log(`[${clientId}] 확률적 선톡 주사위: ${roll.toFixed(2)} vs ${settings.probability}% (오늘 ${triggerState.count}/${maxTriggers}회)`);

    if (shouldTrigger) {
        triggerState.count++;
        probabilisticTriggerCounts.set(clientId, triggerState);
        return true;
    }

    return false;
}

// 클라이언트별 마지막 주기적 선톡 시간 기록
const lastPeriodicTriggerTime: Map<string, number> = new Map();

/**
 * 주기적 선톡을 트리거할지 결정
 */
function shouldTriggerPeriodic(clientId: string, settings: ProactivePeriodicSettings): boolean {
    if (!settings.enabled) return false;

    const now = Date.now();
    const lastTrigger = lastPeriodicTriggerTime.get(clientId) ?? 0;
    const intervalMs = settings.intervalMinutes * 60 * 1000;

    if (now - lastTrigger >= intervalMs) {
        lastPeriodicTriggerTime.set(clientId, now);
        return true;
    }

    return false;
}

(async () => {
    startSubscriptionApi();

    while (true) {
        const subscription = await readSubscriptions();

        for (const [clientId, push] of Object.entries(subscription)) {
            console.log("백업 복원 시작");

            const backupResponse = await fetch(`${process.env.SYNC_BASE_URL}/api/sync/${clientId}`, {
                method: 'GET',
            });

            if (!backupResponse.ok) {
                console.error("백업 데이터 불러오기 실패:", backupResponse.statusText);
                continue;
            }

            const backupPayload = await backupResponse.json();
            await restoreStateFromPayload(backupPayload);
            console.log(`백업 로드 완료`);
            const state = store.getState();
            const proactiveSettings = state.settings.proactiveSettings;

            if (!proactiveSettings.proactiveChatEnabled) {
                console.log("Proactive Chat 기능이 설정에서 활성화되어 있지 않습니다.");
                continue;
            }

            // 제한 시간대 체크
            if (proactiveSettings.timeRestriction && isInRestrictedTime(proactiveSettings.timeRestriction)) {
                console.log(`[${clientId}] 현재 제한 시간대입니다. 선톡을 건너뜁니다.`);
                continue;
            }

            // 주기적 선톡 또는 확률적 선톡 중 하나라도 트리거 조건을 만족해야 함
            let shouldSendProactive = false;

            // 주기적 선톡 체크
            if (proactiveSettings.periodicSettings?.enabled) {
                if (shouldTriggerPeriodic(clientId, proactiveSettings.periodicSettings)) {
                    console.log(`[${clientId}] 주기적 선톡 트리거됨`);
                    shouldSendProactive = true;
                }
            }

            // 확률적 선톡 체크 (하루 N번)
            if (proactiveSettings.probabilisticSettings?.enabled && !shouldSendProactive) {
                if (shouldTriggerProbabilistic(clientId, proactiveSettings.probabilisticSettings)) {
                    console.log(`[${clientId}] 확률적 선톡 트리거됨 (확률: ${proactiveSettings.probabilisticSettings.probability}%)`);
                    shouldSendProactive = true;
                }
            }

            // 둘 다 비활성화되어 있으면 기본적으로 선톡 실행
            if (!proactiveSettings.periodicSettings?.enabled && !proactiveSettings.probabilisticSettings?.enabled) {
                shouldSendProactive = true;
            }

            if (!shouldSendProactive) {
                console.log(`[${clientId}] 선톡 조건을 만족하지 않음`);
                continue;
            }

            const allRooms = selectAllRooms(state);
            if (!allRooms || allRooms.length === 0) {
                console.error('방이 하나도 없습니다.');
                continue;
            }

            // 선톡 허용된 방만 필터링
            const proactiveEnabledRooms = allRooms.filter(room => room.proactiveEnabled === true);
            if (proactiveEnabledRooms.length === 0) {
                console.log(`[${clientId}] 선톡 허용된 방이 없습니다.`);
                continue;
            }

            const randomRoom = proactiveEnabledRooms[Math.floor(Math.random() * proactiveEnabledRooms.length)]

            const beforeMessages = selectMessagesByRoomId(store.getState(), randomRoom.id);
            const beforeIds = new Set(beforeMessages.map(m => m.id));
            printMessages(beforeMessages);

            const sentNotificationIds = new Set<string>(); // 알림 보낸 메시지 ID 추적

            // store.subscribe는 unsubscribe 함수를 반환함
            const unsubscribe = store.subscribe(async () => {
                const allMessages = selectMessagesByRoomId(store.getState(), randomRoom.id);
                const newMessages = allMessages.filter(m => !beforeIds.has(m.id) && !sentNotificationIds.has(m.id));

                for (const newlyAdded of newMessages) {
                    sentNotificationIds.add(newlyAdded.id);

                    const characterName = selectCharacterById(state, newlyAdded.authorId)?.name ?? 'Unknown';
                    printMessages([newlyAdded]);

                    await webpush.sendNotification(
                        push,
                        JSON.stringify({
                            icon: `${proactiveSettings.proactiveServerBaseUrl}/api/push/icon/${newlyAdded.authorId}`,
                            badge: '/yejingram.png',
                            body: characterName + ": " + (newlyAdded.content ?? '[스티커/이미지]'),
                        })
                    );
                }
            });

            try {
                await SendMessage(
                    randomRoom,
                    (id) => {
                        if (id) {
                            console.log("Message Generating... id:", id);
                        } else {
                            console.log("Message generation completed.");
                        }
                    },
                    i18next.t,
                    "proactive"
                );
            } catch (err) {
                console.error("선톡 메시지 전송 중 오류 발생:", err);
            } finally {
                unsubscribe();
            }

            console.log("동기화중");
            const updatedState = store.getState();

            fetch(`${updatedState.settings.syncSettings.syncBaseUrl}/api/sync/${updatedState.settings.syncSettings.syncClientId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lastSaved: selectLastSaved(updatedState),
                    backup: buildBackupPayload(),
                })
            }).then((res) => {
                if (res.ok) {
                    console.log("동기화 완료");
                } else {
                    console.error("동기화 실패:", res.statusText);
                }
            })
        }
        // 체크 주기: 1분
        await new Promise(resolve => setTimeout(resolve, 60 * 1000));
    }
})();
