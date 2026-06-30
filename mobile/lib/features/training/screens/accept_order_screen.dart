import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/models/training_session_model.dart';
import '../../../core/utils/location_helper.dart';

class AcceptOrderScreen extends StatefulWidget {
  final String sessionId;
  const AcceptOrderScreen({super.key, required this.sessionId});

  @override
  State<AcceptOrderScreen> createState() => _AcceptOrderScreenState();
}

class _AcceptOrderScreenState extends State<AcceptOrderScreen> {
  TrainingSessionModel? _session;
  bool _loading = true;
  bool _accepting = false;
  final _stopwatch = Stopwatch()..start();

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    final s = await SupabaseService.getSession(widget.sessionId);
    if (mounted) setState(() { _session = s; _loading = false; });
  }

  Future<void> _accept() async {
    setState(() => _accepting = true);
    try {
      Position pos = await LocationHelper.getCurrentPosition();
      await SupabaseService.acceptOrder(widget.sessionId, pos.latitude, pos.longitude);
      if (mounted) context.go('/pickup', extra: widget.sessionId);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _accepting = false);
    }
  }

  Color _diffColor(String? diff) {
    switch (diff) {
      case 'easy': return const Color(0xFF16A34A);
      case 'medium': return const Color(0xFFD97706);
      case 'hard': return const Color(0xFFDC2626);
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    final loc = session?.location;

    return Scaffold(
      appBar: AppBar(title: const Text('New Training Order')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Order header
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF1D4ED8), Color(0xFF2563EB)],
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.receipt_long, color: Colors.white, size: 28),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                session?.orderCode ?? '',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: 'monospace',
                                ),
                              ),
                              Text(
                                'Training Order',
                                style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13),
                              ),
                            ],
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              (session?.difficulty ?? '').toUpperCase(),
                              style: TextStyle(
                                color: _diffColor(session?.difficulty),
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Destination details
                    _InfoCard(
                      title: 'Destination',
                      children: [
                        _InfoRow(Icons.location_on, 'Building', loc?.name ?? ''),
                        if (loc?.landmark != null)
                          _InfoRow(Icons.signpost, 'Landmark', loc!.landmark!),
                        if (loc?.notes != null)
                          _InfoRow(Icons.info_outline, 'Notes', loc!.notes!),
                        _InfoRow(
                          Icons.timer,
                          'Expected Time',
                          '${loc?.expectedDuration ?? 0} minutes',
                        ),
                      ],
                    ),

                    const SizedBox(height: 12),

                    _InfoCard(
                      title: 'Instructions',
                      children: [
                        _InfoRow(Icons.camera_alt, 'Pickup POD', 'Take photo at store (camera only)'),
                        _InfoRow(Icons.camera_alt, 'Delivery POD', 'Take photo of building entrance'),
                        _InfoRow(Icons.gps_fixed, 'Geofencing', 'Must be within 50m of destination'),
                      ],
                    ),

                    const Spacer(),

                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _accepting ? null : _accept,
                        icon: _accepting
                            ? const SizedBox(
                                width: 20, height: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Icon(Icons.check_circle_outline),
                        label: Text(_accepting ? 'Accepting…' : 'ACCEPT ORDER'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF16A34A),
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

class _InfoCard extends StatelessWidget {
  final String title;
  final List<Widget> children;
  const _InfoCard({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF374151))),
          const Divider(height: 16),
          ...children,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _InfoRow(this.icon, this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF6B7280)),
          const SizedBox(width: 8),
          Text('$label: ', style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
          Expanded(
            child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}
