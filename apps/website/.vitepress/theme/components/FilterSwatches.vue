<script setup lang="ts">
import { useId } from 'vue'
import ColorScene from './ColorScene.vue'
import { filterGroups, svgMatrix } from '../filters'

const prefix = `swatch-${useId()}`

function filterId(id: string): string {
  return `${prefix}-${id}`
}
</script>

<template>
  <div class="st-swatches">
    <svg class="st-swatch-defs" aria-hidden="true">
      <defs>
        <filter
          v-for="item in filterGroups.flatMap((group) => group.items)"
          :id="filterId(item.id)"
          :key="item.id"
          color-interpolation-filters="sRGB"
        >
          <feColorMatrix type="matrix" :values="svgMatrix(item.id)" />
        </filter>
      </defs>
    </svg>
    <section v-for="group in filterGroups" :key="group.label" class="st-swatch-group">
      <p class="st-hud">{{ group.label }}</p>
      <div class="st-swatch-grid">
        <article v-for="item in group.items" :key="item.id">
          <div class="st-swatch-media" :style="{ filter: `url(#${filterId(item.id)})` }">
            <ColorScene />
          </div>
          <div class="st-swatch-copy">
            <h3>{{ item.label }}</h3>
            <p>{{ item.detail }}</p>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.st-swatch-defs {
  position: absolute;
  width: 0;
  height: 0;
}

.st-swatch-group + .st-swatch-group {
  margin-top: 28px;
}

.st-swatch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin-top: 10px;
  background: var(--line);
  border: 1px solid var(--line);
}

.st-swatch-grid article {
  background: var(--bg);
}

.st-swatch-media {
  aspect-ratio: 16 / 9;
  background: var(--bg-sunken);
}

.st-swatch-copy {
  padding: 14px 16px 16px;
}

.st-swatch-copy h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 500;
  letter-spacing: -0.03em;
}

.st-swatch-copy p {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.6;
}

@media (min-width: 800px) {
  .st-swatch-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
