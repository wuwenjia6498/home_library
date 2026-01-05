Vercel 部署失败，报出 TypeScript 类型错误：Type error: Parameter 'state' implicitly has an 'any' type。

请执行以下修复：

打开 hooks/use-scan-queue.ts 文件。

确保你的 Zustand create 函数使用了泛型接口，例如 create<ScanState>((set) => ...)。

如果已经使用了泛型，请在第 184 行的 set 回调函数中，显式地为 state 标注类型，例如：set((state: ScanState) => ({ ... }))。

同时检查该文件中其他类似的 set 调用，确保所有 state 参数都有明确的类型标注。

修复后请确认本地运行 npm run build 是否能成功通过类型检查。