import { useCallback, useState } from 'react'
import Taro from '@tarojs/taro'
import { Input, ScrollView, Text, View } from '@tarojs/components'
import { BottomNav } from '@/components/BottomNav'
import { ModelGrid } from '@/components/ModelGrid'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { usePagedResource } from '@/hooks/usePagedResource'
import { fetchModels } from '@/services/models'
import type { ModelSummary } from '@/types/api'

export default function HomePage() {
  const [draftKeyword, setDraftKeyword] = useState('')
  const [keyword, setKeyword] = useState('')
  const loader = useCallback((page: number, pageSize: number) => fetchModels({ page, pageSize, keyword, sort: 'popular' }), [keyword])
  const paged = usePagedResource(loader, 8)
  const openModel = (model: ModelSummary) => void Taro.navigateTo({ url: '/pages/model-detail/index?id=' + encodeURIComponent(model.id) })
  const search = () => { paged.setPage(1); setKeyword(draftKeyword.trim()) }

  return (
    <View className='page page--with-tabs page--locked'>
      <PageHeader title='3D 展示' actionLabel='消息' onAction={() => void Taro.navigateTo({ url: '/pages/messages/index' })} />
      <ScrollView className='main-scroll' scrollY enhanced showScrollbar={false}>
        <View className='page-content home-content'>
          <View className='search-row'>
            <Input className='search-input' value={draftKeyword} placeholder='搜索模型、作者或分类' confirmType='search' onInput={(event) => setDraftKeyword(event.detail.value)} onConfirm={search} />
            <View className='search-button tap-feedback' onClick={search}>搜索</View>
          </View>
          <View className='campaign-card'>
            <View className='campaign-card__content'>
              <Text className='campaign-card__eyebrow'>3D GAUSSIAN SPLATTING</Text>
              <Text className='campaign-card__title'>让现实物体，以三维方式被重新看见</Text>
              <Text className='campaign-card__copy'>上传环绕视频，生成可分享、可收藏的空间模型。</Text>
            </View>
            <View className='campaign-card__visual'><View className='campaign-card__ring' /><Text>3D</Text></View>
          </View>
          <View className='section-heading' id='model-section'>
            <View><Text className='section-heading__title'>效果呈现</Text><Text className='section-heading__sub'>按热度推荐 · 第 {paged.page} 页</Text></View>
            <Text className='section-heading__count'>{paged.total} 个模型</Text>
          </View>
          <ModelGrid items={paged.items} loading={paged.loading} error={paged.error} onRetry={paged.refresh} onOpen={openModel} />
          <Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} onChange={paged.setPage} />
        </View>
      </ScrollView>
      <BottomNav active='home' />
    </View>
  )
}
