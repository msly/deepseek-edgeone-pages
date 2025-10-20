# OpenAI API 适配器 - EdgeOne Pages 版本

这是一个部署在 EdgeOne Pages 上的 OpenAI API 适配器，提供兼容 OpenAI 格式的聊天接口。

## 问题修复说明

### 原始问题
- 项目部署后出现 404 错误
- Edge 函数使用了错误的 Cloudflare Workers 格式
- 缺少正确的 API 路由结构
- 缺少前端测试页面

### 修复内容

#### 1. Edge 函数格式修复
**问题**: 原始代码使用了 `addEventListener('fetch', ...)` 格式，这是 Cloudflare Workers 的格式
**修复**: 改为 EdgeOne Pages 标准格式 `export default async function onRequest(context)`

#### 2. API 路由结构修复
**问题**: 原始只有一个 `openai-edgeone-adapter.js` 文件，路由不匹配
**修复**: 创建标准的 OpenAI API 路由结构
```
edge-functions/api/v1/models.js           # GET /api/v1/models
edge-functions/api/v1/chat/completions.js # POST /api/v1/chat/completions
```

#### 3. 前端页面添加
**问题**: 缺少前端测试页面
**修复**: 添加 `index.html` 测试页面，可以测试 API 功能

## 项目结构

```
deepseek-edgeone-pages/
├── edge-functions/
│   └── api/
│       └── v1/
│           ├── models.js           # 模型列表 API
│           └── chat/
│               └── completions.js  # 聊天补全 API
├── index.html                      # 前端测试页面
└── README.md                       # 说明文档
```

## 部署配置

### 环境变量
在 EdgeOne Pages 控制台设置环境变量：
- `API_KEY`: 你的 API 密钥（默认值：`hello`）

### 支持的模型
- `deepseek-chat`: DeepSeek-V3
- `deepseek-reasoner`: DeepSeek-R1

## API 端点

### 获取模型列表
```
GET /api/v1/models
Authorization: Bearer YOUR_API_KEY
```

### 聊天补全
```
POST /api/v1/chat/completions
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "model": "deepseek-chat",
  "messages": [
    {"role": "user", "content": "你好"}
  ],
  "stream": false
}
```

## 测试方法

1. 部署项目到 EdgeOne Pages
2. 访问你的域名，会看到测试页面
3. 输入 API 密钥进行测试
4. 可以测试模型列表和聊天功能

## 注意事项

- 确保 EdgeOne Pages 环境变量 `API_KEY` 设置正确
- 上游 API 地址配置在 `CONFIG.UPSTREAM_API` 中
- 支持流式和非流式响应
- 完全兼容 OpenAI API 格式