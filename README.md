# Rider Training Sandbox Platform

A production-ready internal platform for training dark-store delivery riders before they handle live customer orders.

---

## Quick Start

### Step 1 — Create Admin User (Supabase)

1. Go to https://supabase.com/dashboard/project/xrghxfmtbmajmibsvwpr/auth/users
2. Click **Add User → Create new user**
3. Email: `admin@yourcompany.com` | Password: choose one
4. After creation, go to **Table Editor → profiles**
5. Find the new user row and set `role = admin`

---

### Step 2 — Deploy Admin Dashboard to Netlify

```bash
# Option A: Connect Git repo to Netlify
# - Go to netlify.com → Add site → Import from GitHub
# - Select mohdhamza-cmyk/da-violation-app
# - Build settings:
#     Base:    admin-dashboard
#     Build:   npm run build
#     Publish: .next
# - Add env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# Option B: Deploy from CLI
cd admin-dashboard
npm install
npm run build
npx netlify-cli deploy --prod --dir=.next
```

**Environment Variables for Netlify:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xrghxfmtbmajmibsvwpr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### Step 3 — Run Admin Dashboard Locally

```bash
cd admin-dashboard
npm install
cp .env.local.example .env.local    # values already filled in
npm run dev
# Open http://localhost:3000
```

---

### Step 4 — Build Flutter Mobile App

```bash
cd mobile
flutter pub get
flutter run                  # Android/iOS device or emulator
flutter build apk --release  # Android release APK
flutter build ipa            # iOS release (requires Xcode)
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Rider Training Platform                   │
├───────────────────┬──────────────────┬──────────────────────┤
│  Flutter App      │  Next.js Admin   │   Supabase Backend   │
│  (Android/iOS)    │  (Netlify)       │   (PostgreSQL + RLS) │
│                   │                  │                       │
│  Rider login      │  Live dashboard  │   Auth               │
│  Store select     │  Rider mgmt      │   Profiles           │
│  Training flow    │  Store mgmt      │   Stores             │
│  Camera POD       │  Locations mgmt  │   Training Sessions  │
│  GPS geofence     │  Performance     │   Evaluations        │
│  History          │  Reports/Export  │   Notifications      │
│  Score view       │  Evaluations     │   Audit Logs         │
│                   │  Users mgmt      │   Storage (PODs)     │
└───────────────────┴──────────────────┴──────────────────────┘
```

---

## User Roles

| Role | Description |
|------|-------------|
| `rider` | Completes training orders on the mobile app |
| `associate` | Logistics Associate — assigns orders, monitors, evaluates |
| `admin` | Full access — manages stores, locations, users, reports |

---

## Training Flow (10 Steps)

```
1. Rider Login → 2. Select Store → 3. Ready for Training
→ 4. Waiting (real-time) → 5. Accept Order
→ 6. Pickup POD (camera only, GPS captured)
→ 7. Navigate (Google Maps / Waze / 2GIS / Yango / Apple Maps)
→ 8. Arrived (geofence check: 50m)
→ 9. Delivery POD (building entrance, camera only)
→ 10. Return to Store (geofence check: 30m)
→ Score Calculated (0–100) → Pass/Fail
```

---

## Scoring Model

| Component | Weight | Scoring |
|-----------|--------|---------|
| Acceptance Time | 15% | ≤30s=100, ≤60s=80, ≤120s=60, >120s=40 |
| Pickup Time | 15% | ≤2min=100, ≤3min=80, ≤5min=60, >5min=40 |
| Travel Time | 30% | vs expected: ≤100%=100, ≤110%=85, ≤125%=70, ≤150%=50, >150%=20 |
| Return Time | 20% | ≤15min=100, ≤25min=80, ≤35min=60, >35min=40 |
| POD Compliance | 15% | Both PODs=100, One POD=50, None=0 |
| Geofence | 5% | Both OK=100, One OK=50, None=0 |
| **Pass Threshold** | | **≥70 points** |

Grades: A (≥90), B (≥80), C (≥70), D (≥60), F (<60)

---

## Database Schema

