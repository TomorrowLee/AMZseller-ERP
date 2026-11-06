# LeeJan ERP · 跨境进销存

面向跨境电商卖家的进销存项目，围绕采购、销售和多仓库存管理。

## 已实现的后端功能

- 商品与 SKU 管理，支持批量导入。
- 供应商、客户和仓库管理，预设国内仓、FBA 仓和海外仓。
- 采购、销售和调拨单据，支持审核、草稿作废、调拨发运与到仓确认。
- 库存数量和成本核算，以及采购付款、销售收款和未结余额管理。
- 使用 Cloudflare D1 持久化工作区数据，并通过版本校验避免并发覆盖。

当前首页为占位页。现有业务逻辑通过 `/api/erp` 接口提供。

## 本地运行

需要 Node.js 22.13 或更新版本，以及项目 `package.json` 指定的 pnpm 版本。

```sh
pnpm install --frozen-lockfile --ignore-scripts
node scripts/run-framework.mjs build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_init_erp.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/state --ip 127.0.0.1 --inspector-port 0
```

初始化脚本只需对新建的本地数据库执行一次。启动后可在 Wrangler 输出的本地地址访问 `/api/erp`。

## 源码入口

- `lib/erp.ts` 存放业务规则。
- `app/api/erp/route.ts` 提供数据读取与业务操作接口。
- `db/schema.ts` 和 `drizzle/` 定义数据库结构与迁移。

接口的访问权限由部署环境控制。部署时请将业务数据放在具备身份验证与访问限制的环境中。
