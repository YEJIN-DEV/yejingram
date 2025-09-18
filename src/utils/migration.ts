type AddRule = {
    path: string;
    keys: string[];
    defaults: Record<string, any>;
};

type DeleteRule = {
    path: string;
    keys: string[];
};

type MoveRule = {
    from: string;                 // 소스 경로 (와일드카드 * 지원)
    to: string;                   // 타겟 경로 (와일드카드 * 지원, 생성은 * 없는 경로만)
    keys: string[];               // 이동할 키 목록
    rename?: Record<string, string>; // 키명 매핑(예: { maxTokens: 'maxResponseTokens' })
    overwrite?: boolean;          // 대상에 이미 값이 있어도 덮어쓸지 (기본 false)
    keepSource?: boolean;         // true면 복사, false면 이동(원본 삭제). 기본 false
    defaults?: Record<string, any>; // 소스에 값이 없을 때 사용할 기본값
};

type Rules = {
    add?: AddRule[];
    delete?: DeleteRule[];
    move?: MoveRule[];
};

function traverseTargets(root: any, path: string): any[] {
    const parts = path.split('.');
    const results: any[] = [];

    function dfs(node: any, i: number) {
        if (node == null) return;
        if (i === parts.length) { results.push(node); return; }

        const part = parts[i];
        if (part === '*') {
            if (node && typeof node === 'object') {
                Object.keys(node).forEach(k => dfs(node[k], i + 1));
            }
        } else {
            dfs(node[part], i + 1);
        }
    }

    dfs(root, 0);
    return results;
}

// '*'가 없는 경로를 필요 시 생성하면서 단일 타깃을 반환
function getOrCreateTarget(root: any, path: string): any | undefined {
    const parts = path.split('.');
    if (parts.includes('*')) {
        // 와일드카드 포함 경로는 생성 불가(존재해야 함)
        const targets = traverseTargets(root, path);
        return targets[0];
    }
    let node = root;
    for (const part of parts) {
        if (node[part] == null) node[part] = {};
        node = node[part];
        if (typeof node !== 'object') return undefined;
    }
    return node;
}

function applyAddRule(root: any, rule: AddRule) {
    const targets = traverseTargets(root, rule.path);
    targets.forEach(obj => {
        if (obj && typeof obj === 'object') {
            rule.keys.forEach(key => {
                if (key === '*') {
                    // '*'이면 defaults의 모든 키를 추가
                    Object.keys(rule.defaults || {}).forEach(defaultKey => {
                        if (!(defaultKey in obj)) {
                            obj[defaultKey] = rule.defaults[defaultKey];
                        }
                    });
                } else {
                    if (!(key in obj)) {
                        obj[key] = rule.defaults?.[key];
                    }
                }
            });
        }
    });
}

function applyDeleteRule(root: any, rule: DeleteRule) {
    const targets = traverseTargets(root, rule.path);
    targets.forEach(obj => {
        if (obj && typeof obj === 'object') {
            rule.keys.forEach(key => {
                if (key in obj) delete obj[key];
            });
        }
    });
}

function applyMoveRule(root: any, rule: MoveRule) {
    const sources = traverseTargets(root, rule.from);
    const destsRaw = traverseTargets(root, rule.to);
    const overwrite = !!rule.overwrite;
    const keepSource = !!rule.keepSource;
    const rename = rule.rename || {};
    const defaults = rule.defaults || {};

    // 목적지 생성(필요 시). '*'가 없을 때만 생성 가능
    let dests = destsRaw;
    if (dests.length === 0 && !rule.to.split('.').includes('*')) {
        const created = getOrCreateTarget(root, rule.to);
        if (created) dests = [created];
    }

    if (dests.length === 0) return; // 목적지가 없으면 스킵

    // 매칭 전략:
    // - dests.length === 1 => 모든 소스가 그 하나로 이동(N:1)
    // - sources.length === 1 && dests.length > 1 => 하나의 소스를 여러 목적지로 복사/이동(1:N)
    // - 길이 같음 => 인덱스대로 1:1
    // - 그 외 => 안전하게 N:1로 폴백(마지막 소스 우선/overwrite에 따름)
    const mode =
        dests.length === 1 ? 'manyToOne' :
            sources.length === 1 ? 'oneToMany' :
                sources.length === dests.length ? 'zip' : 'manyToOne';

    const moveOnce = (src: any, dst: any) => {
        if (!dst || typeof dst !== 'object') return;
        rule.keys.forEach(k => {
            const dstKey = rename[k] ?? k;
            const hasSrc = src && typeof src === 'object' && k in src;
            const value = hasSrc ? src[k] : defaults[dstKey];
            if (value !== undefined) {
                if (overwrite || !(dstKey in dst)) {
                    dst[dstKey] = value;
                }
            } else {
                // 소스에도 없고 defaults에도 없으면 아무 것도 안 함
            }
            // 이동(move)인 경우에만 원본 삭제
            if (!keepSource && hasSrc) {
                delete src[k];
            }
        });
    };

    if (mode === 'manyToOne') {
        const dst = dests[0];
        sources.forEach(src => moveOnce(src, dst));
    } else if (mode === 'oneToMany') {
        const src = sources[0];
        dests.forEach(dst => moveOnce(src, dst));
        if (!keepSource) {
            // 1:N 이동이면 원본 키는 한 번만 지우면 충분
            rule.keys.forEach(k => { if (src && k in src) delete src[k]; });
        }
    } else { // zip
        const n = Math.min(sources.length, dests.length);
        for (let i = 0; i < n; i++) {
            moveOnce(sources[i], dests[i]);
        }
    }
}

export function applyRules(state: any, rules: Rules) {
    rules.add?.forEach(rule => applyAddRule(state, rule));
    rules.delete?.forEach(rule => applyDeleteRule(state, rule));
    (rules as any).move?.forEach((rule: MoveRule) => applyMoveRule(state, rule));
    return state;
}
