import { useCallback, useState } from 'react'
import Taro from '@tarojs/taro'
import { Input, ScrollView, Text, View } from '@tarojs/components'
import { BottomNav } from '@/components/BottomNav'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { usePagedResource } from '@/hooks/usePagedResource'
import { fetchOrders } from '@/services/orders'
import type { OrderStatus, OrderSummary } from '@/types/api'

const filters: Array<{ label: string; value: 'all' | OrderStatus }> = [
  { label: '所有', value: 'all' },
  { label: '待付款', value: 'pending_payment' },
  { label: '待生产', value: 'pending_production' },
  { label: '生产中', value: 'processing' },
  { label: '已发货', value: 'shipped' },
  { label: '取消/退款', value: 'cancelled' }
]

const labels: Record<OrderStatus, string> = {
  pending_payment: '待付款',
  pending_production: '待生产',
  processing: '生产中',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  refunded: '已退款',
  failed: '生产失败'
}

function amount(value: number) {
  return '￥ ' + value.toFixed(2).replace('.00', '')
}

function OrderCard({ order, onOpen }: { order: OrderSummary; onOpen: () => void }) {
  return (
    <View className='order-card tap-feedback' onClick={onOpen}>
      <View className='order-card__top'>
        <Text className='order-card__id'>订单编号：{order.id.replace('order-', '')}</Text>
        <Text className={'order-card__status status-text--' + order.status}>{labels[order.status]}</Text>
      </View>
      <View className='order-card__main'>
        <View className='order-card__gift' aria-label='订单模型预览'>
          <View className='gift-box'><View className='gift-box__ribbon' /><View className='gift-box__bow gift-box__bow--left' /><View className='gift-box__bow gift-box__bow--right' /></View>
        </View>
        <View className='order-card__content'>
          <Text className='order-card__title'>{order.modelTitle}</Text>
          <Text className='order-card__description'>{order.description}</Text>
          {order.status === 'processing' ? <View className='order-card__progress-track'><View className='order-card__progress-bar' style={{ width: order.progress + '%' }} /></View> : null}
        </View>
      </View>
      <View className='order-card__footer'>
        <Text className='order-card__amount'>实付：{amount(order.paidAmount)}</Text>
        <Text className='order-card__action'>{order.status === 'pending_payment' ? '继续支付' : '查看进度'}</Text>
      </View>
    </View>
  )
}

export default function OrdersPage() {
  const [draftKeyword, setDraftKeyword] = useState('')
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<'all' | OrderStatus>('all')
  const loader = useCallback((page: number, pageSize: number) => fetchOrders({
    page,
    pageSize,
    keyword,
    status: status === 'all' ? undefined : status
  }), [keyword, status])
  const paged = usePagedResource(loader, 2)
  const applySearch = () => { paged.setPage(1); setKeyword(draftKeyword.trim()) }
  const selectStatus = (nextStatus: 'all' | OrderStatus) => { paged.setPage(1); setStatus(nextStatus) }
  const openOrder = (order: OrderSummary) => void Taro.navigateTo({ url: '/pages/order-detail/index?id=' + encodeURIComponent(order.id) })

  return (
    <View className='page page--with-tabs page--locked orders-page'>
      <PageHeader title='订单管理' titleAlign='left' />
      <View className='orders-toolbar'>
        <View className='orders-search'>
          <View className='orders-search__icon' onClick={applySearch} />
          <Input className='orders-search__input' value={draftKeyword} placeholder='输入商品信息描述/订单编号' confirmType='search' onInput={(event) => setDraftKeyword(event.detail.value)} onConfirm={applySearch} />
          <View className='orders-search__voice' />
        </View>
        <ScrollView className='orders-tabs' scrollX enhanced showScrollbar={false}>
          <View className='orders-tabs__track'>
            {filters.map((filter) => <View key={filter.value} className={'orders-tab tap-feedback ' + (filter.value === status ? 'is-active' : '')} onClick={() => selectStatus(filter.value)}>{filter.label}</View>)}
          </View>
        </ScrollView>
      </View>
      <ScrollView className='orders-scroll' scrollY enhanced showScrollbar={false}>
        <View className='orders-scroll__body'>
          {paged.loading && paged.items.length === 0 ? <View className='order-list'><View className='order-card order-card--loading' /><View className='order-card order-card--loading' /></View> : null}
          {paged.error ? <View className='state-panel'><Text>订单加载失败</Text><View className='state-panel__button tap-feedback' onClick={paged.refresh}>重新加载</View></View> : null}
          {!paged.loading && !paged.error && paged.items.length === 0 ? <View className='orders-empty'><View className='orders-empty__gift'>◇</View><Text>亲，您还没有订单，期待您的下单~</Text></View> : null}
          {!paged.error && paged.items.length > 0 ? <View className='order-list'>{paged.items.map((order) => <OrderCard key={order.id} order={order} onOpen={() => openOrder(order)} />)}</View> : null}
          {!paged.error && paged.items.length > 0 ? <Pagination page={paged.page} totalPages={paged.totalPages} total={paged.total} onChange={paged.setPage} /> : null}
        </View>
      </ScrollView>
      <BottomNav active='orders' />
    </View>
  )
}
