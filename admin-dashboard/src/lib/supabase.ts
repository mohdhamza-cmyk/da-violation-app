import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type UserRole = 'rider' | 'associate' | 'admin'
export type SessionStatus =
  | 'waiting' | 'assigned' | 'accepted' | 'pickup_done'
  | 'in_transit' | 'arrived' | 'delivered' | 'returning' | 'completed' | 'failed'
export type DifficultyLevel = 'easy' | 'medium' | 'hard'

export interface Store {
  id: string
  store_code: string
  name: string
  latitude: number
  longitude: number
  address?: string
  city?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  employee_id: string
  full_name: string
  role: UserRole
  store_id?: string
  phone?: string
  is_active: boolean
  created_at: string
  updated_at: string
  stores?: Store
}

export interface TrainingLocation {
  id: string
  store_id?: string
  name: string
  landmark?: string
  notes?: string
  latitude: number
  longitude: number
  expected_duration: number
  difficulty: DifficultyLevel
  geofence_radius_meters: number
  is_active: boolean
  created_at: string
  updated_at: string
  stores?: Store
}

export interface TrainingSession {
  id: string
  order_code: string
  rider_id: string
  store_id: string
  location_id: string
  assigned_by?: string
  status: SessionStatus
  difficulty: DifficultyLevel
  assigned_at: string
  accepted_at?: string
  pickup_completed_at?: string
  departed_at?: string
  arrived_at?: string
  delivered_at?: string
  return_started_at?: string
  return_completed_at?: string
  pickup_lat?: number
  pickup_lng?: number
  arrival_lat?: number
  arrival_lng?: number
  delivery_lat?: number
  delivery_lng?: number
  return_lat?: number
  return_lng?: number
  pickup_pod_url?: string
  delivery_pod_url?: string
  delivery_geofence_ok?: boolean
  return_geofence_ok?: boolean
  score?: number
  score_breakdown?: Json
  passed?: boolean
  grade?: string
  trainer_notes?: string
  created_at: string
  updated_at: string
  profiles?: Profile
  stores?: Store
  training_locations?: TrainingLocation
}

export interface Evaluation {
  id: string
  session_id: string
  rider_id: string
  evaluator_id: string
  notes: string
  rating?: number
  created_at: string
  updated_at: string
  profiles?: Profile
  evaluator?: Profile
}

export interface Notification {
  id: string
  recipient_id: string
  session_id?: string
  type: string
  title: string
  body: string
  is_read: boolean
  created_at: string
}

export interface ActiveOrder {
  id: string
  order_code: string
  status: SessionStatus
  difficulty: DifficultyLevel
  assigned_at: string
  accepted_at?: string
  pickup_completed_at?: string
  departed_at?: string
  arrived_at?: string
  delivered_at?: string
  return_started_at?: string
  rider_name: string
  employee_id: string
  store_name: string
  store_code: string
  location_name: string
  landmark?: string
  expected_duration: number
  elapsed_seconds: number
}

export interface RiderPerformance {
  rider_id: string
  full_name: string
  employee_id: string
  is_active: boolean
  current_store?: string
  store_id?: string
  total_sessions: number
  completed_sessions: number
  avg_score?: number
  passed_sessions: number
  last_session_at?: string
}

export interface StorePerformance {
  store_id: string
  store_name: string
  store_code: string
  is_active: boolean
  current_riders: number
  total_sessions: number
  completed_sessions: number
  avg_score?: number
  passed_sessions: number
}
