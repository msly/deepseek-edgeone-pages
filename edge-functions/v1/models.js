/**
 * EdgeOne Pages Edge Function for /v1/models
 * 处理模型列表请求
 */

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
 * 处理 /v1/models 请求
 * @param {Object} context - EdgeOne Pages 上下文对象
 * @returns {Promise<Response>} HTTP 响应
 */
export default async function onRequest(context) {
  const request = context.request;

  // 处理 CORS 预检请求
  if (request.method === "OPTIONS") return handleOptions(request);

  // API 密钥验证
  if (!verifyApiKey(context)) {
    return errorResponse("无效的 API 密钥", 401, "invalid_api_key");
  }

  try {
    // 返回模型列表
    return new Response(JSON.stringify({ object: "list", data: MODELS }), {
      headers: { "Content-Type": "application/json", ...makeCORSHeaders() }
    });
  } catch (err) {
    return errorResponse(`模型列表请求错误: ${err.message}`, 500, "internal_server_error");
  }
}