import { AppRegistry } from 'react-native'
import TrackPlayer from 'react-native-track-player'

import App from './App'
import { name as appName } from './app.json'
import playbackService from './src/playback/service'

AppRegistry.registerComponent(appName, () => App)

// 必须注册：应用退到后台 / 锁屏后，通知栏与耳机的播放控制由原生侧
// 拉起这个 service 来响应，普通组件此时已经不再挂载。
TrackPlayer.registerPlaybackService(() => playbackService)
