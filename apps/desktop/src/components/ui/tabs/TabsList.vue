<script setup lang="ts">
import { TabsList, type TabsListProps } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<TabsListProps & { class?: string }>()
</script>

<template>
  <TabsList
    :class="cn('inline-flex h-[42px] w-[222px] items-center rounded-tab bg-ncmd-surface p-0.5', props.class)"
  >
    <slot />
  </TabsList>
</template>
