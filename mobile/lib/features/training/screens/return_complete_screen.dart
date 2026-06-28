import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/models/training_session_model.dart';
import '../../../core/utils/geofence_utils.dart';

class ReturnCompleteScreen extends StatefulWidget {
  final String sessionId;
  const ReturnCompleteScreen({super.key, required this.sessionId});

  @override
  State<ReturnCompleteScreen> createState() => _ReturnCompleteScreenState();
}

class _ReturnCompleteScreenState extends State<ReturnCompleteScreen> {
  TrainingSessionModel? _session;
  bool _loading = true;
  bool _completing = false;
  double? _distanceMeters;

  static const storeGeofenceMeters = 30.0;

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
    final store = _session?.store;
    if (store == null) return;
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      final dist = GeofenceUtils.distanceMeters(pos.latitude, pos.longitude, store.latitude, store.longitude);
      if (mounted) setState(() => _distanceMeters = dist);
    } catch (_) {}
  }

  Future<void> _completeReturn() async {
    setState(() => _completing = true);
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      final store = _session?.store;
      final geofenceOk = store != null &&
          GeofenceUtils.isWithin(pos.latitude, pos.longitude, store.latitude, store.longitude, storeGeofenceMeters);

      if (!geofenceOk) {
        final dist = store != null
            ? GeofenceUtils.distanceMeters(pos.latitude, pos.longitude, store.latitude, store.longitude)
            : 0.0;
        if (mounted) {
          final confirmed = await showDialog<bool>(
            context: context,
            builder: (_) => AlertDialog(
              title: const Text('Not At Store'),
              content: Text('You are ${dist.toStringAsFixed(0)}m from the store. Must be within ${storeGeofenceMeters.toStringAsFixed(0)}m. This will be flagged.'),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Go Back')),
                TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Complete Anyway')),
              ],
            ),
          );
          if (confirmed != true) {
            setState(() => _completing = false);
            return;
          }
        }
      }

      await SupabaseService.completeReturn(widget.sessionId, pos.latitude, pos.longitude, geofenceOk);
      if (mounted) context.go('/order-complete', extra: widget.sessionId);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _completing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = _session?.store;
    final withinGeofence = _distanceMeters != null && _distanceMeters! <= storeGeofenceMeters;

    return Scaffold(
      appBar: AppBar(title: const Text('Back at Store')),
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
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.store, size: 48, color: Color(0xFF2563EB)),
                          const SizedBox(height: 12),
                          Text(
                            store?.name ?? 'Dark Store',
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
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
                                  ),
                                  const SizedBox(width: 8),
                                  Text(
                                    withinGeofence
                                        ? '${_distanceMeters!.toStringAsFixed(0)}m — At store ✓'
                                        : '${_distanceMeters!.toStringAsFixed(0)}m — Move to store (${storeGeofenceMeters.toStringAsFixed(0)}m required)',
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
                            const Text('Checking location…'),
                          ],
                        ],
                      ),
                    ),

                    const Spacer(),

                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _completing ? null : _completeReturn,
                        icon: _completing
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                            : const Icon(Icons.check_circle),
                        label: Text(_completing ? 'Completing…' : 'RETURN COMPLETED'),
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
