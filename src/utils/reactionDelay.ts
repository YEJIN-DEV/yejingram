/**
 * Reaction delay (채팅 앱용) 계산기
 * 
 * 모델:
 *   delay = clamp(
 *     (max(MIN_GAP, K_read * in_chars) + THINK_BASE + K_type(device) * out_chars) * jitter(),
 *     MIN_DELAY,
 *     MAX_DELAY
 *   )
 *
 * 기본 상수(문헌 기반 추천치):
 *   - MIN_GAP:      0.20 s
 *   - THINK_BASE:   0.60 s
 *   - K_read:       0.030 s/char
 *   - K_type:
 *       - mobile:   0.332 s/char
 *       - desktop:  0.300 s/char
 *   - jitter:       LogNormal(μ=0, σ=0.25)  → 곱셈 노이즈
 *   - MIN_DELAY:    0.5 s
 *   - MAX_DELAY:    90 s
 */

export type Device = "mobile" | "desktop";

/** 상수 세트 */
export interface ReactionDelayConstants {
    /** 최소 턴 전환 간격 */
    MIN_GAP: number; // seconds
    /** 초단문에도 들어가는 생각(계획) 시간 */
    THINK_BASE: number; // seconds
    /** 문자당 읽기 시간 */
    K_read: number; // seconds per char
    /** 문자당 타이핑 시간 (디바이스별) */
    K_type: Record<Device, number>; // seconds per char
    /** 지터(로그정규) 파라미터 */
    jitterMu: number; // μ in lognormal
    jitterSigma: number; // σ in lognormal
    /** 지연 하한/상한 (UX 안전장치) */
    MIN_DELAY: number; // seconds
    MAX_DELAY: number; // seconds
}

/** 입력 파라미터 */
export interface ReactionDelayInput {
    inChars: number;          // 상대 메시지 길이(문자 수, 공백 포함)
    outChars: number;         // 내가 보낼 답장 길이(문자 수, 공백 포함)
    device: Device;           // "mobile" | "desktop"
}

/** 옵션 */
export interface ReactionDelayOptions {
    /** 테스트 재현성을 위한 난수 생성기 주입 (0<=r<1 반환) */
    rng?: () => number;
    /** 상수 오버라이드 */
    constants?: Partial<ReactionDelayConstants>;
    speedup?: number;
}

/** 기본 상수 (권장값) */
export const DEFAULT_CONSTANTS: ReactionDelayConstants = {
    MIN_GAP: 0.20,
    THINK_BASE: 0.60,
    K_read: 0.030, // ≈ (60 / (238 wpm * 5 chars/word)) * 0.6 스킴 보정
    K_type: {
        mobile: 0.332, // 36.2 wpm ≈ 0.332 s/char
        desktop: 0.300 // 일반 유저 가정
    },
    jitterMu: 0.0,
    jitterSigma: 0.25, // ~±25% 체감 변동
    MIN_DELAY: 0.5,
    MAX_DELAY: 90
};

/** 유틸: clamp */
function clamp(x: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, x));
}

/** 유틸: 표준 정규 난수 (Box–Muller) */
function randn(rng: () => number): number {
    let u = 0, v = 0;
    // Math.log(0) 회피
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** 유틸: 로그정규 샘플 */
function sampleLogNormal(mu: number, sigma: number, rng: () => number): number {
    const z = randn(rng);
    return Math.exp(mu + sigma * z);
}

/**
 * 읽기 시간 계산 (초)
 *  - 너무 짧은 입력에선 MIN_GAP을 바닥으로 적용
 */
export function readingTimeSec(inChars: number, constants: ReactionDelayConstants): number {
    const t = constants.K_read * Math.max(0, inChars);
    return Math.max(constants.MIN_GAP, t);
}

/** 생각(계획) 시간 계산 (초) */
export function thinkingTimeSec(constants: ReactionDelayConstants): number {
    return constants.THINK_BASE;
}

/** 타이핑 시간 계산 (초) */
export function typingTimeSec(outChars: number, device: Device, constants: ReactionDelayConstants): number {
    const k = constants.K_type[device];
    return k * Math.max(0, outChars);
}

/** 지터 계수 (곱셈) */
export function jitterFactor(options?: ReactionDelayOptions, constants = DEFAULT_CONSTANTS): number {
    const rng = options?.rng ?? Math.random;
    return sampleLogNormal(constants.jitterMu, constants.jitterSigma, rng);
}

/**
 * 메인: reaction delay 계산 (초)
 */
export function calcReactionDelay(
    input: ReactionDelayInput,
    options?: ReactionDelayOptions
): number {
    const constants: ReactionDelayConstants = { ...DEFAULT_CONSTANTS, ...(options?.constants ?? {}) };
    const { inChars, outChars, device } = input;

    const tRead = readingTimeSec(inChars, constants);
    const tThink = thinkingTimeSec(constants);
    const tType = typingTimeSec(outChars, device, constants);

    const base = tRead + tThink + tType;
    const jittered = base * jitterFactor(options, constants);

    return clamp(jittered, constants.MIN_DELAY, constants.MAX_DELAY) / (options?.speedup ?? 1) * 1000;
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
