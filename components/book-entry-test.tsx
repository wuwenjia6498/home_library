'use client'

/**
 * 图书入库测试组件
 * 用于手动输入 ISBN 测试入库逻辑
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { handleBookEntry } from '@/app/actions/book-actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

export function BookEntryTest() {
  const [isbn, setIsbn] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isbn.trim()) {
      toast.error('请输入 ISBN')
      return
    }

    setLoading(true)

    try {
      const result = await handleBookEntry(isbn.trim())

      if (result.success) {
        switch (result.action) {
          case 'added':
            toast.success(result.message, {
              description: `ISBN: ${result.book?.isbn}`,
            })
            break
          case 'incremented':
            toast.info(result.message, {
              description: `当前库存：${result.book?.quantity} 本`,
            })
            break
          case 'pending':
            toast.warning(result.message, {
              description: '请前往异常管理页面补充信息',
            })
            break
        }
        setIsbn('') // 成功后清空输入框
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error('入库失败', {
        description: error instanceof Error ? error.message : '未知错误',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6 max-w-2xl">
      <h2 className="text-lg font-semibold mb-4">📚 测试入库功能</h2>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <Input
          type="text"
          placeholder="输入 ISBN（10 或 13 位）"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" disabled={loading}>
          {loading ? '处理中...' : '入库'}
        </Button>
      </form>
      <div className="mt-4 text-sm text-muted-foreground">
        <p>💡 提示：</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>首次扫描会自动抓取图书信息</li>
          <li>重复扫描会累加数量（quantity + 1）</li>
          <li>若 API 无结果，会创建"待处理"影子记录</li>
        </ul>
      </div>
    </Card>
  )
}
