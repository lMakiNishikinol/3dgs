import { useCallback, useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { usePagedResource } from '@/hooks/usePagedResource'
import { fetchComments, fetchModelDetail } from '@/services/models'
import type { ModelDetail } from '@/types/api'

export default function ModelDetailPage() {
  const id = useRouter().params.id ?? 'model-1'
  const [model, setModel] = useState<ModelDetail | null>(null)
  useEffect(() => { void fetchModelDetail(id).then(setModel) }, [id])
  const loader = useCallback((page: number, pageSize: number) => fetchComments(id, { page, pageSize }), [id])
  const comments = usePagedResource(loader, 5)
  const openViewer = () => {
    if (!model) return
    void Taro.navigateTo({ url: `/subpackage-lab/model-viewer/index?modelId=${encodeURIComponent(model.id)}` })
  }

  return <View className='page page--locked model-detail-page'>
    <PageHeader title='展品详细' back />
    <ScrollView className='model-detail-scroll' scrollY enhanced showScrollbar>
      <View className='detail-stage color-seed-2'><View className='detail-stage__object' /><Text>3D MODEL</Text></View>
      <View className='page-content detail-content'>
        <View className='detail-title-row'><View><Text className='detail-title'>{model?.title ?? '加载中'}</Text><Text className='detail-description'>{model?.description ?? ''}</Text></View><View className='favorite-button tap-feedback'>收藏</View></View>
        {model?.status === 'ready' && model.viewerAvailable ? <View className='model-viewer-entry tap-feedback' onClick={openViewer}><View className='model-viewer-entry__icon'><Text>3D</Text></View><View className='model-viewer-entry__copy'><Text className='model-viewer-entry__title'>查看 3D 模型</Text><Text className='model-viewer-entry__sub'>模型已生成完成，可旋转缩放查看</Text></View><Text className='model-viewer-entry__arrow'>›</Text></View> : null}
        <View className='owner-row tap-feedback' onClick={() => model && void Taro.navigateTo({ url: '/pages/user-profile/index?id=' + model.ownerId })}><View className='avatar'>{model?.ownerName.slice(0, 1) ?? ''}</View><Text>{model?.ownerName ?? ''}</Text><Text className='menu-row__arrow'>›</Text></View>
        <View className='section-heading'><Text className='section-heading__title'>评论</Text><Text className='section-heading__count'>{comments.total} 条</Text></View>
        <View className='comment-list'>{comments.items.map((item) => <View key={item.id} className='comment-row'><View className='avatar'>{item.userName.slice(-1)}</View><View><Text className='comment-row__name'>{item.userName}</Text><Text className='comment-row__content'>{item.content}</Text></View><Text className='comment-row__likes'>{item.likeCount}</Text></View>)}</View>
        <Pagination page={comments.page} totalPages={comments.totalPages} total={comments.total} onChange={comments.setPage} />
      </View>
    </ScrollView>
  </View>
}
