import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'

export type MainTab = 'home' | 'upload' | 'orders' | 'profile'
const tabs: Array<{ key: MainTab; label: string; url: string }> = [
  { key: 'home', label: '效果展示', url: '/pages/home/index' },
  { key: 'upload', label: '上传视频', url: '/pages/upload/index' },
  { key: 'orders', label: '我的订单', url: '/pages/orders/index' },
  { key: 'profile', label: '个人主页', url: '/pages/profile/index' }
]

export function BottomNav({ active }: { active: MainTab }) {
  const navigate = (key: MainTab, url: string) => {
    if (key !== active) void Taro.redirectTo({ url })
  }
  return (
    <View className='bottom-nav safe-bottom'>
      {tabs.map((tab) => (
        <View key={tab.key} className={'bottom-nav__item tap-feedback ' + (active === tab.key ? 'is-active' : '')} onClick={() => navigate(tab.key, tab.url)}>
          <View className={'bottom-nav__icon bottom-nav__icon--' + tab.key} />
          <Text>{tab.label}</Text>
        </View>
      ))}
    </View>
  )
}
