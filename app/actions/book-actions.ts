'use server'

/**
 * 图书入库核心 Server Actions
 * 实现查重、累加、抓取、影子记录等逻辑
 */

import { supabase } from '@/lib/supabase'
import { fetchBookMetadata } from '@/lib/book-api'

export interface BookEntryResult {
  success: boolean
  action: 'added' | 'incremented' | 'pending' | 'error'
  message: string
  book?: {
    id: string
    isbn: string
    title: string
    quantity: number
    is_pending: boolean
  }
}

/**
 * 核心入库逻辑
 * @param isbn - ISBN 码（10 或 13 位）
 * @returns 入库结果
 */
export async function handleBookEntry(isbn: string): Promise<BookEntryResult> {
  try {
    // 1. 查重：检查数据库中是否存在该 ISBN
    const { data: existingBook, error: queryError } = await supabase
      .from('books')
      .select('*')
      .eq('isbn', isbn)
      .single()

    if (queryError && queryError.code !== 'PGRST116') {
      // PGRST116 = 未找到记录，其他错误才需要处理
      throw queryError
    }

    // 2. 累加：若存在，则 quantity + 1
    if (existingBook) {
      const { data: updatedBook, error: updateError } = await supabase
        .from('books')
        .update({
          quantity: existingBook.quantity + 1,
          updated_at: new Date().toISOString()
        })
        .eq('isbn', isbn)
        .select()
        .single()

      if (updateError) throw updateError

      return {
        success: true,
        action: 'incremented',
        message: `《${existingBook.title}》已累加，当前数量：${updatedBook.quantity}`,
        book: {
          id: updatedBook.id,
          isbn: updatedBook.isbn,
          title: updatedBook.title,
          quantity: updatedBook.quantity,
          is_pending: updatedBook.is_pending
        }
      }
    }

    // 3. 抓取与影子记录：若不存在，调用 API 抓取
    console.log(`新书入库，开始抓取 ISBN: ${isbn}`)
    const metadata = await fetchBookMetadata(isbn)

    if (metadata) {
      // 3.1 抓取成功，创建完整记录
      const { data: newBook, error: insertError } = await supabase
        .from('books')
        .insert({
          isbn,
          title: metadata.title,
          author: metadata.author,
          publisher: metadata.publisher,
          cover_url: metadata.cover_url,
          summary: metadata.summary,
          quantity: 1,
          source: 'api',
          is_pending: false,
          scanned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) throw insertError

      return {
        success: true,
        action: 'added',
        message: `《${metadata.title}》入库成功`,
        book: {
          id: newBook.id,
          isbn: newBook.isbn,
          title: newBook.title,
          quantity: newBook.quantity,
          is_pending: newBook.is_pending
        }
      }
    } else {
      // 3.2 抓取失败，创建影子记录
      const { data: pendingBook, error: insertError } = await supabase
        .from('books')
        .insert({
          isbn,
          title: `未识别图书 (ISBN: ${isbn})`,
          quantity: 1,
          source: 'api',
          is_pending: true,
          error_reason: 'API 无结果',
          scanned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (insertError) throw insertError

      return {
        success: true,
        action: 'pending',
        message: `ISBN ${isbn} 无法自动识别，已创建待处理记录`,
        book: {
          id: pendingBook.id,
          isbn: pendingBook.isbn,
          title: pendingBook.title,
          quantity: pendingBook.quantity,
          is_pending: pendingBook.is_pending
        }
      }
    }
  } catch (error) {
    console.error('[handleBookEntry] 错误:', error)
    return {
      success: false,
      action: 'error',
      message: `入库失败：${error instanceof Error ? error.message : '未知错误'}`
    }
  }
}
