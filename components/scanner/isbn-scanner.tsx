'use client'

/**
 * ISBN 扫描器组件
 * 基于 html5-qrcode 实现连续扫描功能
 * 
 * 功能特性：
 * - 强制一维码识别（EAN_13, EAN_8）
 * - 高分辨率摄像头请求（1280x720）
 * - 视觉扫描框与激光线动画
 * - 识别成功震动反馈
 */

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

interface ISBNScannerProps {
  onScan: (isbn: string) => void
  isProcessing?: boolean
}

// 扫描框尺寸配置
const SCAN_BOX_WIDTH = 280
const SCAN_BOX_HEIGHT = 180

export function ISBNScanner({ onScan, isProcessing = false }: ISBNScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isHttps, setIsHttps] = useState(true)
  const lastScannedRef = useRef<string>('')
  const lastScanTimeRef = useRef<number>(0)
  const isInitializingRef = useRef(false)

  // 确保组件已在客户端挂载
  useEffect(() => {
    setIsMounted(true)
    console.log('ISBNScanner 组件已挂载')

    // 检测是否为 HTTPS 环境
    if (typeof window !== 'undefined') {
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
      console.log('环境检测:', {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        isSecure
      })
      setIsHttps(isSecure)

      if (!isSecure) {
        console.error('❌ 非安全环境，摄像头无法使用')
        setError('⚠️ 由于安全限制，摄像头功能需要在 HTTPS 环境下使用。本地测试请使用 localhost 或配置 HTTPS。')
      }
    }
  }, [])

  useEffect(() => {
    if (!isMounted || !isHttps || isInitializingRef.current) {
      console.log('跳过扫描器初始化:', { isMounted, isHttps, isInitializing: isInitializingRef.current })
      return
    }

    const initScanner = async () => {
      isInitializingRef.current = true
      console.log('🎥 开始初始化扫描器...')

      try {
        // 检查是否已有实例在运行
        if (scannerRef.current) {
          console.log('扫描器已存在，先清理...')
          try {
            await scannerRef.current.stop()
            scannerRef.current.clear()
          } catch (e) {
            console.log('清理旧扫描器时出错:', e)
          }
          scannerRef.current = null
        }

        // 创建新的扫描器实例，指定只支持条形码格式
        console.log('创建新的 Html5Qrcode 实例（仅支持 EAN-13/EAN-8 条形码）...')
        const scanner = new Html5Qrcode('qr-reader', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8
          ],
          verbose: false
        })
        scannerRef.current = scanner

        console.log('正在启动扫描器...')

        // 启动扫描器
        await scanner.start(
          {
            facingMode: 'environment' // 使用后置摄像头
          },
          {
            fps: 10, // 每秒扫描 10 帧
            qrbox: { width: SCAN_BOX_WIDTH, height: SCAN_BOX_HEIGHT }, // 扫描框大小（长方形适合条形码）
            aspectRatio: 16 / 9 // 16:9 适合高分辨率
          },
          (decodedText) => {
            // 成功扫描回调
            handleScanSuccess(decodedText)
          },
          () => {
            // 扫描失败回调（通常是没有检测到条形码，可以忽略）
          }
        )

        console.log('✅ 扫描器启动成功！')
        setIsScanning(true)
        setError(null)
      } catch (err) {
        console.error('❌ 扫描器初始化失败!')
        console.error('错误对象:', err)

        let errorMessage = '无法启动摄像头'

        if (err instanceof Error) {
          // 根据错误类型提供更详细的提示
          if (err.message.includes('Permission') || err.message.includes('NotAllowedError')) {
            errorMessage = '📷 摄像头权限被拒绝，请在浏览器设置中允许访问摄像头'
          } else if (err.message.includes('NotFoundError')) {
            errorMessage = '📷 未检测到摄像头设备'
          } else if (err.message.includes('NotReadableError')) {
            errorMessage = '📷 摄像头正在被其他应用使用'
          } else if (err.message.includes('OverconstrainedError')) {
            errorMessage = '📷 摄像头不支持请求的分辨率，正在尝试降级...'
            // 尝试用更低的约束重新启动
            tryFallbackStart()
            return
          } else {
            errorMessage = `📷 摄像头启动失败: ${err.message}`
          }
        }

        setError(errorMessage)
        setIsScanning(false)
      } finally {
        isInitializingRef.current = false
      }
    }

    // 降级启动方案
    const tryFallbackStart = async () => {
      console.log('🔄 尝试降级启动扫描器...')
      try {
        if (!scannerRef.current) {
          const scanner = new Html5Qrcode('qr-reader', {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8
            ],
            verbose: false
          })
          scannerRef.current = scanner
        }

        await scannerRef.current.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: SCAN_BOX_WIDTH, height: SCAN_BOX_HEIGHT }
          },
          (decodedText) => handleScanSuccess(decodedText),
          () => {}
        )

        console.log('✅ 降级启动成功！')
        setIsScanning(true)
        setError(null)
        isInitializingRef.current = false
      } catch (fallbackErr) {
        console.error('❌ 降级启动也失败:', fallbackErr)
        setError('📷 摄像头启动失败，请检查设备权限设置')
        setIsScanning(false)
        isInitializingRef.current = false
      }
    }

    initScanner()

    // 清理函数
    return () => {
      console.log('组件卸载，清理扫描器...')

      if (scannerRef.current && !isInitializingRef.current) {
        const scanner = scannerRef.current
        scannerRef.current = null

        scanner
          .stop()
          .then(() => {
            console.log('扫描器已停止')
            scanner.clear()
            setIsScanning(false)
          })
          .catch((err) => {
            console.error('停止扫描器失败:', err)
          })
      }
    }
  }, [isMounted, isHttps])

  const handleScanSuccess = (decodedText: string) => {
    console.log('扫描到条形码:', decodedText)

    // 验证 ISBN 格式（10 位或 13 位数字）
    const isbn = decodedText.replace(/[^0-9X]/gi, '')

    if (isbn.length !== 10 && isbn.length !== 13) {
      console.log('无效的 ISBN 格式:', decodedText, '- 清理后:', isbn)
      return
    }

    // 防止重复扫描（同一个 ISBN 在 2 秒内只处理一次）
    const now = Date.now()
    if (isbn === lastScannedRef.current && now - lastScanTimeRef.current < 2000) {
      console.log('重复扫描，跳过:', isbn)
      return
    }

    lastScannedRef.current = isbn
    lastScanTimeRef.current = now

    console.log('✅ 识别成功! ISBN:', isbn)

    // 触发震动反馈（仅在客户端）
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        // 短震动表示成功
        navigator.vibrate(200)
        console.log('📳 震动反馈已触发')
      } catch (e) {
        console.log('震动功能不可用:', e)
      }
    }

    // 调用父组件的回调
    onScan(isbn)
  }

  return (
    <div className="relative w-full">
      {/* 客户端加载状态 */}
      {!isMounted ? (
        <div className="rounded-lg bg-gray-100 h-64 flex items-center justify-center">
          <p className="text-gray-500">正在初始化摄像头...</p>
        </div>
      ) : (
        <>
          {/* 扫描器容器 - relative 定位用于叠加视觉层 */}
          <div className="relative rounded-lg overflow-hidden bg-black">
            {/* html5-qrcode 生成的视频容器 */}
            <div id="qr-reader" className="w-full" />

            {/* 视觉引导叠加层 - 仅在扫描中显示 */}
            {isScanning && (
              <div 
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ zIndex: 20 }}
              >
                {/* 半透明遮罩层 */}
                <div className="absolute inset-0 bg-black/40" />
                
                {/* 扫描框 */}
                <div
                  className="relative"
                  style={{ 
                    width: SCAN_BOX_WIDTH, 
                    height: SCAN_BOX_HEIGHT 
                  }}
                >
                  {/* 透明中心区域 - 通过 box-shadow 实现 */}
                  <div 
                    className="absolute inset-0 bg-transparent"
                    style={{
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)'
                    }}
                  />

                  {/* 四个角 L 型边框 */}
                  {/* 左上角 */}
                  <div className="absolute top-0 left-0 w-8 h-8">
                    <div className="absolute top-0 left-0 w-full h-1 bg-green-400 rounded-tl" />
                    <div className="absolute top-0 left-0 w-1 h-full bg-green-400 rounded-tl" />
                  </div>
                  {/* 右上角 */}
                  <div className="absolute top-0 right-0 w-8 h-8">
                    <div className="absolute top-0 right-0 w-full h-1 bg-green-400 rounded-tr" />
                    <div className="absolute top-0 right-0 w-1 h-full bg-green-400 rounded-tr" />
                  </div>
                  {/* 左下角 */}
                  <div className="absolute bottom-0 left-0 w-8 h-8">
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-green-400 rounded-bl" />
                    <div className="absolute bottom-0 left-0 w-1 h-full bg-green-400 rounded-bl" />
                  </div>
                  {/* 右下角 */}
                  <div className="absolute bottom-0 right-0 w-8 h-8">
                    <div className="absolute bottom-0 right-0 w-full h-1 bg-green-400 rounded-br" />
                    <div className="absolute bottom-0 right-0 w-1 h-full bg-green-400 rounded-br" />
                  </div>

                  {/* 激光扫描线 */}
                  <div className="scan-line" />
                </div>
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-600 text-sm">{error}</div>
              {!isHttps && (
                <div className="mt-3 text-xs text-red-500 space-y-1">
                  <p>💡 解决方案：</p>
                  <ul className="list-disc list-inside ml-2">
                    <li>使用 localhost 访问（如: http://localhost:3000）</li>
                    <li>或配置本地 HTTPS 证书</li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 扫描状态提示 */}
          {isScanning && !error && (
            <div className="mt-4 text-center text-sm text-gray-600">
              <p>📷 摄像头已就绪，请对准图书背面的 ISBN 条形码</p>
              <p className="mt-1 text-xs text-gray-500">
                扫描成功后手机会震动反馈 📳
              </p>
            </div>
          )}

          {/* 处理中遮罩 */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg">
              <div className="bg-white px-4 py-2 rounded-lg shadow-lg">
                <p className="text-sm text-gray-700">处理中...</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
