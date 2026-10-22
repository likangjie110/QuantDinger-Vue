// These browser constants are replaced by define in vite.config.js.
declare const APP_VERSION: string
declare const GIT_HASH: string
declare const BUILD_DATE: string

declare const process: {
  readonly env: {
    readonly NODE_ENV?: 'development' | 'production' | 'test'
    readonly APP_VERSION?: string
    readonly VUE_APP_VERSION?: string
    readonly VUE_APP_PREVIEW?: string
    readonly VUE_APP_API_BASE_URL?: string
    readonly VUE_APP_PYTHON_API_BASE_URL?: string
    readonly VUE_APP_PYODIDE_CDN_BASE?: string
    readonly VUE_APP_PYODIDE_LOCAL_BASE?: string
    readonly VUE_APP_PYODIDE_PREFER_CDN?: string
  }
}
