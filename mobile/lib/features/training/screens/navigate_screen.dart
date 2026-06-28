import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/models/training_session_model.dart';
import '../../../core/utils/maps_launcher.dart';

class NavigateScreen extends StatefulWidget {
  final String sessionId;
  const NavigateScreen({super.key, required this.sessionId});

  @override
  State<NavigateScreen> createState() => _NavigateScreenState();
}

class _NavigateScreenState extends State<NavigateScreen> {
  TrainingSessionModel? _session;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    final s = await SupabaseService.getSession(widget.sessionId);
    setState(() { _session = s; _loading = false; });
    if (s?.status == 'pickup_done') {
      await SupabaseService.startTransit(widget.sessionId);
    }
  }

  Future<void> _arrived() async {
    if (mounted) context.go('/arrived', extra: widget.sessionId);
  }

  @override
  Widget build(BuildContext context) {
    final loc = _session?.location;

    return Scaffold(
      appBar: AppBar(title: const Text('Navigate To Destination')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Destination card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.location_on, color: Color(0xFFDC2626)),
                              SizedBox(width: 8),
                              Text('Destination', style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF374151))),
                            ],
                          ),
                          const Divider(height: 16),
                          Text(
                            loc?.name ?? '',
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF111827)),
                          ),
                          if (loc?.landmark != null) ...[
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                const Icon(Icons.signpost, size: 16, color: Color(0xFF6B7280)),
                                const SizedBox(width: 6),
                                Text(loc!.landmark!, style: const TextStyle(color: Color(0xFF6B7280))),
                              ],
                            ),
                          ],
                          if (loc?.notes != null) ...[
                            const SizedBox(height: 6),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.info_outline, size: 16, color: Color(0xFF6B7280)),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(loc!.notes!, style: const TextStyle(color: Color(0xFF6B7280))),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              const Icon(Icons.timer, size: 16, color: Color(0xFF6B7280)),
                              const SizedBox(width: 6),
                              Text(
                                'Expected: ${loc?.expectedDuration ?? 0} minutes',
                                style: const TextStyle(color: Color(0xFF6B7280)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // GPS warning
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFFBBF7D0)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.gps_fixed, color: Color(0xFF16A34A), size: 20),
                          const SizedBox(width: 8),
                          Text(
                            'Geofence: must be within ${loc?.geofenceRadiusMeters ?? 50}m to deliver',
                            style: const TextStyle(color: Color(0xFF166534), fontSize: 13),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Open in Maps
                    const Text(
                      'Open Navigation App',
                      style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF374151)),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () {
                          if (loc != null) {
                            MapsLauncher.showBottomSheet(
                                context, loc.latitude, loc.longitude, loc.name);
                          }
                        },
                        icon: const Icon(Icons.map),
                        label: const Text('Open Maps'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(double.infinity, 48),
                        ),
                      ),
                    ),

                    const Spacer(),

                    // Arrived button
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _arrived,
                        icon: const Icon(Icons.place),
                        label: const Text('ARRIVED AT DESTINATION'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF7C3AED),
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
