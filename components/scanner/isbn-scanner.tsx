'use client'

/**
 * ISBN 扫描器组件
 * 基于 html5-qrcode 的 Html5QrcodeScanner 实现
 * 使用更高级的封装，兼容性更好
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode'

interface ISBNScannerProps {
  onScan: (isbn: string) => void
  isProcessing?: boolean
}

export function ISBNScanner({ onScan, isProcessing = false }: ISBNScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [lastDetected, setLastDetected] = useState<string>('')
  const [scanStatus, setScanStatus] = useState<string>('初始化中...')
  const lastScannedRef = useRef<string>('')
  const lastScanTimeRef = useRef<number>(0)
  const onScanRef = useRef(onScan)

  // 保持 onScan 引用最新
  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  // 处理扫描成功
  const handleScanSuccess = useCallback((decodedText: string) => {
    console.log('🔍 扫描到内容:', decodedText)
    setLastDetected(decodedText)

    // 验证 ISBN 格式
    const isbn = decodedText.replace(/[^0-9X]/gi, '').toUpperCase()

    if (isbn.length !== 10 && isbn.length !== 13) {
      console.log('⚠️ 非 ISBN 格式，长度:', isbn.length)
      setScanStatus(`检测到: ${decodedText} (非ISBN)`)
      return
    }

    // 防止重复扫描
    const now = Date.now()
    if (isbn === lastScannedRef.current && now - lastScanTimeRef.current < 2000) {
      return
    }

    lastScannedRef.current = isbn
    lastScanTimeRef.current = now

    console.log('✅ 识别成功! ISBN:', isbn)
    setScanStatus(`✅ 识别成功: ${isbn}`)

    // 触发震动反馈
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(200)
      } catch (e) {
        console.log('震动功能不可用')
      }
    }

    onScanRef.current(isbn)
  }, [])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return

    console.log('📱 初始化 Html5QrcodeScanner...')
    setScanStatus('正在请求摄像头权限...')

    // 使用 Html5QrcodeScanner - 更高级的封装
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 280, height: 150 },
        // 只使用摄像头扫描（不显示文件上传）
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        // 显示切换摄像头按钮
        showTorchButtonIfSupported: true,
        // 默认使用后置摄像头
        defaultZoomValueIfSupported: 1,
        // 视频约束
        videoConstraints: {
          facingMode: 'environment'
        }
      },
      false // verbose
    )

    scannerRef.current = scanner

    // 渲染扫描器
    scanner.render(
      (decodedText, result) => {
        console.log('🎯 Scanner 解码成功:', decodedText, result)
        handleScanSuccess(decodedText)
      },
      (errorMessage) => {
        // 忽略扫描失败的错误（正常情况）
      }
    )

    setScanStatus('摄像头已就绪，请对准条形码')
    console.log('✅ Scanner 渲染完成')

    // 清理函数
    return () => {
      console.log('🧹 清理 Scanner...')
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error)
        scannerRef.current = null
      }
    }
  }, [isMounted, handleScanSuccess])

  return (
    <div className="relative w-full">
      {!isMounted ? (
        <div className="rounded-lg bg-gray-100 h-64 flex items-center justify-center">
          <p className="text-gray-500">正在加载...</p>
        </div>
      ) : (
        <>
          {/* 扫描器容器 */}
          <div 
            id="qr-reader" 
            className="w-full"
          />

          {/* 状态显示 */}
          <div className="mt-3 text-center">
            <p className="text-sm text-gray-600">{scanStatus}</p>
          </div>

          {/* 最后检测结果 */}
          {lastDetected && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-center">
              <span className="text-xs text-blue-700">最后检测: {lastDetected}</span>
            </div>
          )}

          {/* 处理中遮罩 */}
          {isProcessing && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg z-50">
              <div className="bg-white px-4 py-2 rounded-lg shadow-lg">
                <p className="text-sm text-gray-700">处理中...</p>
              </div>
            </div>
          )}

          {/* 使用提示 */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              💡 <strong>提示：</strong>如果摄像头不显示，请点击上方的「Request Camera Permissions」按钮授权
            </p>
          </div>
        </>
      )}
    </div>
  )
}
