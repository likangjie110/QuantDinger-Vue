import Vue from 'vue'
import 'vuex'
import 'vue-router'
import 'vue-i18n'
import type { Modal, message, notification } from 'ant-design-vue'
import type { Form } from 'ant-design-vue/types/form/form'
import type { HttpClient } from './http'

interface InstalledPlugins {
  $http: HttpClient
  axios: HttpClient
  $message: typeof message
  $notification: typeof notification
  $confirm: typeof Modal.confirm
  $info: typeof Modal.info
  $success: typeof Modal.success
  $error: typeof Modal.error
  $warning: typeof Modal.warning
  $form: Form
}

// Ant Design Vue 1.x augments the legacy Vue instance; Vue 2.7's
// defineComponent additionally reads ComponentCustomProperties.
declare module 'vue' {
  interface ComponentCustomProperties extends InstalledPlugins {
    $store: Vue['$store']
    $router: Vue['$router']
    $route: Vue['$route']
    $i18n: Vue['$i18n']
    $t: Vue['$t']
    $tc: Vue['$tc']
    $te: Vue['$te']
    $d: Vue['$d']
    $n: Vue['$n']
  }
}

declare module 'vue/types/vue' {
  interface Vue {
    $http: HttpClient
    axios: HttpClient
  }
}
