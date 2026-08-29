import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Image, Input, Text, View } from '@tarojs/components'
import uploadReference from '@/assets/upload-mastergo-reference.png'
import { BottomNav } from '@/components/BottomNav'

type UploadPanel = 'camera' | 'confirm' | 'uploading' | 'success' | 'failure' | 'consent'
interface LocalVideo { path: string; size: number; duration: number }

export default function UploadPage() {
  const [video, setVideo] = useState<LocalVideo | null>(null)
  const [panel, setPanel] = useState<UploadPanel>('camera')
  const [requirementsOpen, setRequirementsOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const [modelObjectName, setModelObjectName] = useState('')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => () => { if (timer.current) clearInterval(timer.current) }, [])

  const choose = async (sourceType: Array<'album' | 'camera'>) => {
    try {
      const result = await Taro.chooseMedia({ count: 1, mediaType: ['video'], sourceType })
      const file = result.tempFiles[0]
      if (file) {
        setVideo({ path: file.tempFilePath, size: file.size, duration: file.duration ?? 0 })
        setProgress(0)
        setModelObjectName('')
        setPanel('confirm')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.toLowerCase().includes('cancel')) setPanel('failure')
    }
  }

  const startUpload = () => {
    setPanel('uploading')
    setProgress(0)
    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(() => setProgress((value) => {
      const next = Math.min(100, value + 10)
      if (next === 100 && timer.current) {
        clearInterval(timer.current)
        timer.current = null
        setPanel('success')
      }
      return next
    }), 180)
  }

  const continueAfterUpload = () => {
    if (!modelObjectName.trim()) {
      void Taro.showToast({ title: '请填写模型物体名称', icon: 'none' })
      return
    }
    setPanel('consent')
  }

  const finishConsent = (visibility: 'public' | 'private') => {
    setPanel('camera')
    setVideo(null)
    setProgress(0)
    setModelObjectName('')
    void Taro.showToast({ title: visibility === 'public' ? '已同意公开展示' : '作品将仅自己可见', icon: 'none' })
  }

  return <View className='page page--with-tabs page--locked mg-upload-page'>
    <View className='mg-upload-header'><Text className='mg-upload-header__back tap-feedback' onClick={() => void Taro.navigateBack()}>‹</Text><Text className='mg-upload-header__title'>拍摄/上传360°视频</Text></View>
    <View className='mg-upload-preview'>
      <Image className='mg-upload-preview__reference' src={uploadReference} mode='scaleToFill' />
      {video ? <View className='mg-upload-preview__selected'><Text>已选择视频</Text><Text>{Math.round(video.duration)} 秒 · {Math.max(1, Math.round(video.size / 1024 / 1024))} MB</Text></View> : null}
    </View>
    <View className='mg-upload-controls'>
      <View className='mg-upload-control tap-feedback' onClick={() => void choose(['album'])}><View className='mg-upload-control__album' /><Text>上传本地</Text></View>
      <View className='mg-upload-capture tap-feedback' onClick={() => void choose(['camera'])}><View className='mg-upload-capture__inner' /></View>
      <View className='mg-upload-control tap-feedback' onClick={() => setRequirementsOpen(true)}><View className='mg-upload-control__info'>i</View><Text>拍摄要求</Text></View>
    </View>

    {requirementsOpen ? <View className='mg-upload-mask mg-upload-mask--center'>
      <View className='mg-requirements'><Text className='mg-requirements__close tap-feedback' onClick={() => setRequirementsOpen(false)}>×</Text><View className='mg-requirements__image'><View className='mg-requirements__object' /></View><Text className='mg-requirements__title'>拍摄要求</Text><Text className='mg-requirements__copy'>保持主体完整、光线均匀，围绕主体平稳拍摄一周。</Text><Button className='mg-upload-button mg-upload-button--dark' onClick={() => setRequirementsOpen(false)}>我知道了</Button></View>
    </View> : null}

    {panel === 'confirm' ? <View className='mg-upload-mask mg-upload-mask--bottom'><View className='mg-upload-sheet mg-confirm-sheet'>
      <Text className='mg-upload-sheet__title'>您即将使用当前视频生成3D建模</Text><Text className='mg-upload-sheet__hint'>请确认视频清晰、主体完整且符合拍摄要求</Text>
      <View className='mg-upload-sheet__actions'><Button className='mg-upload-button mg-upload-button--muted' onClick={() => { setVideo(null); setPanel('camera') }}>重新拍摄/上传</Button><Button className='mg-upload-button mg-upload-button--green' onClick={startUpload}>确认</Button></View>
    </View></View> : null}

    {panel === 'uploading' || panel === 'success' || panel === 'failure' ? <View className='mg-upload-mask mg-upload-mask--light'><View className={'mg-upload-card ' + (panel === 'success' ? 'mg-upload-card--success-form' : '')}>
      <Text className='mg-upload-card__title'>{panel === 'uploading' ? '上传中' : panel === 'success' ? '上传成功' : '上传失败'}</Text>
      <Text className='mg-upload-card__limit'>{panel === 'failure' ? '请检查视频后重新尝试' : '最大文件大小：500 MB'}</Text>
      <View className={'mg-upload-card__dropzone ' + (panel === 'success' ? 'mg-upload-card__dropzone--success' : '')}>
        {panel === 'success' ? <><View className='mg-upload-success'>✓</View><Text className='mg-upload-card__message'>¡Todo correcto!</Text></> : panel === 'failure' ? <><View className='mg-upload-failure'>×</View><Text className='mg-upload-card__message'>可能导致失败的原因：</Text><Text className='mg-upload-card__reason'>视频过大、格式错误或网络中断</Text></> : <><View className='mg-upload-folder' /><View className='mg-upload-progress'><View className='mg-upload-progress__bar' style={{ width: progress + '%' }} /></View><Text className='mg-upload-card__message'>{progress}%</Text></>}
      </View>
      {panel === 'success' ? <View className='mg-model-object-form'>
        <Text className='mg-model-object-form__label'>模型物体</Text>
        <Input className='mg-model-object-form__input' value={modelObjectName} maxlength={40} placeholder='请输入你要生成的模型物体是什么' onInput={(event) => setModelObjectName(event.detail.value)} />
        <Button className='mg-upload-button mg-upload-button--green mg-model-object-form__button' onClick={continueAfterUpload}>下一步</Button>
      </View> : null}
      {panel === 'failure' ? <Button className='mg-upload-button mg-upload-button--green mg-upload-card__retry' onClick={startUpload}>重新上传</Button> : null}
    </View></View> : null}

    {panel === 'consent' ? <View className='mg-upload-mask mg-upload-mask--bottom'><View className='mg-upload-sheet mg-consent-sheet'>
      <Text className='mg-upload-sheet__title'>作品展示权限询问</Text><Text className='mg-consent-sheet__copy'>是否授权将您本次视频生成的3D建模作品用于小程序内案例展示？</Text><Text className='mg-consent-sheet__copy'>我们会为模型添加平台水印，不会泄露您的原始视频素材。您可以随时在个人中心关闭作品公开状态，拒绝则作品仅您本人可见。</Text>
      <View className='mg-upload-sheet__actions'><Button className='mg-upload-button mg-upload-button--muted' onClick={() => finishConsent('private')}>暂不授权</Button><Button className='mg-upload-button mg-upload-button--green' onClick={() => finishConsent('public')}>同意授权</Button></View>
    </View></View> : null}
    <BottomNav active='upload' />
  </View>
}
