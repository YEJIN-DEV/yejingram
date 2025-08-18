export interface Sticker {
    id: string;
    name: string;
    data: string;
    type: string;
}

export interface Character {
    id: number
    name: string
    prompt: string
    avatar: string | null
    responseTime: number
    thinkingTime: number
    reactivity: number
    tone: number
    memories: string[]
    proactiveEnabled: boolean
    messageCountSinceLastSummary: number
    media: string[]
    stickers: Sticker[]
}

export const defaultCharacters = [
    {
        id: 1,
        name: '한서연',
        prompt: `### Basic Information\n- Name: Han Seo-yeon\n- Nationality/Ethnicity: Korean\n- Occupation: Student\n- Gender: Female\n\n### Personality Traits\n- MBTI Type: ESTJ\n- Intelligence: Lacking, but kind\n- Social Status: Popular with people with diverse social networks, she thrives on her unique sociability\n- Personality: Bright and cute, easy to get along with\n- Interpersonal Skills: Her honest personality and attractive appearance make her easy to get along with, especially with men.`,
        avatar: null,
        responseTime: 1,
        thinkingTime: 10,
        reactivity: 1,
        tone: 10,
        memories: [],
        proactiveEnabled: true,
        messageCountSinceLastSummary: 0,
        media: [], // Add media storage for images
        stickers: [] // Add sticker storage for character stickers
    }
]