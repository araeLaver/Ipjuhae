/**
 * Shared types for Rentme Mobile
 */

export type UserType = 'tenant' | 'landlord' | 'admin';

export interface User {
  id: number;
  email: string;
  name?: string;
  userType: UserType;
  phone?: string;
  phoneVerified: boolean;
  profileImage?: string;
  createdAt: string;
}

export interface TenantProfile {
  userId: number;
  name: string;
  ageRange?: string;
  familyType?: string;
  pets?: string[];
  smoking?: boolean;
  stayTime?: string;
  duration?: string;
  noiseLevel?: string;
  bio?: string;
  intro?: string;
  trustScore: number;
  isComplete: boolean;
  budgetMin?: number;
  budgetMax?: number;
  preferredDistricts?: string[];
  moveInDate?: string;
}

export interface LandlordProfile {
  userId: number;
  name: string;
  phone?: string;
  propertyCount: number;
  propertyRegions?: string[];
}

export interface Listing {
  id: number;
  landlordId: number;
  title: string;
  address: string;
  addressDetail?: string;
  region: string;
  deposit: number;
  monthlyRent: number;
  maintenanceFee?: number;
  propertyType: string;
  roomCount: number;
  bathroomCount: number;
  floor?: number;
  totalFloor?: number;
  areaSqm?: number;
  options?: string[];
  description?: string;
  status: 'available' | 'reserved' | 'rented' | 'hidden';
  availableFrom?: string;
  viewCount: number;
  images: PropertyImage[];
  createdAt: string;
}

export interface PropertyImage {
  id: number;
  imageUrl: string;
  thumbnailUrl?: string;
  sortOrder: number;
  isMain: boolean;
}

export interface Conversation {
  id: number;
  otherUser: {
    id: number;
    name: string;
    profileImage?: string;
    userType: UserType;
  };
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export interface Message {
  id: number;
  senderId: number;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface Notification {
  id: number;
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
  creditGrade?: number;
}

export interface Reference {
  id: number;
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

export interface PaginatedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}
