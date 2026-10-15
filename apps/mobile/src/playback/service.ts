/**
 * 后台播放服务。
 *
 * RN 的 JS 线程在应用退到后台、锁屏或从最近任务划掉之后仍需要响应通知栏 /
 * 锁屏 / 耳机按键，这部分逻辑必须注册成 RNTP 的 playback service ——
 * 它由原生侧在需要时拉起，而不是普通组件生命周期的一部分。
 *
 * 这里只处理「TrackPlayer 自己能做」的动作（播放/暂停/停止/跳转），
 * 换曲要重新取流（音源地址是带签名的短链，会过期），所以交给
 * src/player.ts 的 next()/prev()，通过事件回传。
 */
import TrackPlayer, { Event } from 'react-native-track-player'

export default async function playbackService(): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play())
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause())
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop())
  TrackPlayer.addEventListener(Event.RemoteSeek, e => {
    void TrackPlayer.seekTo(e.position)
  })
  // 通知栏的上一首 / 下一首：TrackPlayer 队列里已经有预取的相邻曲目，
  // 直接让它原生跳转，避免后台时还要走一遍 JS 取流。
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    void TrackPlayer.skipToNext().catch(() => undefined)
  })
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    void TrackPlayer.skipToPrevious().catch(() => undefined)
  })
}
