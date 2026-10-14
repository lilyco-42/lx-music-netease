/**
 * 播放器页 —— 全屏黑胶 + 歌词 + 控制条
 * 实测规格：黑胶外圈直径 ~300，内圈 ~180；歌词区自下而上；
 * 播放按钮红色圆形 64px；底部功能行 4 个图标。
 */
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import {
  ChevronDownIcon, MoreIcon, HeartIcon, CommentIcon, ShareIcon, ListIcon,
  LoopIcon, ShuffleIcon, SkipIcon, PlayIcon, PauseIcon,
} from '../components/Icons'
import { colors, topInset } from '../theme'

const LYRICS = [
  { t: 0, text: '夜色把城市轻轻盖住' },
  { t: 1, text: '我把耳机调到最舒服的音量' },
  { t: 2, text: '这条路走了一千遍' },
  { t: 3, text: '还是想再听一遍' },
]
const CURRENT = 1

export default function PlayerScreen() {
  const [playing, setPlaying] = useState(true)
  const progress = 0.36

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: topInset }}>
      {/* 顶栏 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 }}>
        <Pressable hitSlop={12}>
          <ChevronDownIcon size={24} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1, marginHorizontal: 12 }}>
          <Text numberOfLines={1} style={{ color: colors.fg, fontSize: 16, fontWeight: '600' }}>
            城市夜航
          </Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>
            林一 / 陈默
          </Text>
        </View>
        <Pressable hitSlop={12}>
          <MoreIcon size={22} />
        </Pressable>
      </View>

      {/* 黑胶 */}
      <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 22 }}>
        <View
          style={{
            width: 300,
            height: 300,
            borderRadius: 150,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#2c2c2c',
          }}
        >
          {/* 纹路圈 */}
          <View style={{ position: 'absolute', width: 258, height: 258, borderRadius: 129, borderWidth: 1, borderColor: '#2a2a2a' }} />
          <View style={{ position: 'absolute', width: 216, height: 216, borderRadius: 108, borderWidth: 1, borderColor: '#282828' }} />
          {/* 专辑封面 */}
          <View
            style={{
              width: 180,
              height: 180,
              borderRadius: 90,
              backgroundColor: colors.elevated,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 3,
              borderColor: colors.accent,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 5, alignItems: 'flex-end' }}>
              {[0.45, 0.75, 0.6].map((h, i) => (
                <View key={i} style={{ width: 6, height: 70 * h, borderRadius: 3, backgroundColor: colors.fg }} />
              ))}
            </View>
          </View>
          {/* 中心轴 */}
          <View style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: colors.bg }} />
        </View>
        {/* 唱臂示意 */}
        <View
          style={{
            position: 'absolute',
            top: -8,
            right: 44,
            width: 8,
            height: 118,
            borderRadius: 4,
            backgroundColor: '#3a3a3a',
            transform: [{ rotate: '22deg' }],
          }}
        />
      </View>

      {/* 歌词 */}
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 32, marginTop: 20 }}>
        {LYRICS.map((l, i) => {
          const active = i === CURRENT
          const distance = Math.abs(i - CURRENT)
          return (
            <Text
              key={l.t}
              numberOfLines={1}
              style={{
                color: active ? colors.accent : colors.muted,
                fontSize: active ? 18 : 15,
                fontWeight: active ? '600' : '400',
                textAlign: 'center',
                marginVertical: 7,
                opacity: distance === 0 ? 1 : distance === 1 ? 0.7 : 0.4,
              }}
            >
              {l.text}
            </Text>
          )
        })}
      </View>

      {/* 进度条 */}
      <View style={{ paddingHorizontal: 24 }}>
        <View style={{ height: 3, borderRadius: 2, backgroundColor: '#2c2c2c', overflow: 'hidden' }}>
          <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: colors.accent }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 }}>
          <Text style={{ color: colors.fainter, fontSize: 11 }}>01:42</Text>
          <Text style={{ color: colors.fainter, fontSize: 11 }}>04:38</Text>
        </View>
      </View>

      {/* 控制条 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 36, marginTop: 16 }}>
        <Pressable hitSlop={10}>
          <ShuffleIcon size={20} />
        </Pressable>
        <Pressable hitSlop={10}>
          <SkipIcon size={24} direction="prev" />
        </Pressable>
        <Pressable
          onPress={() => setPlaying(p => !p)}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {playing ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
        </Pressable>
        <Pressable hitSlop={10}>
          <SkipIcon size={24} direction="next" />
        </Pressable>
        <Pressable hitSlop={10}>
          <LoopIcon size={20} />
        </Pressable>
      </View>

      {/* 底部功能行 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 32, paddingVertical: 20 }}>
        <Pressable hitSlop={10}><HeartIcon size={22} /></Pressable>
        <Pressable hitSlop={10}><CommentIcon size={22} /></Pressable>
        <Pressable hitSlop={10}><ShareIcon size={22} /></Pressable>
        <Pressable hitSlop={10}><ListIcon size={22} /></Pressable>
      </View>
    </View>
  )
}
