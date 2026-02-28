# One Request（中文使用指南）

语言： [English](./README.md) | **简体中文**

One Request 是一个 VS Code 扩展：直接在编辑器里编写并发送 HTTP 请求，实时查看响应，适合接口调试、联调和日常开发验证。

## 安装

1. 在 VS Code 按 `F1`
2. 输入 `ext install`
3. 搜索并安装 `one-request`

## 用法总览（GIF）

下面这张动图展示了从编写请求到查看响应的基本流程：

![One Request 使用流程](./images/usage.gif)

## 1. 发送第一个请求

在 `.http` 或 `.rest` 文件中输入：

```http
https://example.com/comments/1
```

也可以使用完整格式（方法 + Header + Body）：

```http
POST https://example.com/comments HTTP/1.1
Content-Type: application/json

{
  "name": "sample",
  "time": "Wed, 21 Oct 2015 18:27:50 GMT"
}
```

发送方式：

- 点击请求上方 `Send Request`
- 快捷键 `Ctrl+Alt+R`（macOS: `Cmd+Alt+R`）
- 右键选择 `Send Request`
- `F1` 执行 `One Request: Send Request`

## 2. 在一个文件里管理多个请求

使用 `###` 分隔多个请求块，把光标放到目标块内即可发送：

```http
GET https://example.com/comments/1

###

GET https://example.com/topics/1
```

## 3. 发送 cURL 命令（截图）

可直接在编辑器执行 cURL 命令，适合复制现有 API 调试命令快速验证：

![发送 cURL 请求](./images/curl-request.png)

## 4. 查看请求历史（截图）

扩展会自动记录请求历史，便于回放与排错：

![请求历史](./images/request-history.png)

常用命令：

- `One Request: Request History`
- `One Request: Clear Request History`

## 5. 保存响应（GIF）

在响应预览右上角可以保存完整响应或仅保存响应体：

![保存响应](./images/response.gif)

## 6. 生成代码片段（GIF）

把当前请求一键转换为不同语言/库的调用代码（如 Python、JavaScript）：

![生成代码片段](./images/code-snippet.gif)

快捷方式：`Ctrl+Alt+C`（macOS: `Cmd+Alt+C`）。

## 7. HTTP 语言支持（截图）

提供语法高亮、自动补全、CodeLens、注释支持等能力：

![HTTP 语言支持](./images/http.png)

默认会自动识别：

1. `.http` / `.rest` 文件
2. 首行符合标准 HTTP 请求行格式的文件

## 8. 快速符号导航（截图）

可使用 VS Code 的符号能力快速跳转请求与变量定义：

![请求符号导航](./images/navigate.png)

快捷键：`Ctrl+Shift+O`（macOS: `Cmd+Shift+O`）。

## 常用语法速查

请求行（省略方法默认 `GET`）：

```http
GET https://example.com/comments/1 HTTP/1.1
```

多行查询参数：

```http
GET https://example.com/comments
  ?page=2
  &pageSize=10
```

引用文件作为请求体：

```http
POST https://example.com/comments HTTP/1.1
Content-Type: application/xml

< ./demo.xml
```

## 常用配置

- `one-request.followredirect`: 是否自动跟随重定向
- `one-request.strictSSL`: 是否严格校验证书
- `one-request.timeoutinmilliseconds`: 超时（毫秒，`0` 表示不超时）
- `one-request.defaultHeaders`: 默认请求头
- `one-request.environmentVariables`: 环境变量（含 `$shared`）
- `one-request.logLevel`: 日志等级

## 项目地址

- 仓库：https://github.com/huzhihui/one-request
- 问题反馈：https://github.com/huzhihui/one-request/issues

完整高级功能（认证、变量系统、GraphQL、SOAP 等）请参考英文文档：[README.md](./README.md)。
