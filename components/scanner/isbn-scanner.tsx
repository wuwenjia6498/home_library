'use client'

/**
 * ISBN 扫描器组件
 * 基于 html5-qrcode 实现连续扫描功能
 */

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface ISBNScannerProps {
  onScan: (isbn: string) => void
  isProcessing?: boolean
}

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

        // 创建新的扫描器实例
        console.log('创建新的 Html5Qrcode 实例...')
        const scanner = new Html5Qrcode('qr-reader')
        scannerRef.current = scanner

        console.log('正在启动扫描器...')
        console.log('请求摄像头配置:', {
          facingMode: 'environment',
          advanced: [{ width: { ideal: 1280 }, height: { ideal: 720 } }]
        })
        console.log('扫描器配置:', {
          fps: 10,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.777
        })

        // 启动扫描器
        await scanner.start(
          {
            facingMode: 'environment', // 使用后置摄像头
            advanced: [
              {
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            ]
          },
          {
            fps: 10, // 每秒扫描 10 帧
            qrbox: { width: 280, height: 180 }, // 扫描框大小（长方形适合条形码）
            aspectRatio: 1.777, // 16:9 适合高分辨率
          },
          (decodedText) => {
            // 成功扫描回调
            handleScanSuccess(decodedText)
          },
          (errorMessage) => {
            // 扫描失败回调（通常是没有检测到二维码，可以忽略）
            // console.log('Scan error:', errorMessage)
          }
        )

        console.log('✅ 扫描器启动成功！')
        setIsScanning(true)
        setError(null)
      } catch (err) {
        console.error('❌ 扫描器初始化失败!')
        console.error('错误对象:', err)
        console.error('错误类型:', err instanceof Error ? err.constructor.name : typeof err)

        if (err instanceof Error) {
          console.error('错误消息:', err.message)
          console.error('错误堆栈:', err.stack)
        }

        let errorMessage = '无法启动摄像头'

        if (err instanceof Error) {
          // 根据错误类型提供更详细的提示
          if (err.message.includes('Permission') || err.message.includes('NotAllowedError')) {
            errorMessage = '📷 摄像头权限被拒绝，请在浏览器设置中允许访问摄像头'
            console.error('权限错误: 用户拒绝了摄像头权限')
          } else if (err.message.includes('NotFoundError')) {
            errorMessage = '📷 未检测到摄像头设备'
            console.error('设备错误: 找不到摄像头设备')
          } else if (err.message.includes('NotReadableError')) {
            errorMessage = '📷 摄像头正在被其他应用使用'
            console.error('冲突错误: 摄像头被占用')
          } else {
            errorMessage = `📷 摄像头启动失败: ${err.message}`
            console.error('未知错误:', err.message)
          }
        }

        setError(errorMessage)
        setIsScanning(false)
      } finally {
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
    const isbn = decodedText.replace(/[^0-9]/g, '')

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
          {/* 扫描器容器 */}
          <div className="relative">
            {/* html5-qrcode 生成的视频容器 */}
            <div
              id="qr-reader"
              className="rounded-lg overflow-hidden"
            />
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
