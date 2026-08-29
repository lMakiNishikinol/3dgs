import { useEffect, useState } from 'react'
import './index.less'
import Taro from '@tarojs/taro'
import { Text, View } from '@tarojs/components'
import { fetchUserProfile } from '@/services/models'
import type { UserProfile } from '@/types/api'

export default function ProfileEditPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  useEffect(() => { void fetchUserProfile('user-current').then(setProfile) }, [])
  const rows = [
    { label: '头像', value: '', avatar: true },
    { label: '昵称', value: profile?.name ?? '' },
    { label: '公司', value: profile?.company ?? '' },
    { label: '电话', value: profile?.phone ?? '' },
    { label: '邮箱', value: profile?.email ?? '' }
  ]
  return <View className='page page--locked mg-edit-page'>
    <View className='mg-edit-header'><Text className='mg-edit-header__back tap-feedback' onClick={() => void Taro.navigateBack()}>‹</Text><Text className='mg-edit-header__title'>主页</Text></View>
    <View className='mg-edit-list'>{rows.map((row) => <View key={row.label} className='mg-edit-row tap-feedback' onClick={() => void Taro.showToast({ title: '后端编辑接口已预留', icon: 'none' })}>
      <Text className='mg-edit-row__label'>{row.label}</Text>
      <View className='mg-edit-row__right'>{row.avatar ? <View className='mg-edit-avatar'>{profile?.name.slice(0, 1) ?? ''}</View> : <Text className='mg-edit-row__value'>{row.value}</Text>}<Text className='mg-edit-row__arrow'>›</Text></View>
    </View>)}</View>
  </View>
}
