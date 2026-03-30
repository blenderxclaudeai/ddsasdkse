export interface ProductData {
  product_url: string;
  product_title: string;
  product_image: string;
  product_category?: string;
  product_price?: string;
  retailer_domain?: string;
}

export interface TryOnResponse {
  ok: boolean;
  tryOnId?: string;
  resultImageUrl?: string;
  error?: string;
  missingPhoto?: string;
}

// ── Message types ──

export interface AuthLoginMessage {
  type: "AUTH_LOGIN";
  provider: "google" | "apple";
}

export interface AuthLogoutMessage {
  type: "AUTH_LOGOUT";
}

export interface AuthGetUserMessage {
  type: "AUTH_GET_USER";
}

export interface AuthRefreshMessage {
  type: "AUTH_REFRESH";
}

export interface ProductDetectedMessage {
  type: "PRODUCT_DETECTED";
  payload: ProductData;
}

export interface TryOnMessage {
  type: "CARTIFY_TRYON_REQUEST";
  payload: ProductData;
  background?: boolean;
}

export type ExtensionMessage =
  | AuthLoginMessage
  | AuthLogoutMessage
  | AuthGetUserMessage
  | AuthRefreshMessage
  | ProductDetectedMessage
  | TryOnMessage;
