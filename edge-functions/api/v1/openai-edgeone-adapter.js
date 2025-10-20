// EdgeOne Worker - OpenAI API 适配器
// 部署到腾讯云 EdgeOne 边缘函数

// 配置
const CONFIG = {
  UPSTREAM_API: 'https://ai-chatbot-starter.edgeone.app/api/ai',
  MODEL_MAPPING: {
    'deepseek-reasoner': 'DeepSeek-R1',
    'deepseek-chat': 'DeepSeek-V3'
  }
};

// 从环境变量获取 API 密钥
// 支持单个密钥或逗号分隔的多个密钥
function getApiKeys(env) {
  const apiKeyEnv = env?.API_KEYS || env?.API_KEY;
  
  if (!apiKeyEnv) {
    console.warn('警告: 未配置 API_KEYS 环境变量，服务将不进行身份验证！');
    return [];
  }
  
  // 支持逗号分隔的多个密钥
  return apiKeyEnv.split(',').map(key => key.trim()).filter(key => key.length > 0);
}

// 模型列表
const MODELS = [
  {
    id: 'deepseek-reasoner',
    object: 'model',
    created: 1704067200,
    owned_by: 'deepseek',
    permission: [],
    root: 'deepseek-reasoner',
    parent: null
  },
  {
    id: 'deepseek-chat',
    object: 'model',
    created: 1704067200,
    owned_by: 'deepseek',
    permission: [],
    root: 'deepseek-chat',
    parent: null
  }
];

// 主处理函数
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS 预检
  if (request.method === 'OPTIONS') {
    return handleCORS();
  }

  // 根路径 - 显示说明页面
  if (path === '/' || path === '') {
    return handleHomePage();
  }

  // API 路由需要验证密钥
  if (path.startsWith('/v1/')) {
    const authResult = verifyApiKey(request, env);
    if (!authResult.valid) {
      return jsonResponse({
        error: {
          message: authResult.message,
          type: 'invalid_request_error',
          code: 'invalid_api_key'
        }
      }, 401);
    }
  }

  // 路由处理
  if (path === '/v1/models' && request.method === 'GET') {
    return handleModels(request);
  }

  if (path === '/v1/chat/completions' && request.method === 'POST') {
    return handleChatCompletions(request);
  }

  return jsonResponse({ error: 'Not Found' }, 404);
}

// 验证 API 密钥
function verifyApiKey(request, env) {
  const apiKeys = getApiKeys(env);
  
  // 如果没有配置密钥，跳过验证（不推荐用于生产环境）
  if (apiKeys.length === 0) {
    return { valid: true };
  }
  
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return {
      valid: false,
      message: 'Missing Authorization header. Please provide an API key in the format: Authorization: Bearer YOUR_API_KEY'
    };
  }

  // 支持 Bearer token 格式
  const token = authHeader.replace(/^Bearer\s+/i, '');
  
  if (!token) {
    return {
      valid: false,
      message: 'Invalid Authorization header format. Expected: Authorization: Bearer YOUR_API_KEY'
    };
  }

  // 验证密钥
  if (!apiKeys.includes(token)) {
    return {
      valid: false,
      message: 'Invalid API key. Please check your API key and try again.'
    };
  }

  return { valid: true };
}

// 首页说明
function handleHomePage() {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenAI API 适配器</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 900px;
      width: 100%;
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 32px;
      margin-bottom: 10px;
      font-weight: 600;
    }
    
    .header p {
      font-size: 16px;
      opacity: 0.9;
    }
    
    .content {
      padding: 40px;
    }
    
    .section {
      margin-bottom: 35px;
    }
    
    .section h2 {
      font-size: 20px;
      color: #333;
      margin-bottom: 15px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .icon {
      font-size: 24px;
    }
    
    .endpoint {
      background: #f7fafc;
      border-left: 4px solid #667eea;
      padding: 15px 20px;
      margin-bottom: 12px;
      border-radius: 4px;
    }
    
    .endpoint-method {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin-right: 10px;
    }
    
    .endpoint-path {
      font-family: 'Courier New', monospace;
      color: #2d3748;
      font-weight: 500;
    }
    
    .endpoint-desc {
      color: #718096;
      font-size: 14px;
      margin-top: 8px;
    }
    
    .model-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    
    .model-card {
      background: #f7fafc;
      padding: 20px;
      border-radius: 8px;
      border: 2px solid #e2e8f0;
      transition: all 0.3s;
    }
    
    .model-card:hover {
      border-color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    }
    
    .model-name {
      font-weight: 600;
      color: #2d3748;
      margin-bottom: 5px;
    }
    
    .model-alias {
      font-size: 13px;
      color: #718096;
    }
    
    .code-block {
      background: #2d3748;
      color: #e2e8f0;
      padding: 20px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      margin-top: 15px;
    }
    
    .code-block code {
      color: #68d391;
    }
    
    .warning {
      background: #fff5f5;
      border-left: 4px solid #fc8181;
      padding: 15px 20px;
      border-radius: 4px;
      color: #742a2a;
      margin-top: 15px;
    }
    
    .warning strong {
      display: block;
      margin-bottom: 5px;
    }
    
    .footer {
      background: #f7fafc;
      padding: 20px 40px;
      text-align: center;
      color: #718096;
      font-size: 14px;
    }
    
    .status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #c6f6d5;
      color: #22543d;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      margin-top: 15px;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      background: #38a169;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚀 OpenAI API 适配器</h1>
      <p>标准的 OpenAI 格式接口，支持 DeepSeek 模型</p>
      <div class="status">
        <span class="status-dot"></span>
        服务运行中
      </div>
    </div>
    
    <div class="content">
      <div class="section">
        <h2><span class="icon">🔌</span> 可用端点</h2>
        
        <div class="endpoint">
          <span class="endpoint-method">GET</span>
          <span class="endpoint-path">/v1/models</span>
          <div class="endpoint-desc">获取可用的模型列表</div>
        </div>
        
        <div class="endpoint">
          <span class="endpoint-method">POST</span>
          <span class="endpoint-path">/v1/chat/completions</span>
          <div class="endpoint-desc">创建聊天补全（支持流式和非流式）</div>
        </div>
      </div>
      
      <div class="section">
        <h2><span class="icon">🤖</span> 支持的模型</h2>
        <div class="model-list">
          <div class="model-card">
            <div class="model-name">deepseek-chat</div>
            <div class="model-alias">DeepSeek-V3</div>
          </div>
          <div class="model-card">
            <div class="model-name">deepseek-reasoner</div>
            <div class="model-alias">DeepSeek-R1</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h2><span class="icon">💡</span> 使用示例</h2>
        
        <div class="code-block">curl https://your-domain.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'</div>
        
        <div class="warning">
          <strong>⚠️ 安全提醒</strong>
          请妥善保管您的 API 密钥，不要将其提交到公共代码库或分享给他人。
        </div>
      </div>
      
      <div class="section">
        <h2><span class="icon">📝</span> 配置说明</h2>
        <p style="color: #4a5568; line-height: 1.8;">
          本服务需要在请求头中携带 API 密钥进行身份验证。格式为：<br>
          <code style="background: #f7fafc; padding: 4px 8px; border-radius: 4px; font-family: monospace;">Authorization: Bearer YOUR_API_KEY</code>
        </p>
      </div>
    </div>
    
    <div class="footer">
      Powered by EdgeOne • OpenAI Compatible API
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...getCORSHeaders()
    }
  });
}

