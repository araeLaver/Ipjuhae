/**
 * Typed API layer for Rentme Mobile.
 *
 * Wraps every server endpoint the app uses and maps the deployed server's
 * response shapes (mostly snake_case rows, amounts in 원 for property
 * endpoints, 만원 for the public /listings catalog) into the app's
 * camelCase types with amounts normalized to 만원.
 *
 * Server routes live in app/api/** of the main repo and are canonical —
 * all shape knowledge is concentrated here.
 */

import { apiClient } from './apiClient';
import {
  Conversation,
  DashboardStats,
  Listing,
  Message,
  PropertyImage,
  TenantProfile,
  User,
  VerificationStatus,
} from '../types';

const WON_PER_MANWON = 10000;
const toManwon = (won: number) => Math.round(won / WON_PER_MANWON);

// ─── Auth ────────────────────────────────────────────────────────────────────

/** POST /api/auth/login → { success, userId, token, user: { user_type } } */
export async function login(email: string, password: string): Promise<string> {
  const res = await apiClient.post<{ token: string }>('/auth/login', { email, password });
  return res.token;
}

/**
 * POST /api/auth/signup → { success, userId, token, userType }.
 * The server only accepts email/password/userType (+ optional inviteToken
 * during beta); there is no `name` field at signup.
 */
export async function signup(
  email: string,
  password: string,
  userType: string
): Promise<string> {
  const res = await apiClient.post<{ token: string }>('/auth/signup', {
    email,
    password,
    userType,
  });
  return res.token;
}

