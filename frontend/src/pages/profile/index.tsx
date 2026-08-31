import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Input, Text, View } from '@tarojs/components'
import { BottomNav } from '@/components/BottomNav'
import { fetchUserProfile } from '@/services/models'
import { loginForLocalTest, loginWithWechat } from '@/services/backend'
import type { UserProfile } from '@/types/api'

declare const __ENABLE_TEST_LOGIN__: boolean

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
  const [profileError, setProfileError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [testLoginKey, setTestLoginKey] = useState('')
  const loadProfile = async () => {
    try {
      setProfile(await fetchUserProfile('user-current'))
      setProfileError('')
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : '用户资料加载失败')
    }
  }
  useEffect(() => {
    if (Taro.getStorageSync<string>('accessToken')) void loadProfile()
    else setProfileError('请先登录')
  }, [])
  const handleWechatLogin = async () => {
    setAuthLoading(true)
    try {
      await loginWithWechat()
      await loadProfile()
      await Taro.showToast({ title: '登录成功', icon: 'success' })
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : '微信登录失败')
    } finally {
      setAuthLoading(false)
    }
  }
  const handleTestLogin = async () => {
    if (!testLoginKey.trim()) {
      await Taro.showToast({ title: '请输入测试登录密钥', icon: 'none' })
      return
    }
    setAuthLoading(true)
    try {
      await loginForLocalTest(testLoginKey.trim())
      await loadProfile()
      await Taro.showToast({ title: '测试登录成功', icon: 'success' })
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : '测试登录失败')
    } finally {
      setAuthLoading(false)
    }
  }
  return (
    <View className='page page--with-tabs page--locked mg-profile-page'>
      <View className='mg-profile-header'>
        <View className='mg-profile-header__bell tap-feedback' onClick={() => void Taro.navigateTo({ url: '/pages/messages/index' })}><View className='mg-bell' /></View>
        <Text className='mg-profile-header__title'>主页</Text>
      </View>
      <View className='mg-profile-summary'>
        <View className='mg-avatar mg-avatar--self'><Text>{profile?.name.slice(0, 1) ?? ''}</Text></View>
        <View className='mg-profile-summary__copy'>
          <View className='mg-profile-summary__name-row'><Text className='mg-profile-summary__name'>{profile?.name ?? (profileError ? '加载失败' : '加载中')}</Text><Text className='mg-company-tag'>企业认证</Text></View>
          <Text className='mg-profile-summary__email'>{profile?.email ?? profileError}</Text>
        </View>
        <View className='mg-settings tap-feedback' onClick={() => void Taro.navigateTo({ url: '/pages/profile-edit/index' })}><View className='mg-settings__gear' /></View>
      </View>
      {!profile && <View className='mg-login-actions'>
        <Button size='mini' type='primary' loading={authLoading} disabled={authLoading} onClick={() => void handleWechatLogin()}>微信登录</Button>
        {__ENABLE_TEST_LOGIN__ && <><Input className='mg-login-key' password value={testLoginKey} placeholder='测试登录密钥' onInput={(event) => setTestLoginKey(event.detail.value)} /><Button size='mini' loading={authLoading} disabled={authLoading} onClick={() => void handleTestLogin()}>测试登录</Button></>}
      </View>}
      <View className='mg-profile-menu'>
        {menu.map((item) => <View key={item.label} className='mg-profile-menu__row tap-feedback' onClick={() => void Taro.navigateTo({ url: item.url })}>
          <View className={'mg-profile-menu__icon mg-profile-menu__icon--' + item.icon} /><Text className='mg-profile-menu__label'>{item.label}</Text><Text className='mg-profile-menu__arrow'>›</Text>
        </View>)}
      </View>
      <BottomNav active='profile' />
    </View>
  )
}
