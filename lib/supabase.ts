import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface Book {
  id: string
  isbn: string
  title: string
  author?: string
  publisher?: string
  cover_url?: string
  summary?: string
  quantity: number
  source: string
  is_pending: boolean
  error_reason?: string
  scanned_at: string
  updated_at: string
}