/** GET /api/auth/me → { user: { id, email, name, userType } } */
export async function fetchMe(): Promise<User> {
  const res = await apiClient.get<{ user: User | null }>('/auth/me');
  if (!res.user) throw new Error('UNAUTHORIZED');
  return res.user;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

// ─── Tenant profile / verifications ─────────────────────────────────────────

interface ProfileRow {
  user_id: string;
  name: string;
  age_range: string | null;
  family_type: string | null;
  pets: string[] | null;
  smoking: boolean;
  stay_time: string | null;
  duration: string | null;
  noise_level: string | null;
  bio: string | null;
  intro: string | null;
  trust_score: number;
  is_complete: boolean;
}

/** GET /api/profile → { profile, verification, trustScoreBreakdown, profileImage } */
export async function fetchTenantProfile(): Promise<TenantProfile | null> {
  const res = await apiClient.get<{ profile: ProfileRow | null }>('/profile');
  const p = res.profile;
  if (!p) return null;
  return {
    userId: p.user_id,
    name: p.name,
    ageRange: p.age_range,
    familyType: p.family_type,
    pets: p.pets ?? [],
    smoking: p.smoking,
    stayTime: p.stay_time,
    duration: p.duration,
    noiseLevel: p.noise_level,
    bio: p.bio,
    intro: p.intro,
    trustScore: p.trust_score ?? 0,
    isComplete: p.is_complete ?? false,
  };
}

interface VerificationRow {
  employment_verified: boolean;
  income_verified: boolean;
  credit_verified: boolean;
  credit_grade: number | null;
}

/** GET /api/verifications → { verification } */
export async function fetchVerificationStatus(): Promise<VerificationStatus> {
  const res = await apiClient.get<{ verification: VerificationRow }>('/verifications');
  const v = res.verification;
  return {
    employmentVerified: v?.employment_verified ?? false,
    incomeVerified: v?.income_verified ?? false,
    creditVerified: v?.credit_verified ?? false,
    creditGrade: v?.credit_grade ?? null,
  };
}

/**
 * POST /api/verifications/documents — the server takes JSON metadata
 * { documentType, fileName } only (no binary upload endpoint exists);
 * it records the document and queues an extraction job.
 */
export async function submitVerificationDocument(
  documentType: 'employment' | 'income' | 'credit',
  fileName: string
): Promise<void> {
  await apiClient.post('/verifications/documents', { documentType, fileName });
}

// ─── Public listings (catalog) ───────────────────────────────────────────────

interface PublicListingRow {
  id: string;
  landlord_id: string;
  /** already 만원 (server divides 원 by 10000) */
  monthly_rent: number;
  /** already 만원 */
  deposit: number;
  address: string;
  region: string | null;
  property_type: string | null;
  area_sqm: number | null;
  floor: number | null;
  available_from: string | null;
  created_at: string;
  photo_urls: string[];
}

function photosToImages(urls: string[]): PropertyImage[] {
  return (urls ?? []).map((url, i) => ({
    id: String(i),
    imageUrl: url,
    thumbnailUrl: null,
    sortOrder: i,
    isMain: i === 0,
  }));
}

/**
 * GET /api/listings → { listings } — unified catalog over `properties`,
 * amounts already in 만원, no pagination (server returns up to 60 rows).
 */
export async function fetchListings(): Promise<Listing[]> {
  const res = await apiClient.get<{ listings: PublicListingRow[] }>('/listings');
  return (res.listings ?? []).map((l) => ({
    id: l.id,
    landlordId: l.landlord_id,
    title: [l.region, l.property_type].filter(Boolean).join(' ') || l.address,
    address: l.address,
    region: l.region,
    deposit: l.deposit,
    monthlyRent: l.monthly_rent,
    propertyType: l.property_type,
    areaSqm: l.area_sqm,
    floor: l.floor,
    status: 'available' as const,
    availableFrom: l.available_from,
    viewCount: 0,
    images: photosToImages(l.photo_urls),
    createdAt: l.created_at,
  }));
}

// ─── Property detail ─────────────────────────────────────────────────────────

interface PropertyDetailResponse {
  property: {
    id: string;
    landlordId: string;
    title: string;
    description: string | null;
    address: string;
    region: string | null;
    /** 원 */
    deposit: number;
    /** 원 */
    monthlyRent: number;
    /** 원 */
    maintenanceFee: number;
    propertyType: string;
    roomCount: number;
    bathroomCount: number;
    floor: number | null;
    totalFloor: number | null;
    areaSqm: number | null;
    options: string[];
    status: Listing['status'];
    availableFrom: string | null;
    viewCount: number;
    createdAt: string;
    landlord: { name: string | null; bio: string | null; profileImage: string | null };
  };
  images: PropertyImage[];
  isFavorited: boolean;
}

/**
 * GET /api/properties/[id] — the canonical detail endpoint.
 * (GET /api/listings/[id] still reads the legacy `listings` table and does
 * not match the ids returned by /api/listings, so it must not be used.)
 * Amounts are in 원 → converted to 만원.
 */
export async function fetchListingDetail(id: string): Promise<Listing> {
  const res = await apiClient.get<PropertyDetailResponse>(`/properties/${id}`);
  const p = res.property;
  return {
    id: p.id,
    landlordId: p.landlordId,
    landlordName: p.landlord?.name ?? null,
    title: p.title,
    address: p.address,
    region: p.region,
    deposit: toManwon(p.deposit),
    monthlyRent: toManwon(p.monthlyRent),
    maintenanceFee: toManwon(p.maintenanceFee ?? 0),
    propertyType: p.propertyType,
    roomCount: p.roomCount,
    bathroomCount: p.bathroomCount,
    floor: p.floor,
    totalFloor: p.totalFloor,
    areaSqm: p.areaSqm,
    options: p.options ?? [],
    description: p.description,
    status: p.status,
    availableFrom: p.availableFrom,
    viewCount: p.viewCount,
    images: res.images ?? [],
    createdAt: p.createdAt,
  };
}

// ─── Landlord properties ─────────────────────────────────────────────────────

interface LandlordPropertyRow {
  id: string;
  landlord_id: string;
  title: string;
  description: string | null;
  address: string;
  address_detail: string | null;
  region: string | null;
  /** 원 */
  deposit: number;
  /** 원 */
  monthly_rent: number;
  /** 원 */
  maintenance_fee: number;
  property_type: string;
  room_count: number;
  bathroom_count: number;
  floor: number | null;
  total_floor: number | null;
  area_sqm: number | null;
  options: string[];
  status: Listing['status'];
  available_from: string | null;
  view_count: number;
  created_at: string;
  main_image_url?: string | null;
}

/** GET /api/landlord/properties → { properties, pagination } — amounts in 원. */
export async function fetchLandlordProperties(): Promise<Listing[]> {
  const res = await apiClient.get<{ properties: LandlordPropertyRow[] }>('/landlord/properties');
  return (res.properties ?? []).map((p) => ({
    id: p.id,
    landlordId: p.landlord_id,
    title: p.title,
    address: p.address,
    addressDetail: p.address_detail,
    region: p.region,
    deposit: toManwon(p.deposit),
    monthlyRent: toManwon(p.monthly_rent),
    maintenanceFee: toManwon(p.maintenance_fee ?? 0),
    propertyType: p.property_type,
    roomCount: p.room_count,
    bathroomCount: p.bathroom_count,
    floor: p.floor,
    totalFloor: p.total_floor,
    areaSqm: p.area_sqm,
    options: p.options ?? [],
    description: p.description,
    status: p.status,
    availableFrom: p.available_from,
    viewCount: p.view_count,
    images: p.main_image_url
      ? [{ id: '0', imageUrl: p.main_image_url, thumbnailUrl: null, sortOrder: 0, isMain: true }]
      : [],
    createdAt: p.created_at,
  }));
}

/** PUT /api/landlord/properties/[id] with a partial body ({ status }). */
export async function updatePropertyStatus(
  id: string,
  status: Listing['status']
): Promise<void> {
  await apiClient.put(`/landlord/properties/${id}`, { status });
}

/** DELETE /api/landlord/properties/[id] → { success } */
export async function deleteProperty(id: string): Promise<void> {
  await apiClient.delete(`/landlord/properties/${id}`);
}

/** GET /api/landlord/stats → { summary, recentActivity, monthlyStats } */
export async function fetchLandlordStats(): Promise<DashboardStats> {
  const res = await apiClient.get<{
    summary: {
      totalProperties: number;
      totalViews: number;
      totalFavorites: number;
      unreadMessages: number;
    };
  }>('/landlord/stats');
  return {
    propertyCount: res.summary?.totalProperties ?? 0,
    totalViews: res.summary?.totalViews ?? 0,
    totalFavorites: res.summary?.totalFavorites ?? 0,
    unreadMessages: res.summary?.unreadMessages ?? 0,
  };
}

// ─── Matches ─────────────────────────────────────────────────────────────────

export interface MatchedListing extends Listing {
  matchScore?: number;
  matchReasons?: string[];
}

interface MatchResultRow {
  listing: {
    id: string;
    /** 원 */
    monthly_rent: number;
    address: string;
    available_from: string | null;
    /** 원 */
    deposit: number;
    area_sqm: number | null;
    floor: number | null;
  };
  score: number;
  grade: string;
  reasons: string[];
}

/** GET /api/matches → { matches: MatchResult[], total } — amounts in 원. */
export async function fetchMatches(): Promise<MatchedListing[]> {
  const res = await apiClient.get<{ matches: MatchResultRow[] }>('/matches');
  return (res.matches ?? []).map((m) => ({
    id: m.listing.id,
    title: m.listing.address,
    address: m.listing.address,
    deposit: toManwon(m.listing.deposit),
    monthlyRent: toManwon(m.listing.monthly_rent),
    areaSqm: m.listing.area_sqm,
    floor: m.listing.floor,
    status: 'available' as const,
    availableFrom: m.listing.available_from,
    viewCount: 0,
    images: [],
    matchScore: m.score,
    matchReasons: m.reasons,
  }));
}

// ─── Messaging ───────────────────────────────────────────────────────────────

interface ConversationRow {
  id: string;
  last_message_at: string;
  other_user_name: string | null;
  other_user_id: string;
  other_user_type: 'landlord' | 'tenant';
  last_message: string | null;
  unread_count: number;
}

/** GET /api/messages/conversations → { conversations, pagination } */
export async function fetchConversations(): Promise<Conversation[]> {
  const res = await apiClient.get<{ conversations: ConversationRow[] }>('/messages/conversations');
  return (res.conversations ?? []).map((c) => ({
    id: c.id,
    otherUser: {
      id: c.other_user_id,
      name: c.other_user_name ?? '사용자',
      userType: c.other_user_type,
    },
    lastMessage: c.last_message,
    lastMessageAt: c.last_message_at,
    unreadCount: c.unread_count ?? 0,
  }));
}

interface MessageRow {
  id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  is_mine: boolean;
}

function mapMessage(m: MessageRow): Message {
  return {
    id: m.id,
    senderId: m.sender_id,
    content: m.content,
    isRead: m.is_read,
    isMine: m.is_mine,
    createdAt: m.created_at,
  };
}

/** GET /api/messages/conversations/[id] → { conversation, messages, pagination } */
export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const res = await apiClient.get<{ messages: MessageRow[] }>(
    `/messages/conversations/${conversationId}`
  );
  return (res.messages ?? []).map(mapMessage);
}

