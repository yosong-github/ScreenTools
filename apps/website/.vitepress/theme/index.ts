import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import FilterPlayground from './components/FilterPlayground.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('FilterPlayground', FilterPlayground)
  },
}