```
stores          — Dark store locations (lat/lng)
profiles        — All users (rider / associate / admin)
training_locations — Delivery destinations with geofence radius
training_sessions  — Every training order (combined session+order)
evaluations     — Trainer notes and ratings per session
notifications   — In-app notifications to riders
audit_logs      — Full event audit trail
rider_store_assignments — Store assignment history
```

Key views: `active_orders_view`, `rider_performance_view`, `store_performance_view`

---

## Supabase Project

- **Project**: https://supabase.com/dashboard/project/xrghxfmtbmajmibsvwpr
- **URL**: https://xrghxfmtbmajmibsvwpr.supabase.co
- **Region**: ap-northeast-1 (Tokyo)
- **Storage bucket**: `pod-photos` (private, max 10MB per file)

---

## Admin Dashboard Pages

| Page | URL | Description |
|------|-----|-------------|
| Live Dashboard | `/dashboard` | Real-time active orders |
| Riders | `/dashboard/riders` | Manage riders, assign stores |
| Dark Stores | `/dashboard/stores` | CRUD stores |
| Locations | `/dashboard/locations` | Manage training destinations |
| Performance | `/dashboard/performance` | Charts and metrics |
| Evaluations | `/dashboard/evaluations` | Add trainer notes |
| Reports | `/dashboard/reports` | CSV export |
| Notifications | `/dashboard/notifications` | Send messages to riders |
| Users | `/dashboard/users` | Manage admin/associate accounts |

---

## Flutter App Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/login` | Email + password |
| Store Selection | `/store-selection` | Pick training store |
| Ready | `/ready` | Ready for Training button |
| Waiting | `/waiting` | Real-time order listener |
| Accept Order | `/accept-order` | Order details + accept |
| Pickup POD | `/pickup` | Camera-only POD capture |
| Navigate | `/navigate` | Maps launcher |
| Arrived | `/arrived` | Geofence check |
| Delivery POD | `/delivery-pod` | Camera-only POD capture |
| Return | `/return` | Navigate back |
| Return Complete | `/return-complete` | Geofence check |
| Order Complete | `/order-complete` | Score display |
| History | `/history` | Past sessions |

---

## Creating Users (via Admin Dashboard)

1. **Riders**: Dashboard → Riders → Add Rider (creates auth + profile)
2. **Associates**: Dashboard → Users → Add User (role: associate)
3. **Admins**: Dashboard → Users → Add User (role: admin)

Or directly in Supabase Dashboard → Authentication → Users

---

## Assigning Training Orders

Orders are assigned by Logistics Associates via Supabase directly (or via future associate dashboard):

```sql
-- Example: assign a training order
INSERT INTO training_sessions (rider_id, store_id, location_id, status, difficulty)
VALUES (
  '<rider-uuid>',
  '<store-uuid>',
  '<location-uuid>',
  'assigned',
  'easy'
);
```

The rider's app receives this in real-time via Supabase Realtime subscriptions and navigates automatically to the Accept Order screen.

---

## Security

- JWT authentication via Supabase Auth
- Row Level Security on all tables
- Riders can only access their own data
- POD photos use private storage with path-based access control
- Signed URLs for photo viewing in admin dashboard
- Audit log of all training actions

---

## Deployment Checklist

- [ ] Create admin user in Supabase Auth
- [ ] Set admin role in profiles table
- [ ] Deploy admin dashboard to Netlify (env vars set)
- [ ] Build and distribute Flutter APK to riders
- [ ] Add training stores in Stores page
- [ ] Add training locations in Locations page
- [ ] Create rider accounts and assign to stores
- [ ] Test full training flow end-to-end

---

## Local Development

```bash
# Admin dashboard
cd admin-dashboard && npm install && npm run dev

# Supabase (optional local)
npx supabase start
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | Flutter 3.x + Riverpod + go_router |
| Admin Dashboard | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Supabase (Auth + PostgreSQL + Storage + Realtime) |
| Database | PostgreSQL 17 with RLS |
| Storage | Supabase Storage (private bucket) |
| Hosting | Netlify (admin) |
| Maps | Google Maps, Waze, 2GIS, Yango, Apple Maps (deep links) |
