import { useCallback, useEffect, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Button, Input, ScrollView, Text, View } from '@tarojs/components'
import { LoginPrompt } from '@/components/LoginPrompt'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { usePagedResource } from '@/hooks/usePagedResource'
import {
  createComment, fetchComments, fetchModelDetail, setCommentLike, setModelFavorite
} from '@/services/models'
import type { CommentItem, ModelDetail } from '@/types/api'

export default function ModelDetailPage() {
  const id = useRouter().params.id ?? 'model-1'
  const [model, setModel] = useState<ModelDetail | null>(null)
  const [modelError, setModelError] = useState('')
  const [commentText, setCommentText] = useState('')
  const [loginPrompt, setLoginPrompt] = useState(false)
  const [busyAction, setBusyAction] = useState('')

  const loadModel = useCallback(() => {
    setModelError('')
    void fetchModelDetail(id).then(setModel).catch((error) => {
      setModelError(error instanceof Error ? error.message : '模型详情加载失败')
    })
  }, [id])

  useEffect(loadModel, [loadModel])
  const loader = useCallback((page: number, pageSize: number) => fetchComments(id, { page, pageSize }), [id])
  const comments = usePagedResource(loader, 5)

  const requireLogin = () => {
    if (Taro.getStorageSync<string>('accessToken')) return true
    setLoginPrompt(true)
    return false
  }

  const openViewer = () => {
    if (!model) return
    void Taro.navigateTo({ url: `/subpackage-lab/model-viewer/index?modelId=${encodeURIComponent(model.id)}` })
  }

  const toggleFavorite = async () => {
    if (!model || !requireLogin() || busyAction) return
    setBusyAction('favorite')
    try {
      const result = await setModelFavorite(model.id, !model.isFavorite)
      setModel({ ...model, isFavorite: result.favorited, favoriteCount: result.favoriteCount })
      await Taro.showToast({ title: result.favorited ? '已收藏' : '已取消收藏', icon: 'none' })
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' })
    } finally {
      setBusyAction('')
    }
  }

  const submitComment = async () => {
    if (!requireLogin() || busyAction) return
    const content = commentText.trim()
    if (!content) {
      await Taro.showToast({ title: '请输入评论内容', icon: 'none' })
      return
    }
    setBusyAction('comment')
    try {
      await createComment(id, content)
      setCommentText('')
      comments.setPage(1)
      comments.refresh()
      loadModel()
      await Taro.showToast({ title: '评论已发布', icon: 'success' })
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '评论失败', icon: 'none' })
    } finally {
      setBusyAction('')
    }
  }

  const toggleCommentLike = async (comment: CommentItem) => {
    if (!requireLogin() || busyAction) return
    setBusyAction('like-' + comment.id)
    try {
      await setCommentLike(comment.id, !comment.likedByMe)
      comments.refresh()
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : '点赞失败', icon: 'none' })
    } finally {
      setBusyAction('')
    }
  }

  return <View className='page page--locked model-detail-page'>
    <PageHeader title='展品详细' back />
    <ScrollView className='model-detail-scroll' scrollY enhanced showScrollbar>
      <View className='detail-stage color-seed-2'><View className='detail-stage__object' /><Text>3D MODEL</Text></View>
      <View className='page-content detail-content'>
        <View className='detail-title-row'>
          <View className='detail-title-copy'>
            <Text className='detail-title'>{model?.title ?? (modelError ? '加载失败' : '加载中')}</Text>
            <Text className='detail-description'>{model?.description ?? modelError}</Text>
          </View>
          <View
            className={'favorite-button tap-feedback ' + (model?.isFavorite ? 'is-active' : '')}
            onClick={() => void toggleFavorite()}
          >
            <Text>{model?.isFavorite ? '已收藏' : '收藏'}</Text>
            {model ? <Text className='favorite-button__count'>{model.favoriteCount}</Text> : null}
          </View>
        </View>
        {model?.status === 'ready' && model.viewerAvailable ? <View className='model-viewer-entry tap-feedback' onClick={openViewer}><View className='model-viewer-entry__icon'><Text>3D</Text></View><View className='model-viewer-entry__copy'><Text className='model-viewer-entry__title'>查看 3D 模型</Text><Text className='model-viewer-entry__sub'>模型已生成完成，可旋转缩放查看</Text></View><Text className='model-viewer-entry__arrow'>›</Text></View> : null}
        <View className='owner-row tap-feedback' onClick={() => model && void Taro.navigateTo({ url: '/pages/user-profile/index?id=' + model.ownerId })}><View className='avatar'>{model?.ownerName.slice(0, 1) ?? ''}</View><Text>{model?.ownerName ?? ''}</Text><Text className='menu-row__arrow'>›</Text></View>
        <View className='section-heading'><Text className='section-heading__title'>评论</Text><Text className='section-heading__count'>{comments.total} 条</Text></View>
        <View className='comment-composer'>
          <Input
            className='comment-composer__input'
            value={commentText}
            maxlength={500}
            placeholder='说说你对这个模型的看法'
            onInput={(event) => setCommentText(event.detail.value)}
            onConfirm={() => void submitComment()}
          />
          <Button className='comment-composer__button' loading={busyAction === 'comment'} onClick={() => void submitComment()}>发布</Button>
        </View>
        {comments.loading && comments.items.length === 0 ? <View className='state-panel'>正在加载评论</View> : null}
        {comments.error ? <View className='state-panel'><Text>评论加载失败</Text><View className='state-panel__button tap-feedback' onClick={comments.refresh}>重新加载</View></View> : null}
        {!comments.loading && !comments.error && comments.items.length === 0 ? <View className='comment-empty'>还没有评论，欢迎第一个留言</View> : null}
        <View className='comment-list'>{comments.items.map((item) => <View key={item.id} className='comment-row'><View className='avatar'>{item.userName.slice(-1)}</View><View className='comment-row__main'><Text className='comment-row__name'>{item.userName}</Text><Text className='comment-row__content'>{item.content}</Text></View><View className={'comment-row__like tap-feedback ' + (item.likedByMe ? 'is-active' : '')} onClick={() => void toggleCommentLike(item)}><Text className='comment-row__heart'>♡</Text><Text>{item.likeCount}</Text></View></View>)}</View>
        {comments.items.length > 0 ? <Pagination page={comments.page} totalPages={comments.totalPages} total={comments.total} onChange={comments.setPage} /> : null}
      </View>
    </ScrollView>
    <LoginPrompt visible={loginPrompt} onCancel={() => setLoginPrompt(false)} />
  </View>
}
