“目前测试入库功能失败，报错显示 ‘错误的请求KEY’。请按以下步骤修复：

确认代码读取的是 process.env.JUHE_BOOK_API_KEY。

检查 fetchBookMetadata 逻辑，确保当聚合数据报错时，能够静默进入 Google Books 抓取逻辑，而不是直接抛出错误。

检查 handleBookEntry 逻辑，确认即使两个 API 都查不到结果，也必须按照 PRD 要求在数据库中创建一条 is_pending = true 的影子记录。

修复后，请告知我是否需要重启服务器以生效。”