// 处理 /v1/models
function handleModels(request) {
  return jsonResponse({
    object: 'list',
    data: MODELS
  });
}

// 处理 /v1/chat/completions
async function handleChatCompletions(request) {
  try {
    const body = await request.json();
    
    // 验证必需参数
    if (!body.model || !body.messages) {
      return jsonResponse({
        error: {
          message: 'Missing required parameters: model and messages',
          type: 'invalid_request_error'
        }
      }, 400);
    }

    // 验证模型
    if (!CONFIG.MODEL_MAPPING[body.model]) {
      return jsonResponse({
        error: {
          message: `Model '${body.model}' not found. Available models: ${Object.keys(CONFIG.MODEL_MAPPING).join(', ')}`,
          type: 'invalid_request_error'
        }
      }, 400);
    }

    // 检查是否是流式请求
    const isStream = body.stream === true;

    // 构建上游请求
    const upstreamBody = {
      model: body.model,
      messages: body.messages,
      ...(body.temperature !== undefined && { temperature: body.temperature }),
      ...(body.max_tokens !== undefined && { max_tokens: body.max_tokens }),
      ...(body.top_p !== undefined && { top_p: body.top_p }),
      ...(body.stream !== undefined && { stream: body.stream })
    };

    // 发送请求到上游
    const upstreamResponse = await fetch(CONFIG.UPSTREAM_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Origin': 'https://ai-chatbot-starter.edgeone.app',
        'Referer': 'https://ai-chatbot-starter.edgeone.app/'
      },
      body: JSON.stringify(upstreamBody)
    });

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      return jsonResponse({
        error: {
          message: `Upstream API error: ${errorText}`,
          type: 'api_error',
          code: upstreamResponse.status
        }
      }, upstreamResponse.status);
    }

    // 处理流式响应
    if (isStream) {
      return handleStreamResponse(upstreamResponse, body.model);
    }

    // 处理非流式响应
    const data = await upstreamResponse.json();
    return jsonResponse(transformToOpenAIFormat(data, body.model));

  } catch (error) {
    return jsonResponse({
      error: {
        message: error.message || 'Internal server error',
        type: 'server_error'
      }
    }, 500);
  }
}

// 处理流式响应
async function handleStreamResponse(upstreamResponse, model) {
  const reader = upstreamResponse.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '';
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // 发送结束标记
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const transformed = transformStreamChunk(parsed, model);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(transformed)}\n\n`));
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      } catch (error) {
        controller.error(error);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...getCORSHeaders()
    }
  });
}

// 转换为 OpenAI 格式（非流式）
function transformToOpenAIFormat(data, model) {
  return {
    id: data.id || `chatcmpl-${generateId()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: data.choices?.[0]?.message?.content || data.message?.content || ''
      },
      finish_reason: data.choices?.[0]?.finish_reason || 'stop'
    }],
    usage: data.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  };
}

// 转换流式响应块
function transformStreamChunk(chunk, model) {
  return {
    id: chunk.id || `chatcmpl-${generateId()}`,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [{
      index: 0,
      delta: {
        ...(chunk.choices?.[0]?.delta || {}),
        content: chunk.choices?.[0]?.delta?.content || ''
      },
      finish_reason: chunk.choices?.[0]?.finish_reason || null
    }]
  };
}

// 生成唯一ID
function generateId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// JSON 响应
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCORSHeaders()
    }
  });
}

// CORS 处理
function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: getCORSHeaders()
  });
}

// CORS 头
function getCORSHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

// EdgeOne 入口
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event.env));
});

// 导出（用于测试）
export default {
  fetch: (request, env) => handleRequest(request, env)
};