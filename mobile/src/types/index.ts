/**
 * Shared types for Rentme Mobile
 *
 * NOTE: server ids are UUID strings (Postgres uuid), not numbers.
 * Amounts (deposit / monthlyRent / maintenanceFee) are normalized to 만원
 * by the API layer (services/api.ts) regardless of what the server returns.
 */

export type UserType = 'tenant' | 'landlord' | 'admin';

export interface User {
  id: string;
  email: string;
  name?: string;
  userType: UserType;
  phone?: string;
  phoneVerified?: boolean;
  profileImage?: string;
  createdAt?: string;
}

export interface TenantProfile {
  userId: string;
  name: string;
  ageRange?: string | null;
  familyType?: string | null;
  pets?: string[];
  smoking?: boolean;
  stayTime?: string | null;
  duration?: string | null;
  noiseLevel?: string | null;
  bio?: string | null;
  intro?: string | null;
  trustScore: number;
  isComplete: boolean;
  // Not provided by the current server endpoints (/api/profile, /api/landlord/tenants).
  budgetMin?: number;
  budgetMax?: number;
  preferredDistricts?: string[];
  moveInDate?: string;
}

export interface Listing {
  id: string;
  landlordId?: string;
  landlordName?: string | null;
  title: string;
  address: string;
  addressDetail?: string | null;
  region?: string | null;
  /** 만원 */
  deposit: number;
  /** 만원 */
  monthlyRent: number;
  /** 만원 */
  maintenanceFee?: number;
  propertyType?: string | null;
  roomCount?: number;
  bathroomCount?: number;
  floor?: number | null;
  totalFloor?: number | null;
  areaSqm?: number | null;
  options?: string[];
  description?: string | null;
  status: 'available' | 'reserved' | 'rented' | 'hidden';
  availableFrom?: string | null;
  viewCount: number;
  images: PropertyImage[];
  createdAt?: string;
}

export interface PropertyImage {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  sortOrder: number;
  isMain: boolean;
}

export interface Conversation {
  id: string;
  otherUser: {
    id: string;
    name: string;
    profileImage?: string;
    userType: UserType;
  };
  lastMessage?: string | null;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  isRead: boolean;
  /** Provided by the server; more reliable than comparing senderId locally. */
  isMine: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface VerificationStatus {
  employmentVerified: boolean;
  incomeVerified: boolean;
  creditVerified: boolean;
  creditGrade?: number | null;
}

export interface Reference {
  id: string;
  landlordName: string;
  landlordPhone?: string;
  status: 'pending' | 'sent' | 'completed' | 'expired';
  overallRating?: number;
  createdAt: string;
}

export interface DashboardStats {
  propertyCount: number;
  totalViews: number;
  totalFavorites: number;
  unreadMessages: number;
}
