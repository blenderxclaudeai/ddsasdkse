export interface ProductData {
  product_url: string;
  product_title: string;
  product_image: string;
}

export interface TryOnResponse {
  ok: boolean;
  tryOnId?: string;
  resultImageUrl?: string;
  error?: string;
}

export interface TryOnMessage {
  type: "VTO_TRYON_REQUEST";
  payload: ProductData;
}

export interface AuthMessage {
  type: "VTO_GET_AUTH";
}
