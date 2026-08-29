import { useCallback, useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { ScrollView, Text, View } from '@tarojs/components'
import { Pagination } from '@/components/Pagination'
import { usePagedResource } from '@/hooks/usePagedResource'
import { fetchModels, fetchUserProfile } from '@/services/models'
import type { ModelSummary, UserProfile } from '@/types/api'

export default function UserProfilePage() {
  const userId = useRouter().params.id ?? 'user-1'
  const [profile, setProfile] = useState<UserProfile | null>(null)
  useEffect(() => { void fetchUserProfile(userId).then(setProfile) }, [userId])
  const loader = useCallback((page: number, pageSize: number) => fetchModels({ page, pageSize, ownerId: userId, sort: 'latest' }), [userId])
  const paged = usePagedResource(loader, 6)
  const openModel = (model: ModelSummary) => void Taro.navigateTo({ url: '/pages/model-detail/index?id=' + model.id })
  return <View className='page page--locked mg-creator-page'>
    <View className='mg-creator-header' />
    <View className='mg-creator-summary'>
      <View className={'mg-avatar mg-avatar--creator mg-avatar--seed-' + (profile?.avatarSeed ?? 0)}><Text>{profile?.name.slice(0, 1) ?? ''}</Text></View>
      <View className='mg-creator-summary__copy'><Text className='mg-creator-summary__name'>{profile?.name ?? '加载中'}</Text><Text className='mg-company-tag'>{profile?.company ?? ''}</Text></View>
    </View>
    <View className='mg-creator-divider' />
    <ScrollView className='mg-creator-scroll' scrollY enhanced showScrollbar>
      <View className='mg-creator-grid'>
        {paged.items.map((model) => <View key={model.id} className='mg-creator-card tap-feedback' onClick={() => openModel(model)}>
          <View className={'mg-creator-card__preview color-seed-' + model.colorSeed}><View className='mg-creator-card__orb' /></View>
          <Text className='mg-creator-card__title'>{model.title}</Text>
          <View className='mg-creator-card__meta'><Text className='mg-creator-card__rating'>★ 4.6</Text><Text className='mg-creator-card__heart'>♥</Text></View>
        </View>)}
      </View>
      {paged.loading ? <Text className='mg-creator-state'>正在加载公开作品…</Text> : null}
      {paged.error ? <Text className='mg-creator-state tap-feedback' onClick={paged.refresh}>加载失败，点击重试</Text> : null}
      <Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} onChange={paged.setPage} />
      <View className='mg-creator-scroll__safe' />
    </ScrollView>
  </View>
}
