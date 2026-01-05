1. 编写元数据抓取函数 (lib/book-api.ts)：

封装 fetchBookMetadata 函数，实现 prd.md 4.1 节要求的多级 Fallback 策略：

优先调用聚合数据/ShowAPI接口。

若失败或无结果，自动回退至 Google Books API。

统一返回标准化的书籍对象：{ title, author, publisher, cover_url, summary }。

2. 编写入库 Server Action (app/actions/book-actions.ts)：

实现 handleBookEntry 函数，严格遵循 prd.md 2.1 节和 5.2 节的逻辑：

查重：检查数据库中是否存在该 ISBN。

累加：若存在，则 quantity = quantity + 1。

抓取与影子记录：若不存在，调用 fetchBookMetadata。若抓取失败，按影子记录策略创建一条 is_pending = true 的记录，书名设为‘未识别图书 (ISBN: xxxx)’，记录 error_reason。

3. 创建测试页面：

在首页 (app/page.tsx) 临时增加一个简单的输入框和提交按钮，允许手动输入 ISBN 触发上述 Server Action，并在页面上通过 sonner 显示入库结果（成功/重复累加/影子记录生成）。

