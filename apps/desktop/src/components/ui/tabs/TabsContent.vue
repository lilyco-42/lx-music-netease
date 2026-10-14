<script setup lang="ts">
import { TabsContent, type TabsContentProps } from 'reka-ui'
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<TabsContentProps & { class?: string }>()

// reka-ui 的 props 不含 class，先剥离再透传，避免类型冲突
const delegated = computed(() => {
  const { class: _class, ...rest } = props
  return rest
})
</script>

<template>
  <TabsContent v-bind="delegated" :class="cn('outline-none', props.class)">
    <slot />
  </TabsContent>
</template>
