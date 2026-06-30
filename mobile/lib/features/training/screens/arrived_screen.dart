import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/models/training_session_model.dart';
import '../../../core/utils/location_helper.dart';
import '../../../core/utils/geofence_utils.dart';

class ArrivedScreen extends StatefulWidget {
  final String sessionId;
  const ArrivedScreen({super.key, required this.sessionId});

  @override
  State<ArrivedScreen> createState() => _ArrivedScreenState();
}

class _ArrivedScreenState extends State<ArrivedScreen> {
  TrainingSessionModel? _session;
  bool _loading = true;
  bool _confirming = false;
  double? _distanceMeters;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final s = await SupabaseService.getSession(widget.sessionId);
    setState(() { _session = s; _loading = false; });
    _checkDistance();
  }

  Future<void> _checkDistance() async {
    final loc = _session?.location;
    if (loc == null) return;
    try {
      final pos = await LocationHelper.getCurrentPosition();
      final dist = GeofenceUtils.distanceMeters(pos.latitude, pos.longitude, loc.latitude, loc.longitude);
      if (mounted) setState(() => _distanceMeters = dist);
    } catch (_) {}
  }

  Future<void> _confirmArrival() async {
    setState(() => _confirming = true);
    try {
      final pos = await LocationHelper.getCurrentPosition();
      await SupabaseService.markArrived(widget.sessionId, pos.latitude, pos.longitude);
      if (mounted) context.go('/delivery-pod', extra: widget.sessionId);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _confirming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final loc = _session?.location;
    final withinGeofence = _distanceMeters != null && _distanceMeters! <= (loc?.geofenceRadiusMeters ?? 50);

    return Scaffold(
      appBar: AppBar(title: const Text('Arrived at Destination')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                      ),
                      child: Column(
                        children: [
                          Icon(Icons.location_on,
                              size: 48, color: withinGeofence ? const Color(0xFF16A34A) : const Color(0xFFDC2626)),
                          const SizedBox(height: 12),
                          Text(
                            loc?.name ?? '',
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 16),
                          if (_distanceMeters != null) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                color: withinGeofence ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(
                                  color: withinGeofence ? const Color(0xFFBBF7D0) : const Color(0xFFFECACA),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    withinGeofence ? Icons.check_circle : Icons.warning,
                                    color: withinGeofence ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                                    size: 20,
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    withinGeofence
                                        ? '${_distanceMeters!.toStringAsFixed(0)}m — Within geofence ✓'
                                        : '${_distanceMeters!.toStringAsFixed(0)}m — Move closer (${loc?.geofenceRadiusMeters}m required)',
                                    style: TextStyle(
                                      color: withinGeofence ? const Color(0xFF166534) : const Color(0xFF991B1B),
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ] else ...[
                            const CircularProgressIndicator(),
                            const SizedBox(height: 8),
                            const Text('Checking your location…'),
                          ],
                        ],
                      ),
                    ),

                    const Spacer(),

                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _confirming ? null : _confirmArrival,
                        icon: _confirming
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Icon(Icons.place),
                        label: const Text('ARRIVED'),
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
