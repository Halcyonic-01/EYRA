/** Shapes shared by the review pages, components and routes. Free of server code. */

export type ReviewSort = "newest" | "highest" | "lowest";
export const REVIEW_SORTS: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

export interface RatingSummary {
  average: number;
  count: number;
  breakdown: Record<"1" | "2" | "3" | "4" | "5", number>;
}

export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  display_name: string;
  variant_title: string | null;
  verified_purchase: boolean;
  submitted_at: string;
  edited: boolean;
  photos: { id: string; url: string }[];
}

export interface ProductReviewsPage {
  product_id: string | null;
  summary: RatingSummary;
  photo_count: number;
  reviews: PublicReview[];
  count: number;
  offset: number;
  limit: number;
}

export interface SessionReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  display_name: string;
  status: "pending" | "approved" | "rejected";
  photos: { id: string; url: string }[];
}

export interface SessionItem {
  line_item_id: string;
  product_id: string;
  title: string;
  variant: string | null;
  handle: string | null;
  thumbnail: string | null;
  review: SessionReview | null;
}

export interface ReviewSession {
  state: "ok" | "used" | "expired" | "not_reviewable" | "invalid";
  order_id: string;
  order_number: number;
  first_name: string | null;
  suggested_name: string;
  expires_at: string | null;
  items: SessionItem[];
}

export interface ReviewSubmission {
  line_item_id: string;
  rating: number;
  title?: string | null;
  body: string;
  display_name?: string | null;
  photo_ids?: string[];
}

export interface UploadedPhoto {
  id: string;
  url: string;
}

/** The same limits the backend enforces, so the form can say so before sending. */
export const REVIEW_LIMITS = {
  titleMax: 80,
  bodyMin: 10,
  bodyMax: 2000,
  nameMax: 40,
  photosPerReview: 4,
  /** Before the storefront shrinks it. */
  photoInputBytes: 10 * 1024 * 1024,
};
