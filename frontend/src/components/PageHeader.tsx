import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'

interface PageHeaderProps {
  title: string
  back?: boolean
  titleAlign?: 'left' | 'center'
  actionLabel?: string
  onAction?: () => void
}

export function PageHeader({ title, back = false, titleAlign = 'center', actionLabel, onAction }: PageHeaderProps) {
  return (
    <View className={'page-header page-header--' + titleAlign}>
      <View className='page-header__bar'>
        <View className={'page-header__side tap-feedback ' + (back ? '' : 'is-hidden')} onClick={() => back && Taro.navigateBack()}>
          <Text className='page-header__back'>‹</Text>
        </View>
        <Text className='page-header__title'>{title}</Text>
        <View className='page-header__side page-header__action tap-feedback' onClick={onAction}>
          <Text>{actionLabel ?? ''}</Text>
        </View>
      </View>
    </View>
  )
}
