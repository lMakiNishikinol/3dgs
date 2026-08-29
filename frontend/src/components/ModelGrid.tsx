import { Text, View } from '@tarojs/components'
import type { ModelSummary } from '@/types/api'

interface ModelGridProps {
  items: ModelSummary[]
  loading: boolean
  error: string
  emptyText?: string
  onRetry: () => void
  onOpen: (model: ModelSummary) => void
}
export function ModelGrid({ items, loading, error, emptyText = '暂无模型', onRetry, onOpen }: ModelGridProps) {
  if (loading && items.length === 0) {
    return <View className='model-grid'>{Array.from({ length: 6 }, (_, index) => <View key={index} className='model-grid__item'><View className='model-card model-card--skeleton' /></View>)}</View>
  }
  if (error) {
    return <View className='state-panel'><Text>加载失败，请稍后重试</Text><View className='state-panel__button tap-feedback' onClick={onRetry}>重新加载</View></View>
  }
  if (items.length === 0) return <View className='state-panel'><Text>{emptyText}</Text></View>
  return (
    <View className='model-grid'>
      {items.map((model) => (
        <View key={model.id} className='model-grid__item'>
          <View className='model-card tap-feedback' onClick={() => onOpen(model)}>
            <View className={'model-card__preview color-seed-' + model.colorSeed}>
              <View className='model-card__orb' />
              <Text className='model-card__mark'>3D</Text>
            </View>
            <View className='model-card__body'>
              <Text className='model-card__title'>{model.title}</Text>
              <Text className='model-card__owner'>{model.ownerName}</Text>
              <View className='model-card__meta'><Text>收藏 {model.favoriteCount}</Text><Text>评论 {model.commentCount}</Text></View>
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}
