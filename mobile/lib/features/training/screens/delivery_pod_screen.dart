import 'dart:io';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/models/training_session_model.dart';
import '../../../core/utils/geofence_utils.dart';
import '../../../core/utils/location_helper.dart';

class DeliveryPodScreen extends StatefulWidget {
  final String sessionId;
  const DeliveryPodScreen({super.key, required this.sessionId});

  @override
  State<DeliveryPodScreen> createState() => _DeliveryPodScreenState();
}

class _DeliveryPodScreenState extends State<DeliveryPodScreen> {
  TrainingSessionModel? _session;
  CameraController? _cameraCtrl;
  File? _capturedPhoto;
  bool _loading = true;
  bool _cameraReady = false;
  bool _uploading = false;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final s = await SupabaseService.getSession(widget.sessionId);
    setState(() { _session = s; _loading = false; });
    await _initCamera();
  }

  Future<void> _initCamera() async {
    final cameras = await availableCameras();
    if (cameras.isEmpty) return;
    _cameraCtrl = CameraController(cameras[0], ResolutionPreset.medium, enableAudio: false);
    await _cameraCtrl!.initialize();
    if (mounted) setState(() => _cameraReady = true);
  }

  Future<void> _takePicture() async {
    if (_cameraCtrl == null || !_cameraReady) return;
    final xFile = await _cameraCtrl!.takePicture();
    setState(() => _capturedPhoto = File(xFile.path));
  }

  Future<void> _completeDelivery() async {
    if (_capturedPhoto == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please take a delivery photo first')),
      );
      return;
    }
    setState(() => _uploading = true);
    try {
      final pos = await LocationHelper.getCurrentPosition();
      final loc = _session?.location;
      final geofenceOk = loc != null &&
          GeofenceUtils.isWithin(pos.latitude, pos.longitude, loc.latitude, loc.longitude, loc.geofenceRadiusMeters.toDouble());

      if (!geofenceOk && loc != null) {
        final dist = GeofenceUtils.distanceMeters(pos.latitude, pos.longitude, loc.latitude, loc.longitude);
        if (mounted) {
          final confirmed = await showDialog<bool>(
            context: context,
            builder: (_) => AlertDialog(
              title: const Text('Outside Geofence'),
              content: Text('You are ${dist.toStringAsFixed(0)}m away from the destination. Geofence requires ${loc.geofenceRadiusMeters}m. This will be flagged.'),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Continue Anyway')),
              ],
            ),
          );
          if (confirmed != true) {
            setState(() => _uploading = false);
            return;
          }
        }
      }

      final storeId = _session?.storeId ?? '';
      final url = await SupabaseService.uploadPod(_capturedPhoto!, storeId, widget.sessionId, 'delivery');
      await SupabaseService.completeDelivery(widget.sessionId, url, pos.latitude, pos.longitude, geofenceOk);
      if (mounted) context.go('/return', extra: widget.sessionId);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  void dispose() {
    _cameraCtrl?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Delivery POD')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Column(
                children: [
                  Container(
                    margin: const EdgeInsets.all(12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.camera_alt, color: Color(0xFF16A34A)),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Take a photo of the BUILDING ENTRANCE. Camera only. No gallery upload.',
                            style: TextStyle(color: Color(0xFF166534), fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: _capturedPhoto != null
                        ? Stack(
                            fit: StackFit.expand,
                            children: [
                              Image.file(_capturedPhoto!, fit: BoxFit.cover),
                              Positioned(
                                top: 8,
                                right: 8,
                                child: IconButton(
                                  onPressed: () => setState(() => _capturedPhoto = null),
                                  icon: const Icon(Icons.refresh, color: Colors.white, size: 28),
                                  style: IconButton.styleFrom(backgroundColor: Colors.black45),
                                ),
                              ),
                            ],
                          )
                        : _cameraReady
                            ? CameraPreview(_cameraCtrl!)
                            : const Center(child: CircularProgressIndicator()),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        if (_capturedPhoto == null)
                          SizedBox(
                            width: 72,
                            height: 72,
                            child: ElevatedButton(
                              onPressed: _cameraReady ? _takePicture : null,
                              style: ElevatedButton.styleFrom(
                                shape: const CircleBorder(),
                                padding: EdgeInsets.zero,
                                backgroundColor: Colors.white,
                                foregroundColor: const Color(0xFF16A34A),
                                side: const BorderSide(color: Color(0xFF16A34A), width: 3),
                              ),
                              child: const Icon(Icons.camera_alt, size: 32),
                            ),
                          ),
                        if (_capturedPhoto != null)
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _uploading ? null : _completeDelivery,
                              icon: _uploading
                                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                  : const Icon(Icons.check),
                              label: Text(_uploading ? 'Uploading…' : 'DELIVERED'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF16A34A),
                                minimumSize: const Size(double.infinity, 52),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
