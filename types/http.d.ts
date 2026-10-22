import type { AxiosInstance, AxiosRequestConfig } from 'axios'

// Human API envelope from docs/architecture/API_CONVENTIONS.md.
// Payloads remain unknown until the endpoint or caller supplies its contract.
export interface HumanEnvelope<T = unknown> {
  code: number
  msg: string
  data: T
  error_hint?: string
  error_code?: string
}

type JsonConfig<D = unknown> = AxiosRequestConfig<D> & { responseType?: 'json' }
type BinaryConfig<K extends 'blob' | 'arraybuffer' | 'text'> = AxiosRequestConfig<unknown> & { responseType: K }

interface ReadMethod {
  (url: string, config: BinaryConfig<'blob'>): Promise<Blob>
  (url: string, config: BinaryConfig<'arraybuffer'>): Promise<ArrayBuffer>
  (url: string, config: BinaryConfig<'text'>): Promise<string>
  <T = unknown>(url: string, config?: JsonConfig): Promise<HumanEnvelope<T>>
}

interface WriteMethod {
  (url: string, data: unknown, config: BinaryConfig<'blob'>): Promise<Blob>
  (url: string, data: unknown, config: BinaryConfig<'arraybuffer'>): Promise<ArrayBuffer>
  (url: string, data: unknown, config: BinaryConfig<'text'>): Promise<string>
  <T = unknown, D = unknown>(url: string, data?: D, config?: JsonConfig<D>): Promise<HumanEnvelope<T>>
}

// Only this application's client unwraps response.data. Global Axios types stay intact.
export interface HttpClient extends Omit<AxiosInstance,
  'request' | 'get' | 'delete' | 'head' | 'options' | 'post' | 'put' | 'patch' | 'postForm' | 'putForm' | 'patchForm'> {
  (config: BinaryConfig<'blob'>): Promise<Blob>
  (config: BinaryConfig<'arraybuffer'>): Promise<ArrayBuffer>
  (config: BinaryConfig<'text'>): Promise<string>
  <T = unknown, D = unknown>(config: JsonConfig<D>): Promise<HumanEnvelope<T>>
  request: HttpClient
  get: ReadMethod
  delete: ReadMethod
  head: ReadMethod
  options: ReadMethod
  post: WriteMethod
  put: WriteMethod
  patch: WriteMethod
  postForm: WriteMethod
  putForm: WriteMethod
  patchForm: WriteMethod
}
