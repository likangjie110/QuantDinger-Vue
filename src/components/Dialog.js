import Modal from 'ant-design-vue/es/modal'

/**
 * @typedef {Object} DialogProps
 * @property {Record<string, unknown>} [model]
 * @property {Record<string, unknown>} [attrs]
 * @property {Record<string, unknown>} [on]
 */

export default (Vue) => {
  /**
   * @this {import('vue').ComponentPublicInstance & { _isVue?: boolean }}
   * @param {import('vue').Component} component
   * @param {DialogProps} [componentProps]
   * @param {DialogProps} [modalProps]
   */
  function dialog (component, componentProps, modalProps) {
    const _vm = this
    modalProps = modalProps || {}
    if (!_vm || !_vm._isVue) {
      return
    }
    let dialogDiv = document.querySelector('body>div[type=dialog]')
    if (!dialogDiv) {
      dialogDiv = document.createElement('div')
      dialogDiv.setAttribute('type', 'dialog')
      document.body.appendChild(dialogDiv)
    }

    const handle = function (checkFunction, afterHandel) {
      if (checkFunction instanceof Function) {
        const res = checkFunction()
        if (res instanceof Promise) {
          res.then(c => {
            c && afterHandel()
          })
        } else {
          res && afterHandel()
        }
      } else {
        // checkFunction && afterHandel()
        checkFunction || afterHandel()
      }
    }

    const dialogInstance = new Vue({
      data () {
        return {
          visible: true
        }
      },
      router: _vm.$router,
      store: _vm.$store,
      mounted () {
        this.$on('close', (v) => {
          this.handleClose()
        })
      },
      methods: {
        handleClose () {
          handle(this.$refs._component.onCancel, () => {
            this.visible = false
            this.$refs._component.$emit('close')
            this.$refs._component.$emit('cancel')
            dialogInstance.$destroy()
          })
        },
        handleOk () {
          handle(this.$refs._component.onOK || this.$refs._component.onOk, () => {
            this.visible = false
            this.$refs._component.$emit('close')
            this.$refs._component.$emit('ok')
            dialogInstance.$destroy()
          })
        }
      },
      render: function (h) {
        const that = this
        const modalModel = modalProps && modalProps.model
        if (modalModel) {
          delete modalProps.model
        }
        const ModalProps = Object.assign({}, modalModel && { model: modalModel } || {}, {
          attrs: Object.assign({}, {
            ...(modalProps.attrs || modalProps)
          }, {
            visible: this.visible
          }),
          on: Object.assign({}, {
            ...(modalProps.on || modalProps)
          }, {
            ok: () => {
              that.handleOk()
            },
            cancel: () => {
              that.handleClose()
            }
          })
        })

        const componentModel = componentProps && componentProps.model
        if (componentModel) {
          delete componentProps.model
        }
        const ComponentProps = Object.assign({}, componentModel && { model: componentModel } || {}, {
          ref: '_component',
          attrs: Object.assign({}, {
            ...((componentProps && componentProps.attrs) || componentProps)
          }),
          on: Object.assign({}, {
            ...((componentProps && componentProps.on) || componentProps)
          })
        })

        return h(Modal, ModalProps, [h(component, ComponentProps)])
      }
    }).$mount(dialogDiv)
  }

  Object.defineProperty(Vue.prototype, '$dialog', {
    get: () => {
      /** @type {(this: import('vue').ComponentPublicInstance) => void} */
      const handler = function () {
        dialog.apply(this, arguments)
      }
      return handler
    }
  })
}
