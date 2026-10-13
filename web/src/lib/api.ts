export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export interface UserProfile {
  id: string;
  telegramId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  phone: string | null;
  role: 'CUSTOMER' | 'MASTER' | 'ADMIN';
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  masterProfile?: {
    id: string;
    bio: string;
    experienceYears: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
    rejectReason?: string | null;
    ratingAvg: string | number;
    ratingCount: number;
    completedCount: number;
  } | null;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface HealthResponse {
  ok: boolean;
  db: boolean;
  time: string;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  token?: string | null;
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// Token faqat xotirada ushlanadi (localStorage'da saqlanmaydi)
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const tokenToUse = options.token ?? authToken;
  if (tokenToUse) {
    headers['Authorization'] = `Bearer ${tokenToUse}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    if (isJson) {
      const errorData = (await response.json()) as ApiErrorResponse;
      throw new ApiError(
        errorData.error?.message || 'Server xatosi',
        errorData.error?.code || 'UNKNOWN_ERROR',
        response.status,
      );
    }
    throw new ApiError(
      `So'rov muvaffaqiyatsiz tugadi (${response.status})`,
      'HTTP_ERROR',
      response.status,
    );
  }

  if (!isJson) {
    return null as unknown as T;
  }

  return (await response.json()) as T;
}

export interface ServiceItem {
  id: string;
  slug: string;
  nameUz: string;
  isActive: boolean;
}

export interface DistrictItem {
  id: string;
  nameUz: string;
}

export interface ApplyMasterInput {
  bio: string;
  experienceYears: number;
  serviceIds: string[];
  districtIds: string[];
}

export type PreferredTime = 'ASAP' | 'TODAY' | 'THIS_WEEK' | 'FLEXIBLE';
export type RequestStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export interface RequestPhotoItem {
  id: string;
  storagePath: string;
  signedUrl: string;
  createdAt: string;
}

export interface CreateRequestInput {
  serviceId: string;
  districtId: string;
  title: string;
  description: string;
  addressDetail: string;
  preferredTime?: PreferredTime;
  budgetMin?: number;
  budgetMax?: number;
  photoPaths: string[];
}

export interface OfferItem {

  id: string;
  price: number;
  message: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  createdAt: string;
  master: {
    id: string;
    bio: string;
    experienceYears: number;
    ratingAvg: number;
    ratingCount: number;
    completedCount: number;
    user: {
      id: string;
      firstName: string;
      lastName: string | null;
      username: string | null;
      photoUrl: string | null;
      phone?: string | null;
    };
  };
}

export interface MyOfferItem {
  id: string;
  price: number;
  message: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  createdAt: string;
  request: {
    id: string;
    title: string;
    status: RequestStatus;
    service: ServiceItem;
    district: DistrictItem;
    preferredTime?: PreferredTime | null;
    budgetMin?: number | null;
    budgetMax?: number | null;
  };
}

export interface RequestItem {
  id: string;
  customerId?: string;
  serviceId: string;
  districtId: string;
  title: string;
  description: string;
  addressDetail?: string;
  preferredTime?: PreferredTime | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  status: RequestStatus;
  selectedOfferId?: string | null;
  createdAt: string;
  updatedAt: string;
  service: ServiceItem;
  district: DistrictItem;
  photos: RequestPhotoItem[];
  offersCount?: number;
  offers?: OfferItem[];
  selectedOffer?: OfferItem | null;
  myOffer?: {
    id: string;
    price: number;
    message: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
    createdAt: string;
  } | null;
  customer?: {
    firstName: string;
    lastName: string | null;
    username?: string | null;
    phone: string | null;
  };
}


export interface SignUploadResponse {
  path: string;
  signedUrl: string;
  token?: string;
}

