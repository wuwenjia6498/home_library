# 家庭图书管理系统 (HomeLibrary) 完整产品需求文档 (PRD)

## 1. 项目概述
这是一个基于 Web 的家庭图书管理系统，支持多终端访问。核心目标是利用手机扫码功能，快速实现家庭藏书的数字化。特别优化了“急速录入模式”，以支持初始化时 1000+ 册图书的快速入库。

---

## 2. 核心业务逻辑 (Core Logic)
当系统识别到一个 ISBN 码时，执行以下自动化逻辑：
1. **查重校验**：检索数据库 `books` 表中的 `isbn` 字段。
2. **存量更新**：若 ISBN 已存在，将该记录的 `quantity` (持有数量) 字段自动 **+1**。
3. **新书入库**：若 ISBN 不存在：
   - 调用第三方 API (聚合数据 / ShowAPI) 获取图书元数据。
   - 抓取信息：书名、作者、出版社、封面 URL、内容简介。
   - 在数据库中新建记录，`quantity` 初始值为 1。

---

## 3. 功能模块设计

### 3.1 急速录入模式 (Rapid Entry Mode)
* **交互设计**：
    - 摄像头保持持续开启状态，无需每扫一本都点击确认。
    - 成功识别 ISBN 后，手机触发短震动反馈。
    - 识别到的 ISBN 立即进入前端"待处理队列"。
* **异步处理队列**：
    - 前端维护一个内存队列，以约 1.5 秒/条的频率异步发送请求。
    - **队列持久化**：同步中的 `scanQueue` 同步备份至浏览器的 `localStorage`，防止浏览器崩溃或手机关机导致数据丢失。
    - **断点续传**：重新打开扫码页面时，系统检测 `localStorage` 中是否有未完成任务，若有则提示："发现上次未完成的任务，是否继续同步？"。
    - **实时状态栏**：显示"已扫描 X 本 | 正在同步 Y 本 | 成功入库 Z 本"。
    - **状态指示灯**：在扫码框下方增加状态点视觉反馈：
        - 🟢 绿色：后台空闲，可以继续扫码
        - 🟡 黄色：正在处理队列
        - 🔴 红色：API 请求受限或网络异常
* **异常保护机制**：
    - **核心原则**：在高吞吐量扫码场景下，"不中断扫描"是最高优先级，所有异常均不应阻断扫码流程。
    - **影子记录策略**：若 API 返回 null、404 或网络超时，系统自动在数据库中创建"影子记录"：
        - 状态标记为 `is_pending = true`
        - 书名默认为 "未识别图书 (ISBN: xxxx)"
        - 保留 ISBN 和扫描时间，确保"凡扫过，必留下记录"
    - **用户提醒**：首页或侧边栏显示红色气泡提醒："有 X 本图书信息不完整，请处理"。

### 3.2 图书展示与管理
* **多端适配**：
    - **移动端**：主打扫码功能，列表采用紧凑型卡片设计。
    - **PC 端**：采用响应式网格 (Grid) 布局，支持通过书名、作者或 ISBN 全局搜索。
* **数据字段**：展示完整的书籍元数据及当前持有本数。

### 3.3 异常处理与数据补全 (Exception Management)
* **设计目的**：
    - **确保数据闭环**：在 1000+ 本书的初始化中，老书、内部资料或外版书等 API 可能查不到，该页面保证所有扫码动作都有记录。
    - **异步处理**：扫描时专注扫码，全部扫完后统一处理无法自动识别的图书，提升整体效率。

* **页面位置**：`/admin/exceptions` 或 `/pending`

* **核心功能**：
    1. **列表展示**：展示所有 API 抓取失败的条目，包含：
        - ISBN 码（唯一识别线索）
        - 扫描时间
        - 失败原因（例如：API 无结果、网络超时、API 额度耗尽）
        - 当前状态标识
        - 数据来源标识（`source` 字段）
    
    2. **快速定位**：
        - **ISBN 直接搜索**：提供搜索框，用户手持图书时可直接输入 ISBN 快速定位到对应异常记录。
        - **筛选功能**：按失败原因、扫描时间进行筛选。
    
    3. **三种操作选项**：
        - **[重新同步]**：适用于网络波动或临时故障，一键重新调用 API 抓取（支持多级 Fallback 策略）。
        - **[手动录入]**：弹出表单，允许用户手动输入书名、作者、出版社等信息：
            - **移动端优化**：直接调起手机相机拍照作为封面，提升录入效率。
            - **PC 端**：支持上传本地图片或输入图片 URL。
            - 封面图片自动存储至 Supabase Storage。
        - **[删除]**：用于误扫或无效 ISBN 的清理。
    
    4. **批量操作**：支持勾选多条记录，批量重新同步或批量删除。

