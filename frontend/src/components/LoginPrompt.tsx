import Taro from '@tarojs/taro'
import { Button, Text, View } from '@tarojs/components'

interface LoginPromptProps {
  visible: boolean
  title?: string
  message?: string
  cancelLabel?: string
  onCancel: () => void
}

export function LoginPrompt({
  visible,
  title = '登录后继续',
  message = '登录后即可使用收藏、评论、上传与订单管理等完整功能。',
  cancelLabel = '暂不登录',
  onCancel
}: LoginPromptProps) {
  if (!visible) return null
  const goToProfile = () => void Taro.redirectTo({ url: '/pages/profile/index' })
  return (
    <View className='login-prompt-mask' role='dialog' aria-label={title}>
      <View className='login-prompt-card'>
        <View className='login-prompt-mark'><View className='login-prompt-mark__person' /></View>
        <Text className='login-prompt-title'>{title}</Text>
        <Text className='login-prompt-copy'>{message}</Text>
        <View className='login-prompt-actions'>
          <Button className='login-prompt-button login-prompt-button--muted' onClick={onCancel}>{cancelLabel}</Button>
          <Button className='login-prompt-button login-prompt-button--primary' onClick={goToProfile}>前往个人主页</Button>
        </View>
      </View>
    </View>
  )
}
