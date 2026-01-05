'use client'

/**
 * 急速扫码页面
 * 实现连续扫码、队列管理、断点续传等功能
 */

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useScanQueue } from '@/hooks/use-scan-queue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// 使用 dynamic import 禁用 SSR，避免 Hydration Mismatch
const ISBNScanner = dynamic(
  () => import('@/components/scanner/isbn-scanner').then(mod => ({ default: mod.ISBNScanner })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg bg-gray-100 h-64 flex items-center justify-center">
        <p className="text-gray-500">正在加载扫描器...</p>
      </div>
    )
  }
)

export default function ScanPage() {
  const {
    queue,
    scannedCount,
    processingCount,
    successCount,
    queueStatus,
    addToQueue,
    clearQueue,
    startProcessing,
  } = useScanQueue()

  const [showResumeDialog, setShowResumeDialog] = useState(false)
  const [hasCheckedResume, setHasCheckedResume] = useState(false)

  // 页面加载时检查是否有未完成的任务
  useEffect(() => {
    if (!hasCheckedResume && queue.length > 0) {
      const hasPending = queue.some(item => item.status === 'pending')
      if (hasPending) {
        setShowResumeDialog(true)
      }
      setHasCheckedResume(true)
    }
  }, [queue, hasCheckedResume])

  // 监听页面关闭事件
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const pendingCount = queue.filter(item => item.status === 'pending').length
      if (pendingCount > 0) {
        e.preventDefault()
        e.returnValue = `还有 ${pendingCount} 本图书未同步完成，确定要离开吗？`
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [queue])

  // 处理扫描结果
  const handleScan = (isbn: string) => {
    console.log('扫描到 ISBN:', isbn)
    addToQueue(isbn)
  }

  // 继续上次任务
  const handleResumeTask = () => {
    setShowResumeDialog(false)
    startProcessing()
  }

  // 清空并开始新任务
  const handleClearAndStart = () => {
    setShowResumeDialog(false)
    clearQueue()
  }

  // 计算状态
  const pendingCount = queue.filter(item => item.status === 'pending').length
  const failedCount = queue.filter(item => item.status === 'failed').length

  // 状态指示灯
  const getStatusIndicator = () => {
    if (queueStatus === 'error' || failedCount > 0) {
      return { color: 'bg-red-500', text: 'API 请求受限或网络异常', emoji: '🔴' }
    }
    if (queueStatus === 'processing' || processingCount > 0) {
      return { color: 'bg-yellow-500', text: '正在处理队列', emoji: '🟡' }
    }
    return { color: 'bg-green-500', text: '后台空闲，可以继续扫码', emoji: '🟢' }
  }

  const statusIndicator = getStatusIndicator()

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* 头部 */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">急速扫码入库</h1>
          <p className="text-sm text-gray-600 mt-1">
            持续扫描模式，无需每次确认
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 扫描器 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <ISBNScanner
            onScan={handleScan}
            isProcessing={processingCount > 0}
          />

          {/* 状态指示灯 */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <div className={`w-3 h-3 rounded-full ${statusIndicator.color} animate-pulse`} />
            <span className="text-sm text-gray-600">{statusIndicator.text}</span>
          </div>
        </div>

        {/* 实时进度统计 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">实时进度</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{scannedCount}</div>
              <div className="text-sm text-gray-600 mt-1">已扫描</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
              <div className="text-sm text-gray-600 mt-1">正在同步</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{successCount}</div>
              <div className="text-sm text-gray-600 mt-1">成功入库</div>
            </div>
          </div>

          {/* 进度条 */}
          {scannedCount > 0 && (
            <div className="mt-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>整体进度</span>
                <span>{Math.round((successCount / scannedCount) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(successCount / scannedCount) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 队列详情 */}
        {queue.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">扫描队列</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={clearQueue}
                disabled={processingCount > 0}
              >
                清空队列
              </Button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {queue.slice().reverse().map((item) => (
                <div
                  key={item.isbn}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-mono text-sm font-medium text-gray-900">
                      {item.isbn}
                    </div>
                    {item.result && (
                      <div className="text-xs text-gray-600 mt-1">
                        {item.result.message}
                      </div>
                    )}
                  </div>
                  <div>
                    {item.status === 'pending' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                        等待中
                      </span>
                    )}
                    {item.status === 'processing' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        处理中
                      </span>
                    )}
                    {item.status === 'success' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ 成功
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ✗ 失败
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 使用提示 */}
        {scannedCount === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">💡 使用提示</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 摄像头会持续开启，无需每次点击确认</li>
              <li>• 扫描成功后手机会震动反馈</li>
              <li>• 系统会自动以 1.5 秒间隔处理入库</li>
              <li>• 队列会自动保存，关闭页面也不会丢失</li>
            </ul>
          </div>
        )}
      </div>

      {/* 断点续传对话框 */}
      <Dialog open={showResumeDialog} onOpenChange={setShowResumeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发现未完成的任务</DialogTitle>
            <DialogDescription>
              检测到上次有 {queue.filter(item => item.status === 'pending').length} 本图书未同步完成，是否继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleClearAndStart}>
              清空重新开始
            </Button>
            <Button onClick={handleResumeTask}>
              继续上次任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
