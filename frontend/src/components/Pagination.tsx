import { Text, View } from '@tarojs/components'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  onChange: (page: number) => void
}
function visiblePages(page: number, totalPages: number): number[] {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4))
  const end = Math.min(totalPages, start + 4)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}
export function Pagination({ page, totalPages, total, onChange }: PaginationProps) {
  if (totalPages <= 1) return <View className='pagination__summary'>共 {total} 项</View>
  return (
    <View className='pagination'>
      <View className={'pagination__button pagination__button--prev tap-feedback ' + (page <= 1 ? 'is-disabled' : '')} onClick={() => page > 1 && onChange(page - 1)}>
        <Text>上一页</Text>
      </View>
      <View className='pagination__pages'>
        {visiblePages(page, totalPages).map((item) => (
          <View key={item} className={'pagination__page tap-feedback ' + (item === page ? 'is-active' : '')} onClick={() => onChange(item)}>{item}</View>
        ))}
      </View>
      <View className={'pagination__button pagination__button--next tap-feedback ' + (page >= totalPages ? 'is-disabled' : '')} onClick={() => page < totalPages && onChange(page + 1)}>
        <Text>下一页</Text>
      </View>
      <Text className='pagination__summary'>共 {total} 项</Text>
    </View>
  )
}
