'use client'

/**
 * ISBN 扫描器组件
 * 基于 html5-qrcode 实现连续扫描功能
 * 
 * 功能特性：
 * - 支持多种条形码格式（EAN_13, EAN_8, CODE_128, UPC_A）
 * - 视觉扫描框与激光线动画
 * - 识别成功震动反馈
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

interface ISBNScannerProps {
  onScan: (isbn: string) => void
  isProcessing?: boolean
}

// 支持的条形码格式
const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
]

export function ISBNScanner({ onScan, isProcessing = false }: ISBNScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isHttps, setIsHttps] = useState(true)
  const [lastDetected, setLastDetected] = useState<string>('') // 最后检测到的内容
  const lastScannedRef = useRef<string>('')
  const lastScanTimeRef = useRef<number>(0)
  const isInitializingRef = useRef(false)
  const onScanRef = useRef(onScan)

  // 保持 onScan 引用最新
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  // 处理扫描成功
  const handleScanSuccess = useCallback((decodedText: string) => {
    console.log('🔍 扫描到内容:', decodedText)
    setLastDetected(decodedText)

    // 验证 ISBN 格式（10 位或 13 位数字，可能包含 X）
    const isbn = decodedText.replace(/[^0-9X]/gi, '').toUpperCase()

    if (isbn.length !== 10 && isbn.length !== 13) {
      console.log('⚠️ 非 ISBN 格式:', decodedText, '- 长度:', isbn.length)
      return
    }

    // 防止重复扫描（同一个 ISBN 在 2 秒内只处理一次）
    const now = Date.now()
    if (isbn === lastScannedRef.current && now - lastScanTimeRef.current < 2000) {
      console.log('⏭️ 重复扫描，跳过:', isbn)
      return
    }

    lastScannedRef.current = isbn
    lastScanTimeRef.current = now

    console.log('✅ 识别成功! ISBN:', isbn)

    // 触发震动反馈
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(200)
        console.log('📳 震动反馈已触发')
      } catch (e) {
        console.log('震动功能不可用:', e)
      }
    }

    // 调用父组件的回调
    onScanRef.current(isbn)
  }, [])

  // 确保组件已在客户端挂载
  useEffect(() => {
    setIsMounted(true)
    console.log('📱 ISBNScanner 组件已挂载')

    if (typeof window !== 'undefined') {
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost'
      console.log('🔒 环境检测:', {
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        isSecure
      })
      setIsHttps(isSecure)

      if (!isSecure) {
        setError('⚠️ 由于安全限制，摄像头功能需要在 HTTPS 环境下使用。')
      }
    }
  }, [])

  useEffect(() => {
    if (!isMounted || !isHttps || isInitializingRef.current) {
      console.log('⏸️ 跳过扫描器初始化:', { isMounted, isHttps, isInitializing: isInitializingRef.current })
      return
    }

    const initScanner = async () => {
      isInitializingRef.current = true
      console.log('🎥 开始初始化扫描器...')

      try {
        // 清理旧实例
        if (scannerRef.current) {
          try {
            await scannerRef.current.stop()
            scannerRef.current.clear()
          } catch (e) {
            console.log('清理旧扫描器时出错:', e)
          }
          scannerRef.current = null
        }

        // 创建扫描器实例 - 不指定 formatsToSupport，让它支持所有格式
        console.log('🔧 创建 Html5Qrcode 实例（支持所有格式）...')
        const scanner = new Html5Qrcode('qr-reader', {
          verbose: false
        })
        scannerRef.current = scanner

        console.log('🚀 正在启动扫描器...')

        // 获取视频容器宽度来计算合适的扫描框
        const container = document.getElementById('qr-reader')
        const containerWidth = container?.clientWidth || 300

        // 扫描框宽度为容器的 80%，高度为宽度的 50%（适合条形码）
        const qrboxWidth = Math.floor(containerWidth * 0.8)
        const qrboxHeight = Math.floor(qrboxWidth * 0.5)

        console.log('📐 扫描框尺寸:', { qrboxWidth, qrboxHeight, containerWidth })

        // 启动扫描器 - 使用最基本的配置
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: qrboxWidth, height: qrboxHeight }
          },
          (decodedText, result) => {
            console.log('🎯 解码成功:', { 
              text: decodedText, 
              format: result?.result?.format?.formatName || 'unknown'
            })
            handleScanSuccess(decodedText)
          },
          () => {
            // 扫描失败回调 - 忽略
          }
        )

        console.log('✅ 扫描器启动成功！')
        setIsScanning(true)
        setError(null)
      } catch (err) {
        console.error('❌ 扫描器初始化失败!', err)

        let errorMessage = '无法启动摄像头'
        if (err instanceof Error) {
          if (err.message.includes('Permission') || err.message.includes('NotAllowedError')) {
            errorMessage = '📷 摄像头权限被拒绝，请在浏览器设置中允许访问摄像头'
          } else if (err.message.includes('NotFoundError')) {
            errorMessage = '📷 未检测到摄像头设备'
          } else if (err.message.includes('NotReadableError')) {
            errorMessage = '📷 摄像头正在被其他应用使用'
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

    initScanner()

    // 清理函数
    return () => {
      console.log('🧹 组件卸载，清理扫描器...')
      if (scannerRef.current && !isInitializingRef.current) {
        const scanner = scannerRef.current
        scannerRef.current = null
        scanner.stop().then(() => {
          scanner.clear()
          setIsScanning(false)
        }).catch(console.error)
      }
    }
  }, [isMounted, isHttps, handleScanSuccess])

  return (
    <div className="relative w-full">
      {!isMounted ? (
        <div className="rounded-lg bg-gray-100 h-64 flex items-center justify-center">
          <p className="text-gray-500">正在初始化摄像头...</p>
        </div>
      ) : (
        <>
          {/* 扫描器容器 - 让 html5-qrcode 完全控制显示 */}
          <div 
            id="qr-reader" 
            className="w-full rounded-lg overflow-hidden"
            style={{ minHeight: '300px' }}
          />

          {/* 最后检测到的内容 */}
          {lastDetected && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-center">
              <span className="text-xs text-green-600">最后检测: {lastDetected}</span>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-600 text-sm">{error}</div>
            </div>
          )}

          {/* 扫描状态提示 */}
          {isScanning && !error && (
            <div className="mt-4 text-center text-sm text-gray-600">
              <p>📷 摄像头已就绪，请对准图书背面的 ISBN 条形码</p>
              <p className="mt-1 text-xs text-gray-500">
                将条形码放入扫描框内，保持稳定
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
