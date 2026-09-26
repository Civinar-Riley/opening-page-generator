# SillyTavern 常量定义 —— Chat Completion API 源列表

> 来源：[src/constants.js L164](https://github.com/SillyTavern/SillyTavern/blob/2e3dff73a127679f643e971801cd51173c2c34e7/src/constants.js#L164)
> （commit `2e3dff73a127679f643e971801cd51173c2c34e7`）
> 原文留档：`99-原文抓取/SillyTavern-constants.js`

## CHAT_COMPLETION_SOURCES（custom_api.source 支持的 API 源）

做脚本/插件时若需调用 Chat Completion 接口或判断当前 API 类型，`source` 字段的合法值：

```js
export const CHAT_COMPLETION_SOURCES = {
    OPENAI: 'openai',            // OpenAI
    CLAUDE: 'claude',            // Anthropic Claude
    OPENROUTER: 'openrouter',    // OpenRouter
    AI21: 'ai21',
    MAKERSUITE: 'makersuite',    // Google AI Studio (Gemini)
    VERTEXAI: 'vertexai',        // Vertex AI
    MISTRALAI: 'mistralai',
    CUSTOM: 'custom',            // 自定义（兼容 OpenAI 格式的中转/自建）
    COHERE: 'cohere',
    PERPLEXITY: 'perplexity',
    GROQ: 'groq',
    ZEROONEAI: '01ai',
    NANOGPT: 'nanogpt',
    DEEPSEEK: 'deepseek',
    AIMLAPI: 'aimlapi',
    XAI: 'xai',                  // Grok
    POLLINATIONS: 'pollinations',
};
```

## TEXTGEN_TYPES（文本补全类后端）

```js
export const TEXTGEN_TYPES = {
    OOBA: 'ooba',              // text-generation-webui
    MANCER: 'mancer',
    VLLM: 'vllm',
    APHRODITE: 'aphrodite',
    TABBY: 'tabby',
    KOBOLDCPP: 'koboldcpp',
    TOGETHERAI: 'togetherai',
    LLAMACPP: 'llamacpp',
    OLLAMA: 'ollama',
    INFERMATICAI: 'infermaticai',
    DREAMGEN: 'dreamgen',
    OPENROUTER: 'openrouter',
    FEATHERLESS: 'featherless',
    HUGGINGFACE: 'huggingface',
    GENERIC: 'generic',        // 通用 OpenAI 兼容
};
```

## 使用提示

- 该文件是**后端常量**，与前端 `public/script.js` 中的同名定义保持同步（源码注释也说明未来会去重）。
- 写酒馆助手脚本时判断 API 来源，一般通过 `SillyTavern.getContext()` 拿到连接信息后再比对这里的字符串值。
- 注意同一 commit 里的其他常量（如 `GEMINI_SAFETY`、`UPLOADS_DIRECTORY`）也可能有用，完整文件见原文留档。