* **状态流转**：
    - 手动录入或重新同步成功后，`is_pending` 状态自动转为 `false`，图书正式进入书架展示。
    - 处理完成后，首页的红色提醒气泡消失。

---

## 4. 技术方案与数据结构

### 4.1 技术栈 (Tech Stack)
- **框架**：Next.js 14+ (App Router)
- **UI**：Tailwind CSS + shadcn/ui
- **数据库**：Supabase (PostgreSQL)
- **文件存储**：Supabase Storage（用于用户上传的封面图片）
- **扫码库**：html5-qrcode
- **数据源（多级 Fallback 策略）**：
    1. **优先级 1**：聚合数据 / ShowAPI（商业 API，数据质量高）
    2. **优先级 2**：Google Books API（免费，覆盖面广）
    3. **最终方案**：创建影子记录，标记为 `is_pending = true`

### 4.2 数据库表结构 (Supabase SQL)
```sql
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  isbn VARCHAR UNIQUE NOT NULL,      -- ISBN 码，唯一索引用于查重
  title VARCHAR NOT NULL,            -- 书名
  author VARCHAR,                    -- 作者
  publisher VARCHAR,                 -- 出版社
  cover_url TEXT,                    -- 封面图链接（API 返回的外链或 Supabase Storage 路径）
  summary TEXT,                      -- 简介
  quantity INTEGER DEFAULT 1,        -- 持有本数
  source VARCHAR DEFAULT 'api',      -- 数据来源：'api'（自动抓取）/ 'manual'（手动录入）
  is_pending BOOLEAN DEFAULT false,  -- 待处理状态：true 表示信息不完整需要人工处理
  error_reason VARCHAR,              -- 失败原因记录（API无结果/网络超时/额度耗尽等）
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),  -- 首次扫描时间
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()   -- 最后更新时间
);

-- 为待处理状态创建索引，加速异常列表查询
CREATE INDEX idx_books_pending ON books(is_pending) WHERE is_pending = true;

-- 为 ISBN 创建索引，加速查重和搜索
CREATE INDEX idx_books_isbn ON books(isbn);

## 5. 开发实施指南

### 5.1 基础环境与数据库初始化

- 基于 PRD 要求，使用 Next.js + shadcn/ui 初始化项目。
- 连接 Supabase，并根据前述 SQL 建立 `books` 表。

### 5.2 入库 Server Action 封装

- 封装 `handleBookEntry` Server Action：
    - 接收 ISBN 参数。
    - 查询数据库：
        - 若已存在，则执行 `quantity = quantity + 1`。
        - 若不存在，执行**多级抓取逻辑**：
            1. **优先调用**：聚合数据 / ShowAPI 接口。
            2. **自动回退**：若无结果，Fallback 至 Google Books API。
            3. **影子记录**：若仍无结果，创建 `is_pending = true` 的记录，书名默认为 "未识别图书 (ISBN: xxxx)"，`source = 'api'`。
        - 成功获取元数据后插入新记录，`source = 'api'`。
    - 使用环境变量管理 API Key。

- 封装 `fetchBookMetadata` 函数：
    - 实现多级 API 调用逻辑（聚合数据 → Google Books）。
    - 统一返回格式：`{ title, author, publisher, cover_url, summary }`。
    - 封面图片处理：
        - API 返回的图片链接直接存储为 `cover_url`。
        - 后续若外链失效，可在详情页提供"重新抓取"或"手动替换"功能。

### 5.3 急速扫码页面开发

- 在 `/scan` 路由下实现急速录入模式：
    - 集成 `html5-qrcode` 实现连续扫码能力。
    - 使用 React 状态管理维护本地扫码队列。
    - **队列持久化实现**：
        - 每次队列变化时，同步更新 `localStorage.setItem('scanQueue', JSON.stringify(queue))`。
        - 页面加载时检测 `localStorage` 中的未完成任务，弹窗询问用户是否继续。
        - 任务全部完成后清空 `localStorage`。
    - 实现后台轮询机制，以 1.5 秒间隔异步处理队列任务，防止 API 限流。
    - **界面反馈**：
        - 底部实时展示"任务完成进度"状态栏。
        - 扫码框下方显示状态指示灯（绿色/黄色/红色）。
    - **异常容错逻辑**：API 调用失败时，创建 `is_pending = true` 的影子记录，记录 `error_reason`，不阻断扫码流程。
    - **页面关闭保护**：监听 `beforeunload` 事件，若队列未处理完毕，弹出提示："还有 X 本图书未同步完成，确定要离开吗？"

### 5.4 封面图片存储策略

- **Supabase Storage 配置**：
    - 创建存储桶 (Bucket)：`book-covers`（公开访问）。
    - 配置文件大小限制：单个文件不超过 5MB。
    - 支持的图片格式：jpg, jpeg, png, webp。

- **上传逻辑封装**：
    - 封装 `uploadCoverImage` 工具函数：
        - 接收 File 对象，上传至 Supabase Storage。
        - 文件命名规则：`{isbn}_{timestamp}.{ext}`，避免重名冲突。
        - 返回公开访问 URL。
    - 集成到手动录入表单中。

- **外链图片处理**（可选进阶）：
    - API 返回的 `cover_url` 直接存储为外链。
    - 在图书详情页增加"重新抓取封面"或"上传本地图片替换"功能。
    - 替换后将新图片上传至 Supabase Storage，更新 `cover_url` 字段。

### 5.5 异常处理页面开发

- 在 `/admin/exceptions` 路由下实现异常管理功能：
    - **数据查询**：从数据库筛选 `is_pending = true` 的所有记录。
    - **快速定位功能**：
        - 提供 ISBN 搜索框，支持精确查找。
        - 提供失败原因筛选下拉框。
    - **列表展示**：使用表格或卡片形式展示 ISBN、扫描时间、失败原因、数据来源。
    - **操作功能实现**：
        - **重新同步**：调用 Server Action，执行多级 API 抓取（聚合数据 → Google Books），成功后更新数据并将 `is_pending` 设为 `false`。
        - **手动录入**：弹出表单对话框（使用 shadcn/ui Dialog 组件）：
            - 表单字段：书名、作者、出版社、简介、封面图片。
            - **移动端**：使用 `<input type="file" accept="image/*" capture="camera">` 直接调起相机拍照。
            - **PC 端**：支持文件上传或输入图片 URL。
            - 图片上传至 Supabase Storage，返回存储路径作为 `cover_url`。
            - 提交后更新记录，设置 `source = 'manual'`，`is_pending = false`。
        - **删除记录**：硬删除待处理条目（已确认为误扫）。
    - **批量操作**：使用复选框支持批量选择和批量操作（批量重新同步、批量删除）。
    - **首页气泡提醒**：在主导航或首页添加红色数字角标，实时显示待处理条目数量（通过 Server Component 查询 `count(*) WHERE is_pending = true`）。

---

## 6. 验收标准 (Definition of Done)

### 6.1 基础扫码功能
- [ ] 手机扫码可识别 10/13 位 ISBN。
- [ ] 扫码已有书籍时，数据库中 `quantity` 字段正确累加。
- [ ] 连续扫码 10 本书，系统异步顺序入库，页面不卡顿。
- [ ] 页面关闭前有"未完成同步"警告提示。
- [ ] 扫码队列自动备份至 `localStorage`，浏览器意外关闭后重新打开，提示"是否继续上次未完成的任务"。
- [ ] 状态指示灯正确显示：绿色（空闲）、黄色（处理中）、红色（异常）。

### 6.2 异常处理与容错
- [ ] API 查询失败时，系统自动创建 `is_pending = true` 的影子记录，不阻断扫码流程。
- [ ] 首页显示待处理图书数量的红色提醒气泡（如：3 本待处理）。
- [ ] 异常处理页面能正确展示所有 `is_pending = true` 的记录，包含 ISBN、扫描时间、失败原因、数据来源。
- [ ] ISBN 搜索框可快速定位到指定的异常记录。
- [ ] "重新同步"功能执行多级 API 调用（聚合数据 → Google Books），成功后自动更新书籍信息并转为正常状态。
- [ ] "手动录入"功能可弹出表单：
    - [ ] 移动端可直接调起相机拍照作为封面。
    - [ ] PC 端可上传本地图片或输入图片 URL。
    - [ ] 图片成功上传至 Supabase Storage，`cover_url` 字段正确更新。
    - [ ] 提交后 `source` 字段标记为 `manual`，`is_pending` 转为 `false`。
- [ ] 批量操作可同时处理多条异常记录（批量重新同步或批量删除）。
- [ ] 所有待处理条目处理完毕后，红色提醒气泡消失。

### 6.3 数据质量与多级抓取
- [ ] 当聚合数据 API 无结果时，系统自动 Fallback 至 Google Books API。
- [ ] 所有图书记录包含正确的 `source` 字段（`api` 或 `manual`）。
- [ ] 外链封面图片失效时，详情页可手动替换并上传至 Supabase Storage。
