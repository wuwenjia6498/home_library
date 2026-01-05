'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { handleBookEntry } from '@/app/actions/book-actions'

export default function HomePage() {
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
            toast.success(result.message)
            break
          case 'incremented':
            toast.info(result.message)
            break
          case 'pending':
            toast.warning(result.message)
            break
        }
        setIsbn('')
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error('入库失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">家庭图书管理系统</h1>

      {/* 快捷导航 */}
      <div className="mb-6 flex gap-4">
        <Link
          href="/scan"
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          📷 急速扫码入库
        </Link>
      </div>

      <div className="max-w-2xl border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">测试入库功能</h2>
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            placeholder="输入 ISBN（10 或 13 位）"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            disabled={loading}
            className="flex-1 px-3 py-2 border rounded"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {loading ? '处理中...' : '入库'}
          </button>
        </form>
      </div>
    </div>
  )
}
