import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Input, Text, Video, View } from '@tarojs/components'
import { BottomNav } from '@/components/BottomNav'
import { LoginPrompt } from '@/components/LoginPrompt'
import {
  abortVideoUpload, completeVideoUpload, uploadVideoParts, type UploadSession
} from '@/services/upload'

type UploadPanel = 'camera' | 'confirm' | 'uploading' | 'success' | 'failure' | 'consent'
interface LocalVideo { path: string; size: number; duration: number }

function uploadError(error: unknown) {
  return error instanceof Error ? error.message : String(error || '上传失败')
}

function videoFileName(path: string) {
  const name = path.split(/[\\/]/).pop()
  return name && name.includes('.') ? name : `video-${Date.now()}.mp4`
}

function videoMimeType(path: string) {
  return path.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4'
}

export default function UploadPage() {
  const loggedIn = Boolean(Taro.getStorageSync<string>('accessToken'))
  const [video, setVideo] = useState<LocalVideo | null>(null)
  const [panel, setPanel] = useState<UploadPanel>('camera')
  const [requirementsOpen, setRequirementsOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const [modelObjectName, setModelObjectName] = useState('')
  const [uploadSession, setUploadSession] = useState<UploadSession | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const activeUploadId = useRef('')

  useEffect(() => () => {
    if (activeUploadId.current) {
      void abortVideoUpload(activeUploadId.current).catch(() => undefined)
    }
  }, [])

  const reset = () => {
    activeUploadId.current = ''
    setVideo(null)
    setUploadSession(null)
    setProgress(0)
    setModelObjectName('')
    setErrorMessage('')
    setSubmitting(false)
    setPanel('camera')
  }

  const choose = async (sourceType: Array<'album' | 'camera'>) => {
    try {
      const result = await Taro.chooseMedia({ count: 1, mediaType: ['video'], sourceType })
      const file = result.tempFiles[0]
      if (file) {
        if (activeUploadId.current) {
          void abortVideoUpload(activeUploadId.current).catch(() => undefined)
          activeUploadId.current = ''
        }
        setVideo({ path: file.tempFilePath, size: file.size, duration: file.duration ?? 0 })
        setUploadSession(null)
        setProgress(0)
        setModelObjectName('')
        setErrorMessage('')
        setPanel('confirm')
      }
    } catch (error) {
      const message = uploadError(error)
      if (!message.toLowerCase().includes('cancel')) {
        setErrorMessage(message)
        setPanel('failure')
      }
    }
  }

  const startUpload = async () => {
    if (!video) return
    setPanel('uploading')
    setProgress(0)
    setErrorMessage('')
    setUploadSession(null)
    try {
      const session = await uploadVideoParts({
        filePath: video.path,
        fileName: videoFileName(video.path),
        fileSize: video.size,
        durationSeconds: video.duration,
        mimeType: videoMimeType(video.path),
        onPrepared: (uploadId) => { activeUploadId.current = uploadId },
        onProgress: setProgress
      })
      setUploadSession(session)
      setProgress(100)
      setPanel('success')
    } catch (error) {
      const uploadId = activeUploadId.current
      activeUploadId.current = ''
      if (uploadId) void abortVideoUpload(uploadId).catch(() => undefined)
      setErrorMessage(uploadError(error))
      setPanel('failure')
    }
  }

  const continueAfterUpload = () => {
    if (!modelObjectName.trim()) {
      void Taro.showToast({ title: '请填写模型物体名称', icon: 'none' })
      return
    }
    setPanel('consent')
  }

  const finishConsent = async (visibility: 'public' | 'private') => {
    if (!uploadSession || !modelObjectName.trim()) {
      setErrorMessage('上传会话已失效，请重新上传')
      setPanel('failure')
      return
    }
    setSubmitting(true)
    try {
      const accepted = await completeVideoUpload(uploadSession, modelObjectName.trim(), visibility)
      activeUploadId.current = ''
      reset()
      await Taro.showToast({ title: '建模任务已创建', icon: 'success' })
      await Taro.navigateTo({ url: '/pages/order-detail/index?id=' + encodeURIComponent(accepted.orderId) })
    } catch (error) {
      setErrorMessage(uploadError(error))
      setSubmitting(false)
      setPanel('failure')
    }
  }

  return <View className='page page--with-tabs page--locked mg-upload-page'>
    <View className='mg-upload-header'><Text className='mg-upload-header__back tap-feedback' onClick={() => void Taro.navigateBack()}>‹</Text><Text className='mg-upload-header__title'>拍摄/上传360°视频</Text></View>
    <View className='mg-upload-preview'>
      {video
        ? <Video className='mg-upload-preview__video' src={video.path} controls objectFit='contain' />
        : <View className='mg-upload-preview__empty'><Text className='mg-upload-preview__empty-icon'>＋</Text><Text>请选择用于建模的环绕视频</Text></View>}
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
      <View className='mg-upload-sheet__actions'><Button className='mg-upload-button mg-upload-button--muted' onClick={() => { setVideo(null); setPanel('camera') }}>重新拍摄/上传</Button><Button className='mg-upload-button mg-upload-button--green' onClick={() => void startUpload()}>确认</Button></View>
    </View></View> : null}

    {panel === 'uploading' || panel === 'success' || panel === 'failure' ? <View className='mg-upload-mask mg-upload-mask--light'><View className={'mg-upload-card ' + (panel === 'success' ? 'mg-upload-card--success-form' : '')}>
      <Text className='mg-upload-card__title'>{panel === 'uploading' ? '上传中' : panel === 'success' ? '上传成功' : '上传失败'}</Text>
      <Text className='mg-upload-card__limit'>{panel === 'failure' ? '请检查网络、登录状态或视频文件' : '进度来自后端分片上传结果'}</Text>
      <View className={'mg-upload-card__dropzone ' + (panel === 'success' ? 'mg-upload-card__dropzone--success' : '')}>
        {panel === 'success' ? <><View className='mg-upload-success'>✓</View><Text className='mg-upload-card__message'>视频分片已全部上传</Text></> : panel === 'failure' ? <><View className='mg-upload-failure'>×</View><Text className='mg-upload-card__message'>失败原因</Text><Text className='mg-upload-card__reason'>{errorMessage || '上传请求未完成'}</Text></> : <><View className='mg-upload-folder' /><View className='mg-upload-progress'><View className='mg-upload-progress__bar' style={{ width: progress + '%' }} /></View><Text className='mg-upload-card__message'>{progress}%</Text></>}
      </View>
      {panel === 'success' ? <View className='mg-model-object-form'>
        <Text className='mg-model-object-form__label'>模型物体</Text>
        <Input className='mg-model-object-form__input' value={modelObjectName} maxlength={40} placeholder='请输入你要生成的模型物体是什么' onInput={(event) => setModelObjectName(event.detail.value)} />
        <Button className='mg-upload-button mg-upload-button--green mg-model-object-form__button' onClick={continueAfterUpload}>下一步</Button>
      </View> : null}
      {panel === 'failure' ? <View className='mg-upload-sheet__actions mg-upload-card__failure-actions'><Button className='mg-upload-button mg-upload-button--muted' onClick={reset}>返回上传页</Button><Button className='mg-upload-button mg-upload-button--green' onClick={() => video ? void startUpload() : reset()}>{video ? '重新上传' : '重新选择'}</Button></View> : null}
    </View></View> : null}

    {panel === 'consent' ? <View className='mg-upload-mask mg-upload-mask--bottom'><View className='mg-upload-sheet mg-consent-sheet'>
      <Text className='mg-upload-sheet__title'>作品展示权限询问</Text><Text className='mg-consent-sheet__copy'>是否授权将您本次视频生成的3D建模作品用于小程序内案例展示？</Text><Text className='mg-consent-sheet__copy'>我们会为模型添加平台水印，不会泄露您的原始视频素材。您可以随时在个人中心关闭作品公开状态，拒绝则作品仅您本人可见。</Text>
      <View className='mg-upload-sheet__actions'><Button disabled={submitting} className='mg-upload-button mg-upload-button--muted' onClick={() => void finishConsent('private')}>暂不授权</Button><Button loading={submitting} disabled={submitting} className='mg-upload-button mg-upload-button--green' onClick={() => void finishConsent('public')}>同意授权</Button></View>
    </View></View> : null}
    <BottomNav active='upload' />
    <LoginPrompt
      visible={!loggedIn}
      title='登录后上传视频'
      message='视频上传会创建专属建模订单，需要登录后才能继续。'
      cancelLabel='返回首页'
      onCancel={() => void Taro.redirectTo({ url: '/pages/home/index' })}
    />
  </View>
}
