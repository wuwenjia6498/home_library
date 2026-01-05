# Next.js 14 App Router 路由结构规划

## 核心路由架构

```
app/
├── (root)/                          # 根路由组（公共布局）
│   ├── layout.tsx                   # 全局布局（导航栏 + 待处理气泡提醒）
│   ├── page.tsx                     # 首页 - 图书展示与搜索
│   ├── books/
│   │   └── [id]/
│   │       └── page.tsx             # 图书详情页（查看/编辑元数据，管理持有数量）
│   └── scan/
│       └── page.tsx                 # 急速扫码页面（核心功能）
│
├── admin/                           # 管理后台路由组
│   ├── layout.tsx                   # 管理后台布局
│   └── exceptions/
│       └── page.tsx                 # 异常处理页面（影子记录管理）
│
├── api/                             # API 路由（Server Actions 备选方案）
│   ├── books/
│   │   ├── route.ts                 # 图书 CRUD API
│   │   └── [isbn]/
│   │       └── route.ts             # 单本图书操作（查重/更新数量）
│   ├── scan/
│   │   └── route.ts                 # 扫码入库 API
│   └── metadata/
│       └── route.ts                 # 图书元数据抓取 API（多级 Fallback）
│
└── actions/                         # Server Actions（推荐方式）
    ├── book-entry.ts                # handleBookEntry - 核心入库逻辑
    ├── metadata-fetch.ts            # fetchBookMetadata - 多级 API 调用
    ├── exception-handler.ts         # 异常记录处理（重新同步/手动录入/删除）
    └── upload-cover.ts              # uploadCoverImage - 封面上传至 Supabase Storage
```

---

## 路由详细说明

### 1. 首页 `/` (Page.tsx)
**功能模块**：
- 图书网格展示（响应式布局，PC 端多列，移动端单列）
- 全局搜索框（支持书名/作者/ISBN 搜索）
- 待处理气泡提醒（红色角标显示 `is_pending = true` 的数量）
- 快速操作按钮（扫码入口、异常管理入口）

**技术实现**：
- Server Component 获取图书列表
- 使用 Supabase Client 查询 `books` 表
- 搜索功能使用 URL 参数 `?q=xxx` 触发服务端过滤
- 待处理数量通过 `count(*) WHERE is_pending = true` 实时查询

**关键组件**：
- `BookGrid.tsx` - 图书卡片网格
- `SearchBar.tsx` - 搜索输入框（带防抖）
- `PendingBadge.tsx` - 红色提醒气泡

---

### 2. 急速扫码页面 `/scan` (Page.tsx)
**功能模块**（PRD 3.1 节核心功能）：
- html5-qrcode 摄像头持续扫描
- 前端扫码队列管理（React State + localStorage 持久化）
- 异步队列处理器（1.5 秒间隔调用 Server Action）
- 实时状态栏：「已扫描 X 本 | 正在同步 Y 本 | 成功入库 Z 本」
- 状态指示灯：🟢 空闲 / 🟡 处理中 / 🔴 异常
- 页面关闭保护（`beforeunload` 事件监听）
- 断点续传提示（检测 localStorage 未完成任务）

**技术实现**：
- Client Component（需要摄像头和状态管理）
- 使用 `html5-qrcode` 库集成扫码功能
- 队列处理逻辑：
  ```typescript
  useEffect(() => {
    const interval = setInterval(() => {
      if (queue.length > 0 && !isProcessing) {
        processNextItem(); // 调用 handleBookEntry Server Action
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [queue, isProcessing]);
  ```
- localStorage 同步：
  ```typescript
  useEffect(() => {
    localStorage.setItem('scanQueue', JSON.stringify(queue));
  }, [queue]);
  ```

**关键组件**：
- `ScannerCamera.tsx` - 摄像头扫描组件
- `ScanQueue.tsx` - 队列状态显示
- `StatusIndicator.tsx` - 状态指示灯

---

### 3. 异常处理页面 `/admin/exceptions` (Page.tsx)
**功能模块**（PRD 3.3 节）：
- 待处理列表展示（`is_pending = true` 的所有记录）
- ISBN 快速搜索框
- 失败原因筛选（下拉框）
- 三种操作按钮：
  - **重新同步**：调用多级 API Fallback
  - **手动录入**：弹出表单（移动端调起相机/PC 端上传文件）
  - **删除记录**：硬删除误扫条目
- 批量操作（复选框 + 批量按钮）

**技术实现**：
- Server Component 获取待处理列表
- 搜索和筛选使用 URL Search Params
- 操作按钮调用 Server Actions：
  - `retryFetchMetadata(isbn)` - 重新同步
  - `manualEntryBook(formData)` - 手动录入
  - `deleteException(id)` - 删除
- 手动录入表单使用 shadcn/ui `Dialog` 组件
- 移动端封面上传：
  ```tsx
  <input type="file" accept="image/*" capture="camera" />
  ```

**关键组件**：
- `ExceptionList.tsx` - 待处理列表
- `ManualEntryDialog.tsx` - 手动录入表单
- `BatchOperations.tsx` - 批量操作工具栏

---

### 4. 图书详情页 `/books/[id]` (Page.tsx)
**功能模块**：
- 完整图书元数据展示
- 持有数量管理（+ / - 按钮）
- 编辑元数据（书名/作者/出版社/简介）
- 封面替换功能（上传本地图片或重新抓取）
- 数据来源标识（`source: api / manual`）

