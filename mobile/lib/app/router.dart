import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../features/auth/screens/login_screen.dart';
import '../features/store_selection/screens/store_selection_screen.dart';
import '../features/training/screens/ready_screen.dart';
import '../features/training/screens/waiting_screen.dart';
import '../features/training/screens/accept_order_screen.dart';
import '../features/training/screens/pickup_screen.dart';
import '../features/training/screens/navigate_screen.dart';
import '../features/training/screens/arrived_screen.dart';
import '../features/training/screens/delivery_pod_screen.dart';
import '../features/training/screens/return_screen.dart';
import '../features/training/screens/return_complete_screen.dart';
import '../features/training/screens/order_complete_screen.dart';
import '../features/history/screens/history_screen.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final session = Supabase.instance.client.auth.currentSession;
      final isLoggedIn = session != null;
      final isLoginRoute = state.matchedLocation == '/login';
      if (!isLoggedIn && !isLoginRoute) return '/login';
      if (isLoggedIn && isLoginRoute) return '/store-selection';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/store-selection', builder: (_, __) => const StoreSelectionScreen()),
      GoRoute(path: '/ready', builder: (_, __) => const ReadyScreen()),
      GoRoute(path: '/waiting', builder: (_, __) => const WaitingScreen()),
      GoRoute(
        path: '/accept-order',
        builder: (_, state) => AcceptOrderScreen(
          sessionId: state.extra as String? ?? '',
        ),
      ),
      GoRoute(
        path: '/pickup',
        builder: (_, state) => PickupScreen(sessionId: state.extra as String? ?? ''),
      ),
      GoRoute(
        path: '/navigate',
        builder: (_, state) => NavigateScreen(sessionId: state.extra as String? ?? ''),
      ),
      GoRoute(
        path: '/arrived',
        builder: (_, state) => ArrivedScreen(sessionId: state.extra as String? ?? ''),
      ),
      GoRoute(
        path: '/delivery-pod',
        builder: (_, state) => DeliveryPodScreen(sessionId: state.extra as String? ?? ''),
      ),
      GoRoute(
        path: '/return',
        builder: (_, state) => ReturnScreen(sessionId: state.extra as String? ?? ''),
      ),
      GoRoute(
        path: '/return-complete',
        builder: (_, state) => ReturnCompleteScreen(sessionId: state.extra as String? ?? ''),
      ),
      GoRoute(
        path: '/order-complete',
        builder: (_, state) => OrderCompleteScreen(sessionId: state.extra as String? ?? ''),
      ),
      GoRoute(path: '/history', builder: (_, __) => const HistoryScreen()),
    ],
  );
});
