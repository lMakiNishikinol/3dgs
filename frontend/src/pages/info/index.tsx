import Taro, { useRouter } from '@tarojs/taro'
import { Button, Input, Text, Textarea, View } from '@tarojs/components'
import { PageHeader } from '@/components/PageHeader'
const copy: Record<string, { title: string; body: string }> = {
  about: { title: '关于我们', body: '我们致力于让高质量三维重建更简单，让文化、产品与空间以新的方式被保存和分享。' },
  agreement: { title: '用户协议', body: '使用本服务时，请确保上传内容合法且拥有相应权利。平台仅按授权范围处理视频和模型数据。' },
  support: { title: '联系客服', body: '服务时间：工作日 09:00–18:00\n邮箱：support@example.com' },
  email: { title: '邮箱管理', body: '绑定邮箱可用于接收模型生成结果与安全提醒。' },
  feedback: { title: '意见反馈', body: '请描述您遇到的问题或希望增加的功能。' },
  edit: { title: '编辑主页', body: '更新姓名、公司与个人简介。' }
}
export default function InfoPage() {
  const type = useRouter().params.type ?? 'about'
  const current = copy[type] ?? copy.about
  const form = ['feedback', 'email', 'edit'].includes(type)
  return <View className='page'><PageHeader title={current.title} back /><View className='page-content info-page'><Text className='info-page__body'>{current.body}</Text>{form ? <View className='form-card'>{type === 'feedback' ? <Textarea className='form-textarea' placeholder='请输入反馈内容' maxlength={500} /> : <Input className='form-input' placeholder={type === 'email' ? '请输入邮箱地址' : '请输入新的资料'} />}<Button className='primary-button' onClick={() => void Taro.showToast({ title: '前端演示已保存', icon: 'none' })}>保存</Button></View> : null}</View></View>
}
