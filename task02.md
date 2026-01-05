我已准备好 Supabase 凭证。请开始执行 第二阶段：环境安装与框架搭建：

1. 环境配置： 请创建 .env.local 文件并填入以下内容：
NEXT_PUBLIC_SUPABASE_URL=https://kukkvztacilluzsfpcvm.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_wSC8HLr611W5-PgnJhMNMA_Bwmqd-ua JUHE_BOOK_API_KEY=JUHE_BOOK_API_KEY=4f6cc4a9475bbf68e539cb0b4906cdb9


2. 依赖安装： 请在终端运行命令安装核心依赖：@supabase/supabase-js, html5-qrcode, zustand, lucide-react, sonner, react-hook-form, zod, @hookform/resolvers。

3. UI 初始化：

按照 prd.md 4.1 节要求初始化 shadcn/ui。

安装组件：button, dialog, input, table, card, badge。

4. 核心骨架搭建：

编写 lib/supabase.ts 配置客户端连接。

创建基础路由目录及占位页面：/ (首页), /scan (扫码页), /admin/exceptions (异常管理页)。

配置 layout.tsx 引入 sonner 的 <Toaster /> 组件以支持全局消息提醒。

完成上述任务并确保项目能通过 npm run dev 正常启动后请告诉我，我们将进入第三阶段：编写核心入库逻辑。”