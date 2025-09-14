import { store } from "../app/store";
import { selectCurrentApiConfig } from "../entities/setting/selectors";

const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

export function buildComfyUIPayload(prompt: string, workflowJson: string, artStylePrompt?: string) {
    // Clean the workflow JSON string from any potential control characters
    let cleanedWorkflowJson = workflowJson
        .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
        .replace(/\r?\n/g, '') // Remove line breaks
        .trim();
    
    console.log('Original workflow JSON length:', workflowJson.length);
    console.log('Cleaned workflow JSON length:', cleanedWorkflowJson.length);
    
    // Parse the workflow JSON template
    let workflow;
    try {
        workflow = JSON.parse(cleanedWorkflowJson);
    } catch (error) {
        console.error('Failed to parse workflow JSON:', error);
        console.error('Workflow JSON around error position:', cleanedWorkflowJson.substring(Math.max(0, 2014-50), 2014+50));
        
        // Fallback to a basic working workflow
        console.log('Using fallback workflow...');
        workflow = {
            "3": {
                "inputs": {
                    "seed": Math.floor(Math.random() * 1000000000),
                    "steps": 20,
                    "cfg": 8,
                    "sampler_name": "euler",
                    "scheduler": "normal",
                    "denoise": 1,
                    "model": ["4", 0],
                    "positive": ["6", 0],
                    "negative": ["7", 0],
                    "latent_image": ["5", 0]
                },
                "class_type": "KSampler"
            },
            "4": {
                "inputs": {
                    "ckpt_name": "v1-5-pruned-emaonly.ckpt"
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "5": {
                "inputs": {
                    "width": 512,
                    "height": 512,
                    "batch_size": 1
                },
                "class_type": "EmptyLatentImage"
            },
            "6": {
                "inputs": {
                    "text": "beautiful scenery",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "7": {
                "inputs": {
                    "text": "text, watermark",
                    "clip": ["4", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "8": {
                "inputs": {
                    "samples": ["3", 0],
                    "vae": ["4", 2]
                },
                "class_type": "VAEDecode"
            },
            "9": {
                "inputs": {
                    "filename_prefix": "ComfyUI",
                    "images": ["8", 0]
                },
                "class_type": "SaveImage"
            }
        };
    }

    // Find text nodes and inject the prompt
    // ComfyUI workflows typically have CLIPTextEncode nodes for positive/negative prompts
    let promptInjected = false;
    for (const nodeId in workflow) {
        const node = workflow[nodeId];
        if (node.class_type === 'CLIPTextEncode' || node.class_type === 'CLIPTextEncodeSDXL') {
            // Look for positive prompt nodes (usually have "positive" in inputs or connected to sampler's positive)
            if (node.inputs && typeof node.inputs.text === 'string') {
                // If this looks like a positive prompt node (not containing negative terms)
                const currentText = node.inputs.text.toLowerCase();
                if (!currentText.includes('negative') && !currentText.includes('bad') && !currentText.includes('worst') && !currentText.includes('watermark') && !promptInjected) {
                    // 프롬프트 조합: 그림체 프롬프트 + 변환된 프롬프트 + 기존 텍스트
                    const existingText = node.inputs.text;
                    const parts = [];
                    
                    // 1. 기존 텍스트 (품질 태그 등)
                    if (existingText) {
                        parts.push(existingText);
                    }
                    
                    // 2. 변환된 프롬프트 (대화 내용 기반)
                    if (prompt) {
                        parts.push(prompt);
                    }
                    
                    // 3. 그림체 프롬프트 (선택된 그림체)
                    if (artStylePrompt) {
                        parts.push(artStylePrompt);
                    }
                    
                    node.inputs.text = parts.join(', ');
                    promptInjected = true;
                    console.log(`프롬프트 삽입됨 (노드 ${nodeId}):`, node.inputs.text);
                    console.log('그림체 프롬프트:', artStylePrompt || '없음');
                }
            }
        }
    }
    
    if (!promptInjected) {
        console.warn('프롬프트를 삽입할 CLIPTextEncode 노드를 찾을 수 없습니다');
    }

    // Generate a random seed for reproducible but varied results
    const randomSeed = Math.floor(Math.random() * 2**32);
    
    // Find KSampler nodes and set random seed
    for (const nodeId in workflow) {
        const node = workflow[nodeId];
        if (node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') {
            if (node.inputs && typeof node.inputs.seed === 'number') {
                node.inputs.seed = randomSeed;
            }
        }
    }

    return {
        prompt: workflow,
        client_id: Math.random().toString(36).substring(2, 15)
    };
}

// 한글 대화 내용을 단부루 스타일 영어 태그로 변환하는 함수
export async function convertKoreanToImageTags(koreanText: string, characterName?: string): Promise<string> {
    try {
        // Gemini API를 사용해서 한글을 영어 이미지 태그로 변환
        const apiConfig = selectCurrentApiConfig(store.getState());
        if (!apiConfig.apiKey) {
            // API 키가 없으면 기본 변환 로직 사용
            return convertKoreanToImageTagsBasic(koreanText, characterName);
        }

        // 다양한 스타일과 구도를 위한 랜덤 요소 추가
        const styles = ['anime style', 'manga style', 'light novel illustration', 'visual novel art', 'cel shading'];
        const angles = ['close-up', 'medium shot', 'full body', 'upper body', 'from above', 'from below', 'from side'];
        const moods = ['cheerful', 'gentle', 'dramatic', 'soft lighting', 'warm lighting', 'cool lighting'];
        
        const randomStyle = styles[Math.floor(Math.random() * styles.length)];
        const randomAngle = angles[Math.floor(Math.random() * angles.length)];
        const randomMood = moods[Math.floor(Math.random() * moods.length)];

        const prompt = `Convert the following Korean conversation to structured Danbooru-style image tags using the lightboard-ComfyUI format.

STRICT FORMAT REQUIRED:
[Char1] label (girl/boy), basic_pose, facial_expression, hair_tags, body_tags, specific_pose, clothing_tags, action_tags
[Scene] overall_composition, interaction_summary, mood_tags
[Place] environment, background, lighting
[Angle] viewpoint, framing, shot_type

RULES:
- Use ONLY common Danbooru tags (no names, no abstract concepts)
- Follow exact tag order: Label → Basic Pose → Facial → Hair → Body → Specific Pose → Clothing → Action
- Be objective and specific (e.g., "white shirt, black skirt" not "casual clothes")
- Invent missing visual details as needed
- Focus on the frozen moment being captured

Korean text: "${koreanText}"
Character name: ${characterName || "girl"} (use as generic label like 'girl', 'boy')
Style suggestion: ${randomStyle}
Angle suggestion: ${randomAngle}
Mood suggestion: ${randomMood}

Generate structured tags in the exact format above:`;

        // TODO: THIS MUST BE CHANGE TO ENSURE THE API CAN USE CURRENT API MODEL.
        // TODO: ALSO THIS CODE HAVE NOT BEEN TESTED YET.
        const response = await fetch(`${GEMINI_API_BASE_URL}gemini-2.5-flash:generateContent?key=${apiConfig.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.9,  // 높은 창의성을 위해 증가
                    topP: 0.8,
                    topK: 40,
                    maxOutputTokens: 200
                }
            })
        });

        if (response.ok) {
            const data = await response.json();
            const generatedTags = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (generatedTags) {
                console.log('AI 생성 이미지 태그:', generatedTags);
                return generatedTags.trim();
            }
        }
    } catch (error) {
        console.warn('AI 태그 변환 실패, 기본 로직 사용:', error);
    }

    // AI 변환 실패시 기본 로직 사용
    return convertKoreanToImageTagsBasic(koreanText, characterName);
}

// 기본 규칙 기반 한글->영어 태그 변환 (맥락 분석 강화)
function convertKoreanToImageTagsBasic(koreanText: string, characterName?: string): string {
    const text = koreanText.toLowerCase();
    console.log('분석할 원본 텍스트:', koreanText);
    
    // 상황별 시나리오 분석
    let scenario = analyzeScenario(text);
    console.log('감지된 시나리오:', scenario);
    
    // 캐릭터 태그 구성
    let charTags: string[] = [];
    let sceneTags: string[] = [];
    let placeTags: string[] = [];
    let angleTags: string[] = [];

    // [Char1] 태그 생성
    charTags.push('1girl');
    
    // 시나리오별 태그 생성
    switch (scenario.type) {
        case 'bedtime':
            charTags.push('lying down', 'sleepy, tired', 'long hair', 'brown hair', 'medium breasts', 'holding phone', 'pajamas, nightwear', 'looking at phone');
            sceneTags.push('1girl, solo', 'late night, sleepy atmosphere');
            placeTags.push('bedroom, indoors', 'dim lighting, night');
            angleTags.push('medium shot', 'from above');
            break;
            
        case 'phone_conversation':
            charTags.push('sitting', 'smiling, happy', 'medium hair', 'black hair', 'medium breasts', 'holding phone', 'casual clothes', 'talking on phone');
            sceneTags.push('1girl, solo', 'phone conversation, cheerful');
            placeTags.push('indoors, room', 'soft lighting');
            angleTags.push('upper body', 'from front');
            break;
            
        case 'video_call':
            charTags.push('sitting', 'gentle expression', 'long hair', 'blonde hair', 'medium breasts', 'hand gesture', 'casual top', 'looking at camera');
            sceneTags.push('1girl, solo', 'video call setup');
            placeTags.push('indoors, room', 'screen lighting');
            angleTags.push('close-up', 'from front');
            break;
            
        case 'eating':
            charTags.push('sitting', 'happy, enjoying', 'short hair', 'brown hair', 'medium breasts', 'holding utensils', 'casual dress', 'eating');
            sceneTags.push('1girl, solo', 'mealtime, happy');
            placeTags.push('dining room, kitchen', 'natural lighting');
            angleTags.push('medium shot', 'from side');
            break;
            
        case 'study_work':
            charTags.push('sitting', 'focused, concentrated', 'medium hair', 'black hair', 'medium breasts', 'hand on chin', 'shirt, casual', 'reading, writing');
            sceneTags.push('1girl, solo', 'studying, focused');
            placeTags.push('desk, room', 'desk lamp lighting');
            angleTags.push('upper body', 'from side');
            break;
            
        case 'exercise':
            charTags.push('standing', 'energetic, determined', 'ponytail', 'brown hair', 'athletic build', 'stretching pose', 'sports wear, gym clothes', 'exercising');
            sceneTags.push('1girl, solo', 'exercise, active');
            placeTags.push('gym, outdoors', 'bright lighting');
            angleTags.push('full body', 'from front');
            break;
            
        default: // 'casual_chat'
            charTags.push('sitting', 'gentle expression', 'medium hair', 'brown hair', 'medium breasts', 'relaxed pose', 'casual dress', 'looking at viewer');
            sceneTags.push('1girl, solo', 'casual, relaxed');
            placeTags.push('indoors, room', 'soft lighting');
            angleTags.push('medium shot', 'from front');
    }

    // 추가 키워드 기반 보정
    applyKeywordCorrections(text, charTags, sceneTags, placeTags, angleTags);

    // 라이트보드 구조로 결합
    const result = `[Char1] ${charTags.join(', ')}, [Scene] ${sceneTags.join(', ')}, [Place] ${placeTags.join(', ')}, [Angle] ${angleTags.join(', ')}`;
    
    console.log('맥락 분석 기반 태그 변환 결과:', result);
    return result;
}

// 텍스트 시나리오 분석 함수
function analyzeScenario(text: string): { type: string, confidence: number } {
    const scenarios = [
        {
            type: 'bedtime',
            keywords: ['자겠다', '잘래', '졸려', '4시', '새벽', '피곤', '잠', '자기 전'],
            weight: 1.0
        },
        {
            type: 'video_call', 
            keywords: ['영상통화', '화상통화', '얼굴 보고', '카메라', '영상', '화면'],
            weight: 1.0
        },
        {
            type: 'phone_conversation',
            keywords: ['전화', '통화', '폰', '핸드폰', '전화해', '받아'],
            weight: 0.8
        },
        {
            type: 'eating',
            keywords: ['먹', '밥', '음식', '식사', '배고', '맛있', '요리'],
            weight: 0.9
        },
        {
            type: 'study_work', 
            keywords: ['공부', '과제', '일', '업무', '공부해', '열심히', '집중'],
            weight: 0.8
        },
        {
            type: 'exercise',
            keywords: ['운동', '헬스', '달리기', '요가', '스트레칭', '땀'],
            weight: 0.7
        }
    ];

    let bestMatch = { type: 'casual_chat', confidence: 0 };

    for (const scenario of scenarios) {
        let score = 0;
        for (const keyword of scenario.keywords) {
            if (text.includes(keyword)) {
                score += scenario.weight;
            }
        }
        
        if (score > bestMatch.confidence) {
            bestMatch = { type: scenario.type, confidence: score };
        }
    }

    return bestMatch;
}

// 추가 키워드 기반 보정
function applyKeywordCorrections(text: string, charTags: string[], sceneTags: string[], placeTags: string[], angleTags: string[]) {
    // 시간대 보정
    if (text.includes('새벽') || text.includes('4시') || text.includes('밤')) {
        const placeIndex = placeTags.findIndex(tag => tag.includes('lighting'));
        if (placeIndex !== -1) {
            placeTags[placeIndex] = 'dim lighting, night';
        }
    }

    // 감정 보정
    if (text.includes('ㅋㅋ') || text.includes('ㅎㅎ')) {
        const faceIndex = charTags.findIndex(tag => tag.includes('expression') || tag.includes('smile'));
        if (faceIndex !== -1) {
            charTags[faceIndex] = 'smile, cheerful';
        }
    }

    // 사진/이미지 관련
    if (text.includes('사진') || text.includes('이미지') || text.includes('pic')) {
        if (!charTags.some(tag => tag.includes('phone'))) {
            charTags.push('holding phone');
        }
    }
}