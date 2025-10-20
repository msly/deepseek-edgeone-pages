/**
 * EdgeOne Pages Edge Function for /api/v1/chat/completions
 * 处理聊天补全请求
 */

// 配置
const CONFIG = {
  UPSTREAM_API: 'https://ai-chatbot-starter.edgeone.app/api/ai',
  MODEL_MAPPING: {
    'deepseek-reasoner': 'DeepSeek-R1',
    'deepseek-chat': 'DeepSeek-V3'
  }
};

/**
 * 生成 CORS 头
 * @returns {Object} CORS 头对象
 */
function makeCORSHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

/**
 * 处理 CORS 预检请求
 * @returns {Response} CORS 响应
 */
function handleOptions() {
  return new Response(null, {
    status: 200,
    headers: makeCORSHeaders()
  });
}

/**
 * 生成错误响应
 * @param {string} message - 错误消息
 * @param {number} status - HTTP 状态码
 * @param {string} type - 错误类型
 * @returns {Response} 错误响应
 */
function errorResponse(message, status = 400, type = "invalid_request_error") {
  return new Response(JSON.stringify({
    error: { message, type, code: null }
  }), {
    status,
    headers: { "Content-Type": "application/json", ...makeCORSHeaders() }
  });
}

/**
 * 验证 API 密钥
 * @param {Object} context - EdgeOne Pages 上下文对象
 * @returns {boolean} 验证结果
 */
function verifyApiKey(context) {
  const API_KEY = context.env.API_KEY;
  if (!API_KEY) {
    return true; // 如果没有配置密钥，跳过验证
  }
  
  const authHeader = context.request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== API_KEY) {
    return false;
  }
  
  return true;
}

/**
 * 转换为 OpenAI 格式（非流式）
 * @param {Object} data - 上游响应数据
 * @param {string} model - 模型名称
 * @returns {Object} OpenAI 格式响应
 */
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

/**
 * 转换流式响应块
 * @param {Object} chunk - 流式响应块
 * @param {string} model - 模型名称
 * @returns {Object} OpenAI 格式流式响应块
 */
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

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
function generateId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * 处理流式响应
 * @param {Response} upstreamResponse - 上游响应
 * @param {string} model - 模型名称
 * @returns {Promise<Response>} 流式响应
 */
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
      ...makeCORSHeaders()
    }
  });
}

/**
 * 处理 /api/v1/chat/completions 请求
 * @param {Object} context - EdgeOne Pages 上下文对象
 * @returns {Promise<Response>} HTTP 响应
 */
export default async function onRequest(context) {
  const request = context.request;

  // 处理 CORS 预检请求
  if (request.method === "OPTIONS") return handleOptions(request);

  // 只允许 POST 请求
  if (request.method !== "POST") {
    return errorResponse("Method not allowed", 405, "method_not_allowed");
  }

  // API 密钥验证
  if (!verifyApiKey(context)) {
    return errorResponse("无效的 API 密钥", 401, "invalid_api_key");
  }

  try {
    const body = await request.json();
    
    // 验证必需参数
    if (!body.model || !body.messages) {
      return errorResponse('Missing required parameters: model and messages', 400, "invalid_request_error");
    }

    // 验证模型
    if (!CONFIG.MODEL_MAPPING[body.model]) {
      return errorResponse(`Model '${body.model}' not found. Available models: ${Object.keys(CONFIG.MODEL_MAPPING).join(', ')}`, 400, "invalid_request_error");
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
      return errorResponse(`Upstream API error: ${errorText}`, upstreamResponse.status, "api_error");
    }

    // 处理流式响应
    if (isStream) {
      return await handleStreamResponse(upstreamResponse, body.model);
    }

    // 处理非流式响应
    const responseText = await upstreamResponse.text();
    
    // 检查是否是流式响应格式
    if (responseText.startsWith('data: ')) {
      // 如果上游返回了流式格式，需要解析为JSON
      const lines = responseText.split('\n');
      let lastData = null;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ') && !trimmed.includes('[DONE]')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            lastData = data;
          } catch (e) {
            console.error('Parse error:', e);
          }
        }
      }
      
      if (lastData) {
        const transformedData = transformToOpenAIFormat(lastData, body.model);
        return new Response(JSON.stringify(transformedData), {
          headers: { "Content-Type": "application/json", ...makeCORSHeaders() }
        });
      }
    }
    
    // 尝试直接解析为JSON
    try {
      const data = JSON.parse(responseText);
      const transformedData = transformToOpenAIFormat(data, body.model);
      return new Response(JSON.stringify(transformedData), {
        headers: { "Content-Type": "application/json", ...makeCORSHeaders() }
      });
    } catch (e) {
      return errorResponse(`上游响应格式错误: ${responseText.substring(0, 200)}...`, 500, "api_error");
    }

  } catch (error) {
    return errorResponse(`处理错误: ${error.message}`, 500, "internal_server_error");
  }
}