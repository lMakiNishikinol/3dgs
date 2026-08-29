import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { ScrollView, Switch, Text, View } from '@tarojs/components'
import { PageHeader } from '@/components/PageHeader'
import { fetchOrderDetail } from '@/services/orders'
import type { OrderDetail, OrderStatus } from '@/types/api'

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

function displayTime(value?: string) {
  if (!value) return '--'
  return value.replace('T', ' ').replace('.000Z', '').replace('Z', '')
}

export default function OrderDetailPage() {
  const orderId = Taro.getCurrentInstance().router?.params.id || 'order-00001'
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  const load = () => {
    setLoading(true)
    setError('')
    void fetchOrderDetail(orderId).then((result) => {
      setOrder(result)
      setIsPublic(result.isPublic)
    }).catch((reason) => setError(reason instanceof Error ? reason.message : '订单加载失败')).finally(() => setLoading(false))
  }

  useEffect(load, [orderId])

  const copyOrderId = () => {
    if (!order) return
    void Taro.setClipboardData({ data: order.id })
  }

  const openViewer = () => {
    if (!order) return
    void Taro.navigateTo({ url: `/subpackage-lab/model-viewer/index?modelId=${encodeURIComponent(order.modelId)}` })
  }

  return (
    <View className='page page--locked order-detail-page'>
      <PageHeader title='订单详细' back />
      <ScrollView className='order-detail-scroll' scrollY enhanced showScrollbar={false}>
        {loading ? <View className='state-panel'>正在加载订单</View> : null}
        {error ? <View className='state-panel'><Text>{error}</Text><View className='state-panel__button tap-feedback' onClick={load}>重新加载</View></View> : null}
        {order ? <View className='order-detail-content'>
          <View className='order-contact'><View className='order-contact__pin' /><Text>{order.contactEmail}</Text></View>
          <View className='order-detail-product'>
            <View className='order-detail-product__top'><Text>订单编号：{order.id.replace('order-', '')}</Text><Text className={'order-card__status status-text--' + order.status}>{labels[order.status]}</Text></View>
            <View className='order-detail-product__main'>
              <View className='order-card__gift'><View className='gift-box'><View className='gift-box__ribbon' /><View className='gift-box__bow gift-box__bow--left' /><View className='gift-box__bow gift-box__bow--right' /></View></View>
              <View className='order-card__content'><Text className='order-card__title'>{order.modelTitle}</Text><Text className='order-card__description'>{order.description}</Text></View>
            </View>
            <View className='order-detail-product__share' onClick={() => void Taro.showToast({ title: '分享能力待接入', icon: 'none' })}><Text>分享</Text><Text className='order-detail-product__share-arrow'>↗</Text></View>
          </View>
          <View className='order-detail-section order-price-panel'>
            <View className='order-detail-row'><Text>商品总价：</Text><Text>{amount(order.originalAmount)}</Text></View>
            <View className='order-detail-row'><Text>优惠：</Text><Text>- {amount(order.discountAmount)}</Text></View>
            <View className='order-detail-row order-detail-row--strong'><Text>实付款：</Text><Text>{amount(order.paidAmount)}</Text></View>
          </View>
          <View className='order-detail-section order-meta-panel'>
            <View className='order-detail-row'><Text>订单编号：{order.id}</Text><Text className='order-copy tap-feedback' onClick={copyOrderId}>复制</Text></View>
            <View className='order-detail-row'><Text>创建时间：{displayTime(order.createdAt)}</Text></View>
            <View className='order-detail-row'><Text>支付时间：{displayTime(order.paidAt)}</Text></View>
            <View className='order-detail-row'><Text>交付时间：{displayTime(order.deliveredAt)}</Text></View>
          </View>
          {order.modelStatus === 'ready' && order.viewerAvailable ? <View className='order-viewer-entry tap-feedback' onClick={openViewer}><View className='order-viewer-entry__icon'><Text>3D</Text></View><View className='order-viewer-entry__copy'><Text className='order-viewer-entry__title'>查看 3D 模型</Text><Text className='order-viewer-entry__sub'>模型已生成完成</Text></View><Text className='order-viewer-entry__arrow'>›</Text></View> : null}
          <View className='order-public-row'><Text>作品公开状态</Text><Switch checked={isPublic} color='#9356a7' onChange={(event) => setIsPublic(event.detail.value)} /></View>
        </View> : null}
      </ScrollView>
    </View>
  )
}
