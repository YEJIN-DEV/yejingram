import React, { useState, useEffect, useMemo, useRef } from 'react';

interface ResetOptions {
    resetApi: boolean;
    resetPrompts: boolean;
    resetUser: boolean;
    resetOther: boolean;
    resetDatabase: boolean;
}

interface ErrorPageProps {
    error?: Error;
    onResetOptions: (options: ResetOptions) => void;
    onReset: () => void;
    onBackup: () => void;
    onRestore: () => void;
    /** 라이선스 확인된 MP3/OGG 등 오디오 파일 경로(또는 CDN URL) */
    bgmSrc?: string;
    /** 기본값 true. false로 주면 자동재생 시도 안 함 */
    bgmAutoplay?: boolean;
    /** 기본값 true. 플레이어 미니 컨트롤 표시 */
    showBgmControls?: boolean;
}

const PANEL = 'border-2 border-amber-600 bg-black/80 p-2';
const LABEL = 'text-amber-500 text-xs';
const HEADER = 'text-amber-400 font-bold mb-2';

type ToggleItem = {
    code: string;
    key: keyof ResetOptions;
    label: string;
};

const TOGGLES: ToggleItem[] = [
    { label: 'API CONFIGURATION', key: 'resetApi', code: 'SYS-API-01' },
    { label: 'PROMPT SYSTEM', key: 'resetPrompts', code: 'SYS-PRM-02' },
    { label: 'USER DATA BANK', key: 'resetUser', code: 'SYS-USR-03' },
    { label: 'OTHER PARAMETERS', key: 'resetOther', code: 'SYS-OTH-04' },
    { label: 'DATABASE CORE', key: 'resetDatabase', code: 'SYS-DB-05' },
];

const ToggleRow: React.FC<{
    checked: boolean;
    onChange: () => void;
    label: string;
    code: string;
}> = ({ checked, onChange, label, code }) => (
    <button
        type="button"
        onClick={onChange}
        className="flex items-center gap-2 w-full text-left hover:opacity-90"
        aria-pressed={checked}
    >
        <div
            className={`w-4 h-4 border-2 grid place-items-center ${checked ? 'border-green-500 bg-green-500/30' : 'border-amber-600'
                }`}
        >
            {checked && <span className="text-green-400 text-[10px] leading-none">■</span>}
        </div>
        <div className="flex-1">
            <div className={`${LABEL}`}>{label}</div>
            <div className="text-amber-700 text-xs">{code}</div>
        </div>
    </button>
);

const MetricRow: React.FC<{ name: string; value: string; danger?: boolean }> = ({
    name,
    value,
    danger = true,
}) => (
    <div className="flex justify-between text-xs">
        <span className={LABEL}>{name}</span>
        <span className={danger ? 'text-red-500' : 'text-amber-400'}>{value}</span>
    </div>
);

/** 미니 BGM 플레이어 */
const BgmPlayer: React.FC<{
    src?: string;
    autoplay?: boolean;
    showControls?: boolean;
}> = ({ src, autoplay = true, showControls = true }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [volume, setVolume] = useState(0.4);
    const [blocked, setBlocked] = useState(false);

    // 볼륨/뮤트 반영
    useEffect(() => {
        if (!audioRef.current) return;
        audioRef.current.volume = volume;
        audioRef.current.muted = muted;
    }, [volume, muted]);

    // 자동재생 시도 + 사용자 제스처 폴백
    useEffect(() => {
        const el = audioRef.current;
        if (!src || !el) return;

        const tryPlay = () => {
            el.play()
                .then(() => {
                    setPlaying(true);
                    setBlocked(false);
                })
                .catch(() => {
                    setBlocked(true);
                    setPlaying(false);
                });
        };

        const onInteract = () => {
            tryPlay();
            window.removeEventListener('pointerdown', onInteract);
            window.removeEventListener('keydown', onInteract);
        };

        if (autoplay) {
            tryPlay();
            window.addEventListener('pointerdown', onInteract, { once: true });
            window.addEventListener('keydown', onInteract, { once: true });
            return () => {
                window.removeEventListener('pointerdown', onInteract);
                window.removeEventListener('keydown', onInteract);
            };
        }
    }, [src, autoplay]);

    if (!src) return null;

    return (
        <div className="flex items-center gap-2">
            <audio
                ref={audioRef}
                src={src}
                preload="auto"
                loop
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
            />
            {showControls && (
                <>
                    <button
                        onClick={() => {
                            const el = audioRef.current;
                            if (!el) return;
                            if (playing) el.pause();
                            else el.play().catch(() => setBlocked(true));
                        }}
                        className="border border-amber-600 text-amber-300 text-xs px-2 py-1 hover:bg-amber-900/30"
                        aria-label={playing ? 'Pause BGM' : 'Play BGM'}
                        title={playing ? 'Pause' : 'Play'}
                    >
                        {playing ? '❚❚' : '▶'}
                    </button>

                    <button
                        onClick={() => setMuted((m) => !m)}
                        className="border border-amber-600 text-amber-300 text-xs px-2 py-1 hover:bg-amber-900/30"
                        aria-label={muted ? 'Unmute' : 'Mute'}
                        title={muted ? 'Unmute' : 'Mute'}
                    >
                        {muted ? '🔇' : '🔊'}
                    </button>

                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="h-1 w-24 accent-amber-400"
                        aria-label="BGM Volume"
                        title="Volume"
                    />

                    {blocked && (
                        <span className="text-amber-400 text-xs">
                            자동재생이 차단됨 — ▶ 버튼을 눌러주세요
                        </span>
                    )}
                </>
            )}
        </div>
    );
};

