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
        {notifications.items.map((item) => <View key={item.id} className='message-row'><View className={'message-dot ' + (!item.read ? 'is-unread' : '')} /><View><Text className='message-row__title'>{item.title}</Text><Text className='message-row__time'>{item.createdAt.slice(0, 16).replace('T', ' ')}</Text></View></View>)}
        <Pagination page={notifications.page} totalPages={notifications.totalPages} total={notifications.total} onChange={notifications.setPage} />
      </View>
    </ScrollView>
  </View>
}
