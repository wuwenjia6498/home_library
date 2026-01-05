在手机端访问 /scan 页面时出现了 Next.js Hydration Mismatch 错误。

请执行以下修复：

使用 useEffect 进行挂载检查：在 IsbnScanner 或扫码页面组件中，增加一个 isMounted 状态。只有在 useEffect 执行后（即确认已在客户端挂载）才渲染包含摄像头逻辑和读取 localStorage 的 UI。

禁用 SSR (可选)：如果扫码组件逻辑较重，请尝试使用 next/dynamic 并设置 { ssr: false } 来引入该组件。

检查 HTML 嵌套：确认是否存在非法嵌套（例如在 <p> 标签里放了 <div>），这也会导致此类报错。

修复后请确保 /sc