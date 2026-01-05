太棒了！Vercel 部署成功，摄像头已能正常预览。但目前存在两个问题：没有视觉对焦框，且无法识别条形码。

请执行以下修复与优化：

添加视觉扫描框 (qrbox)：在 Html5Qrcode 的配置中添加 qrbox 参数。建议设置一个长方形区域（如：width: 280, height: 180），并在 CSS 中添加一个移动的“激光线”动画，作为用户的对焦参考。

强制一维码识别：在启动扫描时，将 formatsToSupport 明确设置为 [ Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8 ]。ISBN 条形码属于 EAN 格式，这样做能极大地提升识别速度。

优化分辨率：在相机约束（constraints）中，尝试请求较高的分辨率（如 ideal: 1280x720），以确保条形码清晰。

增加识别成功反馈：确认扫描成功后的 navigator.vibrate(200) 逻辑已生效，让用户知道‘嘀’的一声已经完成了。

修复完成后请通知我，我将进行 1000 本书录入前的最后压力测试。”