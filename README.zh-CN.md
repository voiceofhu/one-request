# One Request（中文说明）

语言： [English](./README.md) | **简体中文**

One Request 是一个 Visual Studio Code 扩展，你可以直接在编辑器里发送 HTTP 请求并查看响应，无需额外打开 Postman 等工具，适合接口调试、联调和日常开发验证。

## 主要功能

- 在编辑器内发送、取消、重发 HTTP 请求，并在独立面板查看语法高亮响应
- 支持 GraphQL 查询与变量编写
- 支持直接发送 cURL 命令、并把请求复制为 cURL
- 自动保存请求历史，并可查看/清理
- 一个文件支持多个请求（用 `###` 分隔）
- 响应支持图片预览、保存完整响应、仅保存响应体
- 支持响应折叠/展开、字体大小/字体族/字体粗细自定义
- 支持多种认证方式：
  - Basic Auth
  - Digest Auth
  - SSL 客户端证书
  - Azure Active Directory / Microsoft Identity Platform
  - AWS Signature v4 / AWS Cognito
- 支持环境变量与系统变量：
  - 环境变量、文件变量、请求变量、提示变量（prompt）
  - 自动补全、悬停提示、诊断、跳转定义
  - 常用系统变量如 `{{$guid}}`、`{{$timestamp}}`、`{{$datetime}}`、`{{$processEnv}}`、`{{$dotenv}}`
- 支持生成多语言代码片段（Python、JavaScript 等）
- 支持 Cookie 持久化、代理、SOAP 请求
- 支持 `.http` / `.rest` 文件语法高亮、补全、CodeLens、符号导航
- 支持 Markdown 代码块（`http` / `rest`）中直接运行请求

## 安装

1. 在 VS Code 中按 `F1`
2. 输入 `ext install`
3. 搜索并安装 `one-request`

## 快速开始

在编辑器中写一个最简单的请求：

```http
https://example.com/comments/1
```

也可以写完整格式（方法 + 头 + 请求体）：

```http
POST https://example.com/comments HTTP/1.1
content-type: application/json

{
  "name": "sample",
  "time": "Wed, 21 Oct 2015 18:27:50 GMT"
}
```

发送方式：

- 点击请求上方 `Send Request`
- 快捷键 `Ctrl+Alt+R`（macOS: `Cmd+Alt+R`）
- 右键菜单选择 `Send Request`
- `F1` 后输入 `One Request: Send Request`

## 多请求文件

你可以在一个 `.http` 文件中放多个请求，使用 `###` 分隔：

```http
GET https://example.com/comments/1 HTTP/1.1

###

GET https://example.com/topics/1 HTTP/1.1

###

POST https://example.com/comments HTTP/1.1
content-type: application/json

{
  "name": "sample",
  "time": "Wed, 21 Oct 2015 18:27:50 GMT"
}
```

把光标放到目标请求块内，直接发送即可。

## 常用语法说明

### 1) 请求行

以下写法都可用：

```http
GET https://example.com/comments/1 HTTP/1.1
```

```http
GET https://example.com/comments/1
```

```http
https://example.com/comments/1
```

如果省略方法，默认按 `GET` 处理。

### 2) 查询参数多行写法

```http
GET https://example.com/comments
  ?page=2
  &pageSize=10
```

### 3) 请求头

请求头采用 `field-name: field-value` 形式，每行一个。

### 4) 请求体

请求头和请求体之间用一个空行分隔。

支持直接引用文件作为请求体（`< 路径`）：

```http
POST https://example.com/comments HTTP/1.1
Content-Type: application/xml

< ./demo.xml
```

## 常用设置

- `one-request.followredirect`: 是否自动跟随重定向
- `one-request.strictSSL`: 是否严格校验证书
- `one-request.timeoutinmilliseconds`: 请求超时毫秒数（`0` 表示不超时）
- `one-request.defaultHeaders`: 默认请求头（如 `User-Agent`）
- `one-request.environmentVariables`: 配置环境变量（含 `$shared`）
- `one-request.logLevel`: 日志等级（`error`/`warn`/`info`/`verbose`）

## 变量能力概览

- 环境变量：从扩展设置里读取，支持环境切换
- 文件变量：定义在当前请求文件，便于局部复用
- 请求变量：引用先前请求的响应内容（header/body）
- 提示变量：发送前交互输入，适合一次性参数
- 系统变量：时间戳、GUID、系统环境变量、`.env` 变量等

## 反馈与项目地址

- 仓库主页：https://github.com/huzhihui/one-request
- 问题反馈：https://github.com/huzhihui/one-request/issues

更多完整内容（所有配置与进阶示例）可参考英文文档：[README.md](./README.md)。