/** POST /api/messages/conversations/[id] { content } → { message } */
export async function sendMessage(conversationId: string, content: string): Promise<Message> {
  const res = await apiClient.post<{ message: MessageRow }>(
    `/messages/conversations/${conversationId}`,
    { content }
  );
  return mapMessage(res.message);
}

/**
 * POST /api/messages/conversations { targetUserId, initialMessage? }
 * → { conversationId, isNew }. Creates or returns the existing 1:1 room.
 */
export async function startConversation(
  targetUserId: string,
  initialMessage?: string
): Promise<string> {
  const res = await apiClient.post<{ conversationId: string }>('/messages/conversations', {
    targetUserId,
    ...(initialMessage ? { initialMessage } : {}),
  });
  return res.conversationId;
}

// ─── Landlord: browse tenants ────────────────────────────────────────────────

interface TenantCardRow {
  profile_id: string;
  user_id: string;
  name: string;
  age_range: string | null;
  family_type: string | null;
  pets: string[];
  smoking: boolean;
  stay_time: string | null;
  duration: string | null;
  noise_level: string | null;
  bio: string | null;
  trust_score: number;
}

/** GET /api/landlord/tenants → { tenants, next_cursor, total_count } */
export async function fetchTenants(): Promise<TenantProfile[]> {
  const res = await apiClient.get<{ tenants: TenantCardRow[] }>('/landlord/tenants');
  return (res.tenants ?? []).map((t) => ({
    userId: t.user_id,
    name: t.name,
    ageRange: t.age_range,
    familyType: t.family_type,
    pets: t.pets ?? [],
    smoking: t.smoking,
    stayTime: t.stay_time,
    duration: t.duration,
    noiseLevel: t.noise_level,
    bio: t.bio,
    trustScore: t.trust_score ?? 0,
    isComplete: true,
  }));
}
