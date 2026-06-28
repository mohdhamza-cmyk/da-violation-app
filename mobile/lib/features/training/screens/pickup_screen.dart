import 'dart:io';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/models/training_session_model.dart';

class PickupScreen extends StatefulWidget {
  final String sessionId;
  const PickupScreen({super.key, required this.sessionId});

  @override
  State<PickupScreen> createState() => _PickupScreenState();
}

class _PickupScreenState extends State<PickupScreen> {
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
    final session = await SupabaseService.getSession(widget.sessionId);
    setState(() { _session = session; _loading = false; });
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
    try {
      final xFile = await _cameraCtrl!.takePicture();
      setState(() => _capturedPhoto = File(xFile.path));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Camera error: $e')),
      );
    }
  }

  Future<void> _completePickup() async {
    if (_capturedPhoto == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please take a pickup photo first')),
      );
      return;
    }
    setState(() => _uploading = true);
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      final storeId = _session?.storeId ?? '';
      final url = await SupabaseService.uploadPod(_capturedPhoto!, storeId, widget.sessionId, 'pickup');
      await SupabaseService.completePickup(widget.sessionId, url, pos.latitude, pos.longitude);
      if (mounted) context.go('/navigate', extra: widget.sessionId);
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
      appBar: AppBar(title: const Text('Pickup POD')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: Column(
                children: [
                  // Info banner
                  Container(
                    margin: const EdgeInsets.all(12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.info_outline, color: Color(0xFFD97706)),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Take a photo of the training package at the dark store. Camera only — no gallery.',
                            style: TextStyle(color: Color(0xFF92400E), fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Camera or Preview
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
                            ? ClipRRect(child: CameraPreview(_cameraCtrl!))
                            : const Center(child: CircularProgressIndicator()),
                  ),

                  // Bottom actions
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
                                foregroundColor: const Color(0xFF2563EB),
                                side: const BorderSide(color: Color(0xFF2563EB), width: 3),
                              ),
                              child: const Icon(Icons.camera_alt, size: 32),
                            ),
                          ),
                        if (_capturedPhoto != null) ...[
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _uploading ? null : _completePickup,
                              icon: _uploading
                                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                  : const Icon(Icons.check),
                              label: Text(_uploading ? 'Uploading…' : 'PICKUP COMPLETE'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF16A34A),
                                minimumSize: const Size(double.infinity, 52),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
