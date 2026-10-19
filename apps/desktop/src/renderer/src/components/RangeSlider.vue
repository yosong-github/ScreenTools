<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: number
    label: string
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    valueText?: string | undefined
  }>(),
  { min: 0, max: 100, step: 1, valueText: undefined },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
  commit: [value: number]
}>()

function valueFrom(event: Event): number {
  return Number((event.target as HTMLInputElement).value)
}
</script>

<template>
  <input
    type="range"
    :value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :aria-label="label"
    :aria-valuetext="valueText"
    @input="emit('update:modelValue', valueFrom($event))"
    @change="emit('commit', valueFrom($event))"
  />
</template>
