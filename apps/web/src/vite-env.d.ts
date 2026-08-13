/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID: string
  readonly VITE_API_URL: string
  readonly VITE_X402_URL: string
  readonly VITE_RPC_URL: string
  readonly VITE_EXPLORER_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
