import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { BottomNav } from '@/components/BottomNav'
import { fetchUserProfile } from '@/services/models'
import type { UserProfile } from '@/types/api'

const menu = [
  { label: '关于我们', url: '/pages/info/index?type=about', icon: 'about' },
  { label: '联系客服', url: '/pages/info/index?type=support', icon: 'support' },
  { label: '用户协议', url: '/pages/info/index?type=agreement', icon: 'agreement' },
  { label: '邮箱管理', url: '/pages/info/index?type=email', icon: 'email' },
  { label: '意见反馈', url: '/pages/info/index?type=feedback', icon: 'feedback' },
  { label: '我的收藏', url: '/pages/favorites/index', icon: 'favorites' }
]

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  useEffect(() => { void fetchUserProfile('user-current').then(setProfile) }, [])
  return (
    <View className='page page--with-tabs page--locked mg-profile-page'>
      <View className='mg-profile-header'>
        <View className='mg-profile-header__bell tap-feedback' onClick={() => void Taro.navigateTo({ url: '/pages/messages/index' })}><View className='mg-bell' /></View>
        <Text className='mg-profile-header__title'>主页</Text>
      </View>
      <View className='mg-profile-summary'>
        <View className='mg-avatar mg-avatar--self'><Text>{profile?.name.slice(0, 1) ?? ''}</Text></View>
        <View className='mg-profile-summary__copy'>
          <View className='mg-profile-summary__name-row'><Text className='mg-profile-summary__name'>{profile?.name ?? '加载中'}</Text><Text className='mg-company-tag'>企业认证</Text></View>
          <Text className='mg-profile-summary__email'>{profile?.email ?? ''}</Text>
        </View>
        <View className='mg-settings tap-feedback' onClick={() => void Taro.navigateTo({ url: '/pages/profile-edit/index' })}><View className='mg-settings__gear' /></View>
      </View>
      <View className='mg-profile-menu'>
        {menu.map((item) => <View key={item.label} className='mg-profile-menu__row tap-feedback' onClick={() => void Taro.navigateTo({ url: item.url })}>
          <View className={'mg-profile-menu__icon mg-profile-menu__icon--' + item.icon} /><Text className='mg-profile-menu__label'>{item.label}</Text><Text className='mg-profile-menu__arrow'>›</Text>
        </View>)}
      </View>
      <BottomNav active='profile' />
    </View>
  )
}
