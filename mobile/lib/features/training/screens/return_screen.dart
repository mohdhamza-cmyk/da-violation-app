import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/models/training_session_model.dart';
import '../../../core/utils/maps_launcher.dart';

class ReturnScreen extends StatefulWidget {
  final String sessionId;
  const ReturnScreen({super.key, required this.sessionId});

  @override
  State<ReturnScreen> createState() => _ReturnScreenState();
}

class _ReturnScreenState extends State<ReturnScreen> {
  TrainingSessionModel? _session;
  bool _loading = true;
  bool _starting = false;

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    final s = await SupabaseService.getSession(widget.sessionId);
    setState(() { _session = s; _loading = false; });
  }

  Future<void> _startReturn() async {
    setState(() => _starting = true);
    await SupabaseService.startReturn(widget.sessionId);
    if (mounted) context.go('/return-complete', extra: widget.sessionId);
  }

  @override
  Widget build(BuildContext context) {
    final store = _session?.store;

    return Scaffold(
      appBar: AppBar(title: const Text('Return To Store')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFF6FF),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFBFDBFE)),
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.check_circle, size: 48, color: Color(0xFF16A34A)),
                          const SizedBox(height: 12),
                          const Text(
                            'Delivery Complete!',
                            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Now return to your dark store.',
                            style: TextStyle(color: Color(0xFF6B7280)),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              const Icon(Icons.store, size: 16, color: Color(0xFF2563EB)),
                              const SizedBox(width: 6),
                              Text(
                                store?.name ?? '',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF1D4ED8),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF7ED),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFFED7AA)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.gps_fixed, color: Color(0xFFD97706), size: 20),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Must be within 30m of the store to complete return.',
                              style: TextStyle(color: Color(0xFF92400E), fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    if (store != null)
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () => MapsLauncher.showBottomSheet(
                              context, store.latitude, store.longitude, store.name),
                          icon: const Icon(Icons.map),
                          label: const Text('Navigate Back to Store'),
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(double.infinity, 48),
                          ),
                        ),
                      ),

                    const Spacer(),

                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _starting ? null : _startReturn,
                        icon: _starting
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Icon(Icons.directions_run),
                        label: const Text('START RETURN'),
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size(double.infinity, 56),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
