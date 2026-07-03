import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/supabase_service.dart';

class ReadyScreen extends StatefulWidget {
  const ReadyScreen({super.key});

  @override
  State<ReadyScreen> createState() => _ReadyScreenState();
}

class _ReadyScreenState extends State<ReadyScreen> {
  bool _loading = false;
  Map<String, dynamic>? _profile;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _checkActiveSession();
  }

  Future<void> _loadProfile() async {
    final p = await SupabaseService.getProfile();
    if (mounted) setState(() => _profile = p);
  }

  Future<void> _checkActiveSession() async {
    final session = await SupabaseService.getActiveSession();
    // Only auto-resume a brand-new order (queued or just assigned). A mid-flow
    // session is not resumed here — tapping Ready starts a fresh run instead —
    // so the rider is never dropped into the middle of an old delivery.
    if (session != null && mounted &&
        (session.status == 'waiting' || session.status == 'assigned')) {
      _navigateByStatus(session.id, session.status);
    }
  }

  void _navigateByStatus(String id, String status) {
    switch (status) {
      case 'waiting': context.go('/waiting'); break;
      case 'assigned': context.go('/accept-order', extra: id); break;
      case 'accepted': context.go('/pickup', extra: id); break;
      case 'pickup_done': context.go('/navigate', extra: id); break;
      case 'in_transit': context.go('/navigate', extra: id); break;
      case 'arrived': context.go('/delivery-pod', extra: id); break;
      case 'delivered': context.go('/return', extra: id); break;
      case 'returning': context.go('/return-complete', extra: id); break;
    }
  }

  Future<void> _readyForTraining() async {
    setState(() => _loading = true);
    try {
      final storeId = _profile?['store_id'] as String?;
      if (storeId == null) {
        if (mounted) context.go('/store-selection');
        return;
      }
      await SupabaseService.setWaiting(storeId);
      if (mounted) context.go('/waiting');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final storeName = (_profile?['stores'] as Map?)?['name'] ?? 'Loading…';
    final riderName = _profile?['full_name'] ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      appBar: AppBar(
        title: const Text('Ready For Training'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            onPressed: () => context.push('/history'),
          ),
          IconButton(
            icon: const Icon(Icons.store),
            onPressed: () => context.go('/store-selection'),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await SupabaseService.signOut();
              if (mounted) context.go('/login');
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const Spacer(),

              // Rider info
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFE5E7EB)),
                ),
                child: Column(
                  children: [
                    const CircleAvatar(
                      radius: 32,
                      backgroundColor: Color(0xFFEFF6FF),
                      child: Icon(Icons.person, size: 32, color: Color(0xFF2563EB)),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      riderName,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF111827),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.store, size: 14, color: Color(0xFF6B7280)),
                        const SizedBox(width: 4),
                        Text(
                          storeName,
                          style: const TextStyle(color: Color(0xFF6B7280)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // Big Ready Button
              Container(
                width: double.infinity,
                height: 180,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF2563EB).withOpacity(0.3),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: _loading ? null : _readyForTraining,
                    borderRadius: BorderRadius.circular(20),
                    child: Center(
                      child: _loading
                          ? const CircularProgressIndicator(color: Colors.white)
                          : const Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.bolt, size: 48, color: Colors.white),
                                SizedBox(height: 8),
                                Text(
                                  'READY FOR TRAINING',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                                SizedBox(height: 4),
                                Text(
                                  'Tap to go to waiting queue',
                                  style: TextStyle(color: Colors.white70, fontSize: 13),
                                ),
                              ],
                            ),
                    ),
                  ),
                ),
              ),

              const Spacer(),

              // Quick stats link
              TextButton.icon(
                onPressed: () => context.push('/history'),
                icon: const Icon(Icons.bar_chart, size: 18),
                label: const Text('View Training History'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
