<script setup lang="ts">
import { TabsTrigger, type TabsTriggerProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<TabsTriggerProps & { class?: string }>()
</script>

<template>
  <TabsTrigger
    :class="cn(
      'inline-flex h-full flex-1 items-center justify-center rounded-tab text-[15px] text-ncmd-muted transition-colors',
      'data-[state=active]:bg-ncmd-elevated data-[state=active]:font-semibold data-[state=active]:text-ncmd-fg',
      props.class,
    )"
  >
    <slot />
  </TabsTrigger>
</template>
