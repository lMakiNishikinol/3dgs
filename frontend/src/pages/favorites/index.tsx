import { useCallback } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { LoginPrompt } from '@/components/LoginPrompt'
import { ModelGrid } from '@/components/ModelGrid'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { usePagedResource } from '@/hooks/usePagedResource'
import { fetchModels } from '@/services/models'
import type { ModelSummary } from '@/types/api'
function FavoritesContent() {
  const loader = useCallback((page: number, pageSize: number) => fetchModels({ page, pageSize, favoriteBy: 'me', sort: 'latest' }), [])
  const paged = usePagedResource(loader, 8)
  return <View className='page'><PageHeader title='我的收藏' back /><View className='page-content'><ModelGrid items={paged.items} loading={paged.loading} error={paged.error} onRetry={paged.refresh} onOpen={(model: ModelSummary) => void Taro.navigateTo({ url: '/pages/model-detail/index?id=' + model.id })} /><Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} onChange={paged.setPage} /></View></View>
}

export default function FavoritesPage() {
  const loggedIn = Boolean(Taro.getStorageSync<string>('accessToken'))
  if (loggedIn) return <FavoritesContent />
  return <View className='page'><PageHeader title='我的收藏' back /><View className='protected-page-backdrop'><Text>登录后查看收藏的模型</Text></View><LoginPrompt visible title='登录后查看收藏' message='登录后即可同步收藏模型，并在其他设备继续查看。' cancelLabel='返回首页' onCancel={() => void Taro.redirectTo({ url: '/pages/home/index' })} /></View>
}
