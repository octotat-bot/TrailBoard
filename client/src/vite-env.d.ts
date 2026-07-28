/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Yjs sync server, e.g. ws://localhost:1234 */
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
