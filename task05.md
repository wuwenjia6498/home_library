“核心逻辑已跑通，现在请开始执行 第四阶段：急速扫码页面 (/scan) 开发。

1. 实现扫描组件 (components/scanner/isbn-scanner.tsx)：

集成 html5-qrcode 库，配置为连续扫描模式。

识别到 ISBN 后立即调用 navigator.vibrate(200) 提供震动反馈，并将 ISBN 推入待处理队列。

2. 编写队列管理逻辑 (hooks/use-scan-queue.ts)：

使用 zustand 管理扫描队列。

持久化保护：每次队列变动必须同步更新至 localStorage。

异步消费：以 1.5 秒为间隔，自动从队列中取出一个 ISBN 调用 handleBookEntry。

3. 构建扫码页面 UI (app/scan/page.tsx)：

扫码框设计：摄像头预览区域，下方放置状态指示灯（🟢/🟡/🔴）。

实时进度条：显示‘已扫描 X | 正在同步 Y | 成功入库 Z’。

断点续传弹窗：页面加载时检测 localStorage 任务，若有未完成任务则弹出 shadcn/ui 的 Dialog 询问用户是否恢复。

安全退出：实现 beforeunload 监听，若队列不为空，阻止窗口关闭并弹出警告。

请在完成后告诉我，我们将进入最后的第五阶段：异常处理中心的搭建。”