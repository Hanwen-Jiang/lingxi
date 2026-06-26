/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Real API base. Empty = Mock mode. Real = relative "/api" via the gateway. */
  readonly VITE_API_BASE?: string;
  /** Override the dev-proxy gateway target (e.g. the E2E segment :10110). */
  readonly VITE_GATEWAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