const ErrorPage_EVA: React.FC<ErrorPageProps> = ({
    error,
    onResetOptions,
    onReset,
    onBackup,
    onRestore,
    bgmSrc,
    bgmAutoplay = true,
    showBgmControls = true,
}) => {
    const [time, setTime] = useState(new Date());
    const [flashState, setFlashState] = useState(0);

    const [opts, setOpts] = useState<ResetOptions>({
        resetApi: false,
        resetPrompts: false,
        resetUser: false,
        resetOther: false,
        resetDatabase: false,
    });

    useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);
    useEffect(() => {
        const f = setInterval(() => setFlashState((s) => (s + 1) % 3), 500);
        return () => clearInterval(f);
    }, []);

    useEffect(() => {
        onResetOptions(opts);
    }, [opts, onResetOptions]);

    const timeStr = useMemo(
        () => time.toLocaleTimeString('en-US', { hour12: false }),
        [time]
    );

    return (
        <div className="h-dvh bg-black text-amber-500 font-mono overflow-hidden">
            <div className="h-dvh flex flex-col p-1">
                {/* Header */}
                <div className="border-2 border-red-700 bg-black mb-1">
                    <div className="bg-red-700 text-white p-1 text-center text-xl font-bold tracking-widest">
                        緊急事態宣言 EMERGENCY
                    </div>
                    <div className="p-1 flex justify-between items-center gap-2">
                        <div className="text-red-500 text-2xl font-bold animate-pulse">● SYSTEM FAILURE</div>
                        <div className="flex items-center gap-3">
                            {/* BGM 미니 플레이어 */}
                            <BgmPlayer src={bgmSrc} autoplay={bgmAutoplay} showControls={showBgmControls} />
                            <div className="text-right">
                                <div className="text-amber-400 text-xs">TOKYO-3 MAGI SYSTEM</div>
                                <div className="text-green-400 font-bold">{timeStr}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main grid */}
                <div className="flex gap-1 flex-1">
                    {/* Left column */}
                    <div className="flex-1 flex flex-col gap-2">
                        {/* Error box */}
                        <div className={`${PANEL} relative overflow-hidden flex-1`}>
                            <div className="text-red-500 font-bold mb-2">▼ CRITICAL ERROR DETECTED</div>
                            <div className="bg-black border border-red-800 p-1 mb-1">
                                <div className="text-red-400 text-xs mb-1">EXCEPTION TRACE:</div>
                                <pre className="text-amber-300 text-xs overflow-auto max-h-16 leading-tight">
                                    {error?.message ||
                                        'UNKNOWN SYSTEM EXCEPTION\nMAGI SYNCHRONIZATION LOST\nAT-FIELD GENERATOR OFFLINE'}
                                </pre>
                            </div>
                            <div className="text-amber-500 text-xs">
                                <div>
                                    PATTERN: <span className="text-red-500">BLUE</span>
                                </div>
                                <div>
                                    BLOOD TYPE: <span className="text-red-500">UNKNOWN</span>
                                </div>
                            </div>
                        </div>

                        {/* MAGI status */}
                        <div className={`${PANEL} flex-1`}>
                            <div className={HEADER}>■ MAGI SYSTEM STATUS</div>
                            <div className="grid grid-cols-3 gap-1 mb-2">
                                {['MELCHIOR', 'BALTHASAR', 'CASPER'].map((magi, i) => (
                                    <div key={magi} className="text-center border border-red-800">
                                        <div className="text-xs text-amber-500 py-1">{magi}</div>
                                        <div
                                            className={`p-1 border-t-2 ${flashState === i ? 'border-red-500 bg-red-900/30' : 'border-red-800'
                                                }`}
                                        >
                                            <div className="text-red-500 font-bold">ERROR</div>
                                            <div className="text-red-400 text-xs">0.00%</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="border border-amber-700 bg-amber-900/20 p-1">
                                <div className="text-amber-400 text-xs">
                                    CONSENSUS: <span className="text-red-500">IMPOSSIBLE</span>
                                </div>
                            </div>
                        </div>

                        {/* Metrics */}
                        <div className={`${PANEL} flex-1`}>
                            <div className={HEADER}>▲ SYSTEM METRICS</div>
                            <div className="space-y-1">
                                <MetricRow name="SYNC RATIO:" value="00.00%" />
                                <MetricRow name="AT-FIELD:" value="NEUTRALIZED" />
                                <MetricRow name="LCL PRESSURE:" value="CRITICAL" />
                                <MetricRow name="PILOT STATUS:" value="NOT FOUND" />
                            </div>
                        </div>
                    </div>

                    {/* Right column */}
                    <div className="flex-1 flex flex-col gap-2">
                        {/* Reset config */}
                        <div className={`${PANEL} flex-1`}>
                            <div className={`${HEADER} mb-1`}>◆ SYSTEM RESET PROTOCOL</div>
                            <div className="space-y-2">
                                {TOGGLES.map(({ key, label, code }) => (
                                    <ToggleRow
                                        key={code}
                                        label={label}
                                        code={code}
                                        checked={opts[key]}
                                        onChange={() =>
                                            setOpts((prev) => ({ ...prev, [key]: !prev[key] }))
                                        }
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Warning */}
                        <div className="border-2 border-red-700 bg-red-900/20 p-1">
                            <div className="text-red-500 text-xs text-center animate-pulse">
                                <div>⚠ WARNING ⚠</div>
                                <div>全システムリセット</div>
                                <div>COMPLETE SYSTEM RESET</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex gap-1 py-2">
                    <button
                        onClick={onBackup}
                        className="flex-1 border-2 border-green-700 bg-black/80 text-green-500 p-2 hover:bg-green-900/30 hover:border-green-500 transition-all"
                    >
                        <div className="text-xs mb-1">◄ BACKUP PROTOCOL ►</div>
                        <div className="font-bold">データバックアップ</div>
                    </button>

                    <button
                        onClick={onRestore}
                        className="flex-1 border-2 border-yellow-700 bg-black/80 text-yellow-500 p-2 hover:bg-yellow-900/30 hover:border-yellow-500 transition-all"
                    >
                        <div className="text-xs mb-1">◄ RESTORE SYSTEM ►</div>
                        <div className="font-bold">システム復旧</div>
                    </button>

                    <button
                        onClick={onReset}
                        className="flex-1 border-4 border-red-700 bg-red-900/20 text-red-500 p-3 hover:bg-red-800/30 hover:border-red-500 transition-all animate-pulse"
                    >
                        <div className="text-sm mb-1">!!! EXECUTE RESET !!!</div>
                        <div className="text-xl font-bold">リセット実行</div>
                        <div className="text-xs mt-1">AUTHORIZATION REQUIRED</div>
                    </button>
                </div>

                {/* Footer */}
                <div className={`${PANEL} mt-1`}>
                    <div className="flex justify-between text-xs text-amber-400">
                        <span>TERMINAL: NERV-MAGI-03</span>
                        <span>CLEARANCE: LEVEL-0</span>
                        <span>OPERATOR: NULL</span>
                        <span>
                            PATTERN: <span className="text-red-500">BLUE</span>
                        </span>
                        <span>
                            状態: <span className="text-red-500 animate-pulse">緊急</span>
                        </span>
                    </div>
                    <div className="text-xs text-amber-400 mt-1 text-center">
                        Music: 'Breaking Rules' by Serat, sourced from Free Music Archive, licensed under CC BY.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ErrorPage_EVA;
