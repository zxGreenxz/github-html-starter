// ============================================================================
// FACEBOOK API TYPES
// ============================================================================

export interface FacebookVideo {
  objectId: string;
  title: string;
  statusLive: 0 | 1;
  countComment: number;
  countReaction: number;
  channelCreatedTime: string;
  thumbnail?: {
    url: string;
  };
}

export interface FacebookComment {
  id: string;
  message: string;
  from: {
    name: string;
    id: string;
  };
  created_time: string;
  like_count: number;
  is_deleted?: boolean;
  is_deleted_by_tpos?: boolean;
  deleted_at?: string;
}

// ============================================================================
// TPOS API TYPES
// ============================================================================

export interface TPOSOrder {
  Id: string;
  Code: string;
  SessionIndex?: string | number;
  Facebook_UserId: string | null;
  Facebook_PostId: string;
  Facebook_ASUserId: string;
  Facebook_CommentId: string;
  Facebook_UserName: string;
  Telephone: string;
  Name: string;
  Note: string;
  PartnerId: number;
  PartnerName: string;
  PartnerStatus: string;
  PartnerStatusText: string | null;
  TotalAmount: number;
  TotalQuantity: number;
  DateCreated: string;
  StatusText: string;
  order_count?: number;
}

export interface TPOSPartner {
  Id: number;
  Name: string;
  Phone: string;
  Status: string;
  StatusText: string;
  Address: string;
  CityName: string;
  DistrictName: string;
  WardName: string;
}

// ============================================================================
// EXTENDED TYPES FOR UI
// ============================================================================

export interface CommentWithStatus extends FacebookComment {
  partnerStatus?: string;
  orderInfo?: TPOSOrder;
  isLoadingStatus?: boolean;
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface FacebookCommentArchive {
  facebook_comment_id: string;
  facebook_post_id: string;
  facebook_user_id: string;
  facebook_user_name: string;
  comment_message: string;
  comment_created_time: string;
  like_count: number;
}

export interface CustomerRecord {
  facebook_id: string;
  customer_name: string;
  phone: string | null;
  customer_status: string;
  info_status: 'complete' | 'incomplete';
}

export interface FacebookPage {
  id: string;
  page_id: string;
  page_name: string;
  crm_team_id: string | null;
  crm_team_name: string | null;
  created_at: string;
}

// ============================================================================
// CRM TYPES
// ============================================================================

export interface CRMTeam {
  Id: string;
  Name: string;
}

export interface CRMTeamParent {
  Id: number;
  Name: string;
  Childs?: CRMTeamChild[];
}

export interface CRMTeamChild {
  Id: number;
  Name: string;
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

export interface FacebookCommentsManagerProps {
  onVideoSelected?: (pageId: string, videoId: string, video: FacebookVideo | null) => void;
}

// ============================================================================
// INTERNAL STATE TYPES
// ============================================================================

export interface StatusMapEntry {
  partnerStatus?: string;
  orderInfo?: TPOSOrder;
  isLoadingStatus?: boolean;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface CommentsApiResponse {
  data: FacebookComment[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
  fromCache?: boolean;
}

export interface OrdersApiResponse {
  value: TPOSOrder[];
}

export interface CRMTeamsApiResponse {
  value: CRMTeamParent[];
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type CustomerStatus = 
  | 'Bình thường'
  | 'Bom hàng'
  | 'Cảnh báo'
  | 'Khách sỉ'
  | 'Nguy hiểm'
  | 'Thân thiết'
  | 'VIP'
  | 'Thiếu thông tin'
  | 'Cần thêm TT'
  | 'Khách lạ';

export type InfoStatus = 'complete' | 'incomplete';

export type VideoStatus = 0 | 1;

// ============================================================================
// FILTER & SEARCH TYPES
// ============================================================================

export interface CommentFilters {
  searchQuery: string;
  showOnlyWithOrders: boolean;
  hideNames: string[];
}

// ============================================================================
// STATISTICS TYPES
// ============================================================================

export interface VideoStatistics {
  totalVideos: number;
  liveVideos: number;
  totalComments: number;
  totalReactions: number;
}

// ============================================================================
// BARCODE TYPES
// ============================================================================

export interface ScannedBarcode {
  code: string;
  timestamp: string;
  productInfo?: {
    name: string;
    image_url?: string;
  };
}

// ============================================================================
// CONTEXT TYPES
// ============================================================================

export interface BarcodeScannerContextValue {
  scannedBarcodes: ScannedBarcode[];
  addScannedBarcode: (barcode: ScannedBarcode) => void;
  removeScannedBarcode: (code: string) => void;
  clearScannedBarcodes: () => void;
}

export interface CommentsSidebarContextValue {
  isCommentsOpen: boolean;
  setIsCommentsOpen: (isOpen: boolean) => void;
}

// ============================================================================
// MUTATION TYPES
// ============================================================================

export interface CreateOrderMutationVariables {
  comment: FacebookComment;
  video: FacebookVideo;
}

export interface CreateOrderMutationResponse {
  response: {
    Code: string;
    Id: string;
  };
}

export interface UpdateCrmTeamMutationVariables {
  pageId: string;
  crmTeamId: string;
  crmTeamName: string;
}

// ============================================================================
// QUERY KEY TYPES
// ============================================================================

export type FacebookPagesQueryKey = ['facebook-pages'];
export type FacebookVideosQueryKey = ['facebook-videos', string, string]; // [prefix, pageId, limit]
export type FacebookCommentsQueryKey = ['facebook-comments', string, string]; // [prefix, pageId, videoId]
export type TPOSOrdersQueryKey = ['tpos-orders', string]; // [prefix, videoId]
export type CRMTeamsQueryKey = ['crm-teams'];

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

// ============================================================================
// STORAGE KEYS TYPE
// ============================================================================

export const STORAGE_KEYS = {
  PAGE_ID: 'liveProducts_commentsPageId',
  SELECTED_VIDEO: 'liveProducts_selectedFacebookVideo',
  VIDEO_ID: 'liveProducts_commentsVideoId',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isFacebookVideo(obj: any): obj is FacebookVideo {
  return (
    typeof obj === 'object' &&
    typeof obj.objectId === 'string' &&
    typeof obj.title === 'string' &&
    (obj.statusLive === 0 || obj.statusLive === 1) &&
    typeof obj.countComment === 'number' &&
    typeof obj.countReaction === 'number'
  );
}

export function isFacebookComment(obj: any): obj is FacebookComment {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.message === 'string' &&
    typeof obj.from?.name === 'string' &&
    typeof obj.from?.id === 'string'
  );
}

export function isTPOSOrder(obj: any): obj is TPOSOrder {
  return (
    typeof obj === 'object' &&
    typeof obj.Id === 'string' &&
    typeof obj.Code === 'string' &&
    typeof obj.Name === 'string'
  );
}

// ============================================================================
// HELPER TYPE UTILITIES
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

export type AsyncResult<T> = Promise<T>;
export type AsyncData<T> = { data: T; error: null } | { data: null; error: Error };