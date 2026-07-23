import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/services/supabase_service.dart';

class WaitingScreen extends StatefulWidget {
  const WaitingScreen({super.key});

  @override
  State<WaitingScreen> createState() => _WaitingScreenState();
}

class _WaitingScreenState extends State<WaitingScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 2))
      ..repeat(reverse: true);
    _subscribeToOrders();
    _checkAlreadyAssigned();
  }

  // Auto-assignment happens server-side the instant a rider enters the queue,
  // so the order may already be 'assigned' before the realtime listener is
  // attached. Check once on load and advance if so.
  Future<void> _checkAlreadyAssigned() async {
    final session = await SupabaseService.getActiveSession();
    if (!mounted) return;
    if (session != null && session.status == 'assigned') {
      context.go('/accept-order', extra: session.id);
    }
  }

  void _subscribeToOrders() {
    final uid = SupabaseService.userId;
    _channel = Supabase.instance.client
        .channel('waiting-$uid')
        .onPostgresChanges(
          event: PostgresChangeEvent.update,
          schema: 'public',
          table: 'training_sessions',
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'rider_id',
            value: uid!,
          ),
          callback: (payload) {
            final newStatus = payload.newRecord['status'] as String?;
            final sessionId = payload.newRecord['id'] as String?;
            if (newStatus == 'assigned' && sessionId != null && mounted) {
              context.go('/accept-order', extra: sessionId);
            }
          },
        )
        .subscribe();
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _channel?.unsubscribe();
    super.dispose();
  }

  Future<void> _cancel() async {
    final session = await SupabaseService.getActiveSession();
    if (session != null) {
      await Supabase.instance.client
          .from('training_sessions')
          .update({'status': 'failed'}).eq('id', session.id);
    }
    if (mounted) context.go('/ready');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Animated pulse
              AnimatedBuilder(
                animation: _pulseCtrl,
                builder: (_, __) => Container(
                  width: 140 + _pulseCtrl.value * 20,
                  height: 140 + _pulseCtrl.value * 20,
                  decoration: BoxDecoration(
                    color: const Color(0xFF2563EB).withOpacity(0.1 + _pulseCtrl.value * 0.05),
                    shape: BoxShape.circle,
                  ),
                  child: const Center(
                    child: Icon(Icons.access_time, size: 60, color: Color(0xFF2563EB)),
                  ),
                ),
              ),
              const SizedBox(height: 40),
              const Text(
                'WAITING FOR ORDER',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF111827),
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'A training order will be assigned to you shortly.\nPlease stay near the dark store.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF6B7280), height: 1.5),
              ),
              const SizedBox(height: 40),

              // Status indicator
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: Color(0xFF2563EB),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Connected · Listening for orders…',
                      style: TextStyle(color: Color(0xFF1D4ED8), fontSize: 13),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 48),
              TextButton(
                onPressed: _cancel,
                child: const Text('Cancel Training', style: TextStyle(color: Colors.grey)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
