/**
 * 图书元数据抓取模块
 * 实现多级 Fallback 策略：聚合数据 -> Google Books API
 */

export interface BookMetadata {
  title: string
  author?: string
  publisher?: string
  cover_url?: string
  summary?: string
}

/**
 * 从聚合数据 API 获取图书信息
 */
async function fetchFromJuheAPI(isbn: string): Promise<BookMetadata | null> {
  const apiKey = process.env.JUHE_BOOK_API_KEY
  if (!apiKey) {
    console.warn('聚合数据 API Key 未配置')
    return null
  }

  try {
    const url = `http://apis.juhe.cn/isbn/query?isbn=${isbn}&key=${apiKey}`
    const response = await fetch(url, {
      next: { revalidate: 86400 } // 缓存 24 小时
    })

    if (!response.ok) {
      console.error(`聚合数据 API 请求失败: ${response.status}`)
      return null
    }

    const data = await response.json()

    // 聚合数据返回格式：{ error_code: 0, result: {...} }
    if (data.error_code !== 0 || !data.result) {
      console.log(`聚合数据无结果: ${data.reason || '未知错误'}`)
      return null
    }

    const book = data.result
    console.log('[DEBUG] 聚合数据返回的原始数据:', JSON.stringify(book, null, 2))

    // 聚合数据的实际数据在 data 字段中
    const bookData = book.data || book

    // 验证必需字段
    const title = bookData.title || bookData.name
    if (!title) {
      console.log('聚合数据返回数据缺少书名字段')
      return null
    }

    return {
      title,
      author: bookData.author,
      publisher: bookData.publisher || bookData.publishing,
      cover_url: bookData.img || bookData.pic || bookData.image,
      summary: bookData.gist || bookData.summary || bookData.catalog,
    }
  } catch (error) {
    console.error('聚合数据 API 调用异常:', error)
    return null
  }
}

/**
 * 从 Google Books API 获取图书信息
 */
async function fetchFromGoogleBooks(isbn: string): Promise<BookMetadata | null> {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
    const response = await fetch(url, {
      next: { revalidate: 86400 } // 缓存 24 小时
    })

    if (!response.ok) {
      console.error(`Google Books API 请求失败: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (!data.items || data.items.length === 0) {
      console.log('Google Books 无结果')
      return null
    }

    const volumeInfo = data.items[0].volumeInfo

    // 验证必需字段
    if (!volumeInfo.title) {
      console.log('Google Books 返回数据缺少书名字段')
      return null
    }

    return {
      title: volumeInfo.title,
      author: volumeInfo.authors?.join(', '),
      publisher: volumeInfo.publisher,
      cover_url: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
      summary: volumeInfo.description,
    }
  } catch (error) {
    console.error('Google Books API 调用异常:', error)
    return null
  }
}

/**
 * 多级抓取策略：聚合数据 -> Google Books -> 返回 null
 */
export async function fetchBookMetadata(isbn: string): Promise<BookMetadata | null> {
  // 1. 优先调用聚合数据 API
  console.log(`[BookAPI] 开始抓取 ISBN: ${isbn}`)
  let metadata = await fetchFromJuheAPI(isbn)

  if (metadata) {
    console.log('[BookAPI] 聚合数据成功返回')
    return metadata
  }

  // 2. Fallback 到 Google Books API
  console.log('[BookAPI] 聚合数据失败，尝试 Google Books')
  metadata = await fetchFromGoogleBooks(isbn)

  if (metadata) {
    console.log('[BookAPI] Google Books 成功返回')
    return metadata
  }

  // 3. 所有渠道失败
  console.log('[BookAPI] 所有 API 均无结果')
  return null
}
