'use client'

/**
 * 扫码队列管理 Hook
 * 基于 zustand 实现状态管理和 localStorage 持久化
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { handleBookEntry, BookEntryResult } from '@/app/actions/book-actions'

export interface QueueItem {
  isbn: string
  addedAt: number
  status: 'pending' | 'processing' | 'success' | 'failed'
  result?: BookEntryResult
}

export type QueueStatus = 'idle' | 'processing' | 'error'

interface ScanQueueState {
  // 队列数据
  queue: QueueItem[]

  // 统计数据
  scannedCount: number // 已扫描总数
  processingCount: number // 正在处理数
  successCount: number // 成功入库数
  failedCount: number // 失败数

  // 状态
  queueStatus: QueueStatus

  // 操作方法
  addToQueue: (isbn: string) => void
  removeFromQueue: (isbn: string) => void
  clearQueue: () => void
  startProcessing: () => void
  stopProcessing: () => void
  resetStats: () => void
}

export const useScanQueue = create<ScanQueueState>()(
  persist(
    (set, get) => ({
      // 初始状态
      queue: [],
      scannedCount: 0,
      processingCount: 0,
      successCount: 0,
      failedCount: 0,
      queueStatus: 'idle',

      // 添加到队列
      addToQueue: (isbn: string) => {
        const { queue } = get()

        // 检查是否已存在于队列中
        const exists = queue.some(item => item.isbn === isbn && item.status === 'pending')
        if (exists) {
          console.log('ISBN 已在队列中:', isbn)
          return
        }

        set((state: ScanQueueState) => ({
          queue: [
            ...state.queue,
            {
              isbn,
              addedAt: Date.now(),
              status: 'pending'
            }
          ],
          scannedCount: state.scannedCount + 1
        }))

        // 如果队列处于空闲状态，自动开始处理
        if (get().queueStatus === 'idle') {
          get().startProcessing()
        }
      },

      // 从队列中移除
      removeFromQueue: (isbn: string) => {
        set((state: ScanQueueState) => ({
          queue: state.queue.filter(item => item.isbn !== isbn)
        }))
      },

      // 清空队列
      clearQueue: () => {
        set({
          queue: [],
          scannedCount: 0,
          processingCount: 0,
          successCount: 0,
          failedCount: 0,
          queueStatus: 'idle'
        })
      },

      // 重置统计数据
      resetStats: () => {
        set({
          scannedCount: 0,
          processingCount: 0,
          successCount: 0,
          failedCount: 0
        })
      },

      // 开始处理队列
      startProcessing: async () => {
        const { queue, queueStatus } = get()

        // 如果已经在处理中，跳过
        if (queueStatus === 'processing') {
          return
        }

        // 如果队列为空，停止处理
        if (queue.length === 0) {
          set({ queueStatus: 'idle' })
          return
        }

        set({ queueStatus: 'processing' })

        // 处理队列
        await processQueue(set, get)
      },

      // 停止处理
      stopProcessing: () => {
        set({ queueStatus: 'idle' })
      }
    }),
    {
      name: 'scan-queue-storage', // localStorage key
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {}
      })),
      // 只持久化队列和统计数据，不持久化状态
      partialize: (state) => ({
        queue: state.queue,
        scannedCount: state.scannedCount,
        processingCount: state.processingCount,
        successCount: state.successCount,
        failedCount: state.failedCount
      })
    }
  )
)

/**
 * 异步处理队列
 * 以 1.5 秒间隔依次处理队列中的 ISBN
 */
async function processQueue(
  set: (partial: Partial<ScanQueueState> | ((state: ScanQueueState) => Partial<ScanQueueState>)) => void,
  get: () => ScanQueueState
) {
  while (true) {
    const { queue, queueStatus } = get()

    // 如果停止处理或队列为空，退出循环
    if (queueStatus !== 'processing' || queue.length === 0) {
      set({ queueStatus: 'idle', processingCount: 0 })
      break
    }

    // 找到第一个待处理的项目
    const pendingItem = queue.find(item => item.status === 'pending')

    if (!pendingItem) {
      // 没有待处理的项目，退出循环
      set({ queueStatus: 'idle', processingCount: 0 })
      break
    }

    // 标记为处理中
    set((state: ScanQueueState) => ({
      queue: state.queue.map(item =>
        item.isbn === pendingItem.isbn
          ? { ...item, status: 'processing' as const }
          : item
      ),
      processingCount: 1
    }))

    try {
      // 调用 Server Action 处理入库
      const result = await handleBookEntry(pendingItem.isbn)

      // 更新结果
      set((state: ScanQueueState) => ({
        queue: state.queue.map(item =>
          item.isbn === pendingItem.isbn
            ? {
                ...item,
                status: result.success ? 'success' as const : 'failed' as const,
                result
              }
            : item
        ),
        processingCount: 0,
        successCount: result.success ? state.successCount + 1 : state.successCount,
        failedCount: !result.success ? state.failedCount + 1 : state.failedCount
      }))

      // 如果成功，1秒后从队列中移除
      if (result.success) {
        setTimeout(() => {
          set((state: ScanQueueState) => ({
            queue: state.queue.filter(item => item.isbn !== pendingItem.isbn)
          }))
        }, 1000)
      }
    } catch (error) {
      console.error('处理队列项目失败:', error)

      // 标记为失败
      set((state: ScanQueueState) => ({
        queue: state.queue.map(item =>
          item.isbn === pendingItem.isbn
            ? {
                ...item,
                status: 'failed' as const,
                result: {
                  success: false,
                  action: 'error' as const,
                  message: error instanceof Error ? error.message : '未知错误'
                }
              }
            : item
        ),
        processingCount: 0,
        failedCount: state.failedCount + 1
      }))
    }

    // 等待 1.5 秒后处理下一个
    await new Promise(resolve => setTimeout(resolve, 1500))
  }
}