**技术实现**：
- Server Component 获取图书详情
- 更新操作使用 Server Actions
- 封面替换：
  - 调用 `uploadCoverImage` 上传至 Supabase Storage
  - 更新 `cover_url` 字段

---

## Server Actions 模块设计

### `actions/book-entry.ts` - 核心入库逻辑
**函数签名**：
```typescript
export async function handleBookEntry(isbn: string): Promise<{
  success: boolean;
  action: 'updated' | 'created' | 'pending';
  book?: Book;
  error?: string;
}>
```

**执行流程**（PRD 第 2 节核心逻辑）：
1. 查询 `books` 表 WHERE `isbn = ?`
2. **存量更新**：若存在 → `UPDATE SET quantity = quantity + 1`
3. **新书入库**：若不存在 →
   - 调用 `fetchBookMetadata(isbn)` 多级抓取
   - 若成功 → 插入新记录，`source = 'api'`
   - 若失败 → 创建影子记录，`is_pending = true`，书名 = "未识别图书 (ISBN: xxxx)"

---

### `actions/metadata-fetch.ts` - 多级 API Fallback
**函数签名**：
```typescript
export async function fetchBookMetadata(isbn: string): Promise<{
  title: string;
  author?: string;
  publisher?: string;
  cover_url?: string;
  summary?: string;
} | null>
```

**执行流程**（PRD 4.1 节多级策略）：
1. **优先级 1**：调用聚合数据 / ShowAPI
2. **优先级 2**：若无结果，Fallback 至 Google Books API
3. **最终方案**：若仍无结果，返回 `null`（由调用方创建影子记录）

---

### `actions/exception-handler.ts` - 异常记录操作
**函数列表**：
```typescript
// 重新同步
export async function retryFetchMetadata(id: string): Promise<Result>

// 手动录入
export async function manualEntryBook(formData: FormData): Promise<Result>

// 批量删除
export async function batchDeleteExceptions(ids: string[]): Promise<Result>
```

---

### `actions/upload-cover.ts` - 封面上传
**函数签名**：
```typescript
export async function uploadCoverImage(
  file: File,
  isbn: string
): Promise<{ url: string } | null>
```

**实现逻辑**（PRD 5.4 节）：
- 文件命名：`{isbn}_{timestamp}.{ext}`
- 上传至 Supabase Storage Bucket: `book-covers`
- 返回公开访问 URL

---

## 全局布局设计

### `app/(root)/layout.tsx`
**功能**：
- 顶部导航栏（Home / Scan / Admin）
- 待处理气泡提醒（右上角红色角标）
- 响应式侧边栏（移动端汉堡菜单）

**技术实现**：
```tsx
export default async function RootLayout({ children }) {
  const { count } = await supabase
    .from('books')
    .select('*', { count: 'exact', head: true })
    .eq('is_pending', true);

  return (
    <div>
      <Navbar pendingCount={count} />
      <main>{children}</main>
    </div>
  );
}
```

---

## 关键技术决策

### 1. 优先使用 Server Actions
**原因**：
- Next.js 14 官方推荐
- 自动处理 CSRF 保护
- 更好的 TypeScript 类型推断
- 减少 API 路由样板代码

**场景**：
- ✅ 表单提交（手动录入）
- ✅ 数据库写操作（入库/更新/删除）
- ✅ 文件上传（封面图片）
- ❌ 第三方 Webhook（需要使用 API Routes）

### 2. 混合渲染策略
**规则**：
- **Server Component**：列表页、详情页（SEO 友好）
- **Client Component**：扫码页面、交互表单（需要状态管理）

### 3. 数据获取策略
**方式**：
- Server Component 直接调用 Supabase Client
- Client Component 通过 Server Actions 间接操作数据库
- 避免使用 `/api` 路由（除非需要对外暴露接口）

---

## 文件组织最佳实践

```
app/
├── (root)/              # 路由组（共享布局）
├── actions/             # Server Actions（业务逻辑层）
├── components/          # 可复用组件
│   ├── ui/             # shadcn/ui 组件
│   ├── scan/           # 扫码相关组件
│   ├── books/          # 图书相关组件
│   └── admin/          # 管理后台组件
├── lib/                 # 工具函数
│   ├── supabase.ts     # Supabase Client 初始化
│   ├── api-clients/    # 第三方 API 客户端
│   │   ├── juhe.ts
│   │   ├── showapi.ts
│   │   └── google-books.ts
│   └── utils.ts        # 通用工具函数
└── types/
    └── book.ts         # TypeScript 类型定义
```

---

## 下一步实施计划

1. **环境搭建**：
   - 初始化 Next.js 14 项目
   - 安装依赖（Tailwind、shadcn/ui、html5-qrcode）
   - 配置 Supabase Client

2. **数据库初始化**：
   - 在 Supabase 执行 `supabase-schema.sql`
   - 创建 Storage Bucket: `book-covers`

3. **核心功能开发顺序**：
   - ① Server Actions（`handleBookEntry`、`fetchBookMetadata`）
   - ② 急速扫码页面（`/scan`）
   - ③ 首页图书展示（`/`）
   - ④ 异常处理页面（`/admin/exceptions`）
   - ⑤ 图书详情页（`/books/[id]`）

准备就绪后请告知，我们将进入下一阶段：**环境安装与 UI 初始化**。
