import DefaultTheme from 'vitepress/theme'
import '@fontsource-variable/archivo/wdth.css'
import '@fontsource-variable/inter/wght.css'
import '@fontsource/geist-mono/latin-400.css'
import '@fontsource/geist-mono/latin-500.css'
import '@fontsource/instrument-serif/latin-400-italic.css'
import '@fontsource/instrument-serif/latin-400.css'
import '@fontsource/instrument-serif/latin-ext-400-italic.css'
import '@fontsource/instrument-serif/latin-ext-400.css'
import '@fontsource/noto-sans-sc/chinese-simplified-400.css'
import '@fontsource/noto-sans-sc/chinese-simplified-500.css'
import '@fontsource/noto-serif-sc/chinese-simplified-400.css'
import Layout from './Layout.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
}
