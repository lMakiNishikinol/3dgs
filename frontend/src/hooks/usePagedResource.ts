import { useCallback, useEffect, useRef, useState } from 'react'
import type { PageResult } from '@/types/api'

type PageLoader<T> = (page: number, pageSize: number) => Promise<PageResult<T>>

export function usePagedResource<T>(loader: PageLoader<T>, pageSize = 8) {
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<PageResult<T>>({
    items: [], page: 1, pageSize, total: 0, totalPages: 1, hasNext: false
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestSequence = useRef(0)

  const load = useCallback(async (targetPage: number) => {
    const requestId = ++requestSequence.current
    setLoading(true)
    setError('')
    try {
      const nextResult = await loader(targetPage, pageSize)
      if (requestSequence.current === requestId) {
        setResult(nextResult)
        if (nextResult.page !== targetPage) setPage(nextResult.page)
      }
    } catch (reason) {
      if (requestSequence.current === requestId) {
        setError(reason instanceof Error ? reason.message : '加载失败')
      }
    } finally {
      if (requestSequence.current === requestId) setLoading(false)
    }
  }, [loader, pageSize])

  useEffect(() => { void load(page) }, [load, page])
  const refresh = useCallback(() => { void load(page) }, [load, page])
  return {
    items: result.items,
    page,
    pageSize,
    total: result.total,
    totalPages: result.totalPages,
    hasNext: result.hasNext,
    loading,
    error,
    setPage,
    refresh
  }
}
