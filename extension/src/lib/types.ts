export interface ProductData {
  product_url: string;
  product_title: string;
  product_image: string;
  product_category?: string;
}

export interface TryOnResponse {
  ok: boolean;
  tryOnId?: string;
  resultImageUrl?: string;
  error?: string;
  missingPhoto?: string; // e.g. "fingers" — tells user which photo to upload
}

export interface TryOnMessage {
  type: "VTO_TRYON_REQUEST";
  payload: ProductData;
}

export interface AuthMessage {
  type: "VTO_GET_AUTH";
}