export interface MasterRequestItem {
  id: string;
  title: string;
  description: string;
  preferredTime?: PreferredTime | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  status: RequestStatus;
  service: ServiceItem;
  district: DistrictItem;
  photos: RequestPhotoItem[];
  offersCount: number;
  hasOffered: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicMasterReview {
  id: string;
  rating: number;
  comment: string | null;
  customerName: string;
  createdAt: string;
}

export interface PublicMasterProfile {
  id: string;
  userId: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  bio: string;
  experienceYears: number;
  ratingAvg: number;
  ratingCount: number;
  completedCount: number;
  services: ServiceItem[];
  districts: DistrictItem[];
  reviews: PublicMasterReview[];
}

export const api = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),
  getHealth: () => apiRequest<HealthResponse>('/health', { method: 'GET' }),
  loginTelegram: (initData: string) =>
    apiRequest<AuthResponse>('/auth/telegram', {
      method: 'POST',
      body: { initData },
    }),
  getMe: () => apiRequest<{ user: UserProfile }>('/me', { method: 'GET' }),
  getServices: () => apiRequest<{ services: ServiceItem[] }>('/services', { method: 'GET' }),
  getDistricts: () => apiRequest<{ districts: DistrictItem[] }>('/districts', { method: 'GET' }),
  applyMaster: (data: ApplyMasterInput) =>
    apiRequest<{ ok: boolean; masterProfile: UserProfile['masterProfile'] }>('/master/apply', {
      method: 'POST',
      body: data,
    }),
  signUpload: (contentType: 'image/jpeg' | 'image/png' | 'image/webp') =>
    apiRequest<SignUploadResponse>('/uploads/sign', {
      method: 'POST',
      body: { contentType },
    }),
  createRequest: (data: CreateRequestInput) =>
    apiRequest<{ ok: boolean; request: RequestItem }>('/requests', {
      method: 'POST',
      body: data,
    }),
  getMyRequests: () =>
    apiRequest<{ requests: RequestItem[] }>('/requests/mine', {
      method: 'GET',
    }),
  getRequestById: (id: string) =>
    apiRequest<{ request: RequestItem }>(`/requests/${id}`, {
      method: 'GET',
    }),
  cancelRequest: (id: string, reason?: string) =>
    apiRequest<{ ok: boolean; status: string }>(`/requests/${id}/cancel`, {
      method: 'POST',
      body: reason ? { reason } : undefined,
    }),
  startWork: (requestId: string) =>
    apiRequest<{ ok: boolean; status: string }>(`/requests/${requestId}/start`, {
      method: 'POST',
    }),
  completeWork: (requestId: string) =>
    apiRequest<{ ok: boolean; status: string }>(`/requests/${requestId}/complete`, {
      method: 'POST',
    }),
  submitReview: (requestId: string, data: { rating: number; comment?: string }) =>
    apiRequest<{ ok: boolean; review: unknown }>(`/requests/${requestId}/review`, {
      method: 'POST',
      body: data,
    }),
  getMasterProfile: (masterId: string) =>
    apiRequest<{ master: PublicMasterProfile }>(`/masters/${masterId}`, {
      method: 'GET',
    }),
  getMasterRequests: (params?: { page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiRequest<{
      requests: MasterRequestItem[];
      total: number;
      page: number;
      limit: number;
    }>(`/master/requests${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },
  createOffer: (requestId: string, data: { price: number; message: string }) =>
    apiRequest<{ ok: boolean; offer: OfferItem }>(`/requests/${requestId}/offers`, {
      method: 'POST',
      body: data,
    }),
  withdrawOffer: (offerId: string) =>
    apiRequest<{ ok: boolean; status: string }>(`/offers/${offerId}/withdraw`, {
      method: 'POST',
    }),
  getRequestOffers: (requestId: string) =>
    apiRequest<{ offers: OfferItem[] }>(`/requests/${requestId}/offers`, {
      method: 'GET',
    }),
  selectOffer: (requestId: string, offerId: string) =>
    apiRequest<{ ok: boolean; status: string; selectedOfferId: string }>(
      `/requests/${requestId}/select`,
      {
        method: 'POST',
        body: { offerId },
      },
    ),
  getMyOffers: () =>
    apiRequest<{ offers: MyOfferItem[] }>('/offers/mine', {
      method: 'GET',
    }),
  getAdminMasters: (status?: string) =>
    apiRequest<{ masters: AdminMasterItem[] }>(
      `/admin/masters${status ? `?status=${status}` : ''}`,
      { method: 'GET' },
    ),
  approveMaster: (id: string) =>
    apiRequest<{ ok: boolean; status: string }>(`/admin/masters/${id}/approve`, {
      method: 'POST',
    }),
  rejectMaster: (id: string, reason: string) =>
    apiRequest<{ ok: boolean; status: string }>(`/admin/masters/${id}/reject`, {
      method: 'POST',
      body: { reason },
    }),
  suspendMaster: (id: string, reason?: string) =>
    apiRequest<{ ok: boolean; status: string }>(`/admin/masters/${id}/suspend`, {
      method: 'POST',
      body: reason ? { reason } : undefined,
    }),
  blockUser: (id: string, reason: string) =>
    apiRequest<{ ok: boolean; isBlocked: boolean }>(`/admin/users/${id}/block`, {
      method: 'POST',
      body: { reason },
    }),
  unblockUser: (id: string) =>
    apiRequest<{ ok: boolean; isBlocked: boolean }>(`/admin/users/${id}/unblock`, {
      method: 'POST',
    }),
  getAdminRequests: (params?: { status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiRequest<{
      requests: AdminRequestItem[];
      total: number;
      page: number;
      limit: number;
    }>(`/admin/requests${qs ? `?${qs}` : ''}`, { method: 'GET' });
  },
  getAdminStats: () =>
    apiRequest<AdminStatsResponse>('/admin/stats', {
      method: 'GET',
    }),
};

export interface AdminMasterItem {
  id: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  bio: string;
  experienceYears: number;
  rejectReason?: string | null;
  ratingAvg: number;
  ratingCount: number;
  completedCount: number;
  createdAt: string;
  user: {
    id: string;
    telegramId: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    phone: string | null;
    photoUrl: string | null;
    isBlocked: boolean;
    createdAt: string;
  };
  services: ServiceItem[];
  districts: DistrictItem[];
}

export interface AdminRequestItem {
  id: string;
  title: string;
  description: string;
  addressDetail: string;
  preferredTime?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    username: string | null;
  };
  service: ServiceItem;
  district: DistrictItem;
  photosCount: number;
  offersCount: number;
  selectedOffer?: {
    id: string;
    price: number;
    message: string;
    masterName: string;
    masterPhone?: string | null;
  } | null;
}

export interface AdminStatsResponse {
  stats: {
    requests: { total: number; today: number };
    offers: { total: number; today: number };
    assigned: { total: number; today: number };
    completed: { total: number; today: number };
    activeMasters: number;
    pendingMasters: number;
    totalUsers: number;
  };
}
