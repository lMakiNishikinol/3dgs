import { useCallback } from 'react'
import Taro from '@tarojs/taro'
import { View } from '@tarojs/components'
import { ModelGrid } from '@/components/ModelGrid'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { usePagedResource } from '@/hooks/usePagedResource'
import { fetchModels } from '@/services/models'
import type { ModelSummary } from '@/types/api'
export default function FavoritesPage() {
  const loader = useCallback((page: number, pageSize: number) => fetchModels({ page, pageSize, favoriteBy: 'me', sort: 'latest' }), [])
  const paged = usePagedResource(loader, 8)
  return <View className='page'><PageHeader title='我的收藏' back /><View className='page-content'><ModelGrid items={paged.items} loading={paged.loading} error={paged.error} onRetry={paged.refresh} onOpen={(model: ModelSummary) => void Taro.navigateTo({ url: '/pages/model-detail/index?id=' + model.id })} /><Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} onChange={paged.setPage} /></View></View>
}
