import { useCallback } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { usePagedResource } from '@/hooks/usePagedResource'
import { fetchNotifications } from '@/services/notifications'

export default function MessagesPage() {
  const loader = useCallback((page: number, pageSize: number) => fetchNotifications({ page, pageSize }), [])
  const notifications = usePagedResource(loader, 6)

  return <View className='page page--locked message-page'>
    <PageHeader title='消息通知' back />
    <ScrollView className='message-scroll' scrollY enhanced showScrollbar>
      <View className='page-content message-list'>
        {notifications.loading && notifications.items.length === 0 ? <View className='state-panel'><Text>正在加载消息…</Text></View> : null}
        {notifications.error ? <View className='state-panel'><Text>{notifications.error}</Text><View className='state-panel__button tap-feedback' onClick={notifications.refresh}>重新加载</View></View> : null}
        {!notifications.loading && !notifications.error && notifications.items.length === 0 ? <View className='state-panel'><Text>暂无消息</Text></View> : null}
        {!notifications.error ? notifications.items.map((item) => <View key={item.id} className='message-row'><View className={'message-dot ' + (!item.read ? 'is-unread' : '')} /><View><Text className='message-row__title'>{item.title}</Text><Text className='message-row__time'>{item.createdAt.slice(0, 16).replace('T', ' ')}</Text></View></View>) : null}
        {!notifications.error && notifications.items.length > 0 ? <Pagination page={notifications.page} totalPages={notifications.totalPages} total={notifications.total} onChange={notifications.setPage} /> : null}
      </View>
    </ScrollView>
  </View>
}
