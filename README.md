# git.ropean.org

Cloudflare Worker 镜像代理，将 `git.ropean.org` 的请求转发到 `ropean.github.io`，并原样返回所有内容。

## 项目结构

```
├── src/
│   └── index.js          # Worker 主代码
├── test/
│   ├── index.test.js     # 单元测试
│   └── mirror-test.sh    # 集成测试脚本
├── wrangler.toml         # Cloudflare Wrangler 配置
├── package.json          # npm 配置
└── README.md
```

## 功能特点

- 完整代理 `ropean.github.io` 的所有内容
- 自动处理重定向，保持域名一致性
- 透明传递所有 HTTP 方法和请求体
- 保留原始响应头和状态码

## 部署步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

### 3. 部署 Worker

```bash
npm run deploy
```

### 4. 绑定自定义域名

部署完成后，在 Cloudflare Dashboard 中绑定域名：

1. 进入 **Workers & Pages**
2. 选择 `git-ropean-org` Worker
3. 点击 **Settings** -> **Triggers**
4. 在 **Custom Domains** 部分点击 **Add Custom Domain**
5. 输入 `git.ropean.org`
6. 点击 **Add Custom Domain** 完成绑定

> 注意：确保 `ropean.org` 域名已添加到你的 Cloudflare 账户中。

## 本地开发

启动本地开发服务器：

```bash
npm run dev
```

## 运行测试

### 单元测试

```bash
npm test
```

单元测试覆盖以下功能：
- 请求代理到正确的源站点
- 路径和查询参数保留
- 重定向 URL 重写
- 错误处理
- 响应头处理

### 集成测试

测试源站点连通性：

```bash
npm run test:source
```

测试本地开发服务器（需先运行 `npm run dev`）：

```bash
npm run test:integration
```

## 查看日志

实时查看 Worker 日志：

```bash
npm run tail
```

## 配置说明

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 源站点 | `ropean.github.io` | 被镜像的源网站 |
| 目标域名 | `git.ropean.org` | 镜像站点域名 |
| Worker 名称 | `git-ropean-org` | Cloudflare Worker 名称 |

## License

MIT
