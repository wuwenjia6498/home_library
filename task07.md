在手机端访问 /scan 时，页面 UI 显示正确但报两个错误：1. Hydration Mismatch；2. 无法启动摄像头。

请执行以下修复：

彻底解决 Hydration 问题：在 IsbnScanner 组件中使用 dynamic(() => import(...), { ssr: false }) 进行引入，或者在组件内部使用 useEffect 配合 mounted 状态，确保所有涉及 window, navigator 或 localStorage 的逻辑只在客户端运行。

完善摄像头错误提示：在扫码失败的 Catch 块中，检测当前环境是否为 https。如果不是，请通过 UI 明确提醒用户：‘由于安全限制，请在 HTTPS 环境下使用扫码功能’。

检查相机初始化逻辑：确保在组件卸载（unmount）时正确调用了 html5QrCode.stop()，防止多次初始化冲突。

修复后，请告诉我如何在本地环境安全地测试摄像头。