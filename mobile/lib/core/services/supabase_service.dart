import 'dart:io';
import 'dart:typed_data';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/training_session_model.dart';

class SupabaseService {
  static final _client = Supabase.instance.client;

  static User? get currentUser => _client.auth.currentUser;
  static String? get userId => currentUser?.id;

  // ─── AUTH ────────────────────────────────────────────────────

  static Future<AuthResponse> signIn(String email, String password) =>
      _client.auth.signInWithPassword(email: email, password: password);

  static Future<void> signOut() => _client.auth.signOut();

  // ─── PROFILE ─────────────────────────────────────────────────

  static Future<Map<String, dynamic>?> getProfile() async {
    final data = await _client
        .from('profiles')
        .select('*, stores(*)')
        .eq('id', userId!)
        .maybeSingle();
    return data;
  }

  // ─── STORES ──────────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> getStores() async {
    final data = await _client
        .from('stores')
        .select()
        .eq('is_active', true)
        .order('name');
    return List<Map<String, dynamic>>.from(data);
  }

  static Future<void> selectStore(String storeId) async {
    await _client.from('profiles').update({'store_id': storeId}).eq('id', userId!);
  }

  // ─── TRAINING SESSIONS ───────────────────────────────────────

  static Future<TrainingSessionModel?> getActiveSession() async {
    final data = await _client
        .from('training_sessions')
        .select('*, training_locations(*), stores(*)')
        .eq('rider_id', userId!)
        .not('status', 'in', '("completed","failed")')
        .order('assigned_at', ascending: false)
        .limit(1)
        .maybeSingle();
    if (data == null) return null;
    return TrainingSessionModel.fromJson(data);
  }

  static Future<TrainingSessionModel?> getSession(String id) async {
    final data = await _client
        .from('training_sessions')
        .select('*, training_locations(*), stores(*)')
        .eq('id', id)
        .single();
    return TrainingSessionModel.fromJson(data);
  }

  static Future<void> setWaiting(String storeId) async {
    await _client.from('training_sessions').insert({
      'rider_id': userId,
      'store_id': storeId,
      'location_id': await _pickLocation(storeId),
      'status': 'waiting',
      'difficulty': 'easy',
    });
  }

  static Future<String> _pickLocation(String storeId) async {
    final data = await _client
        .from('training_locations')
        .select('id')
        .eq('is_active', true)
        .order('id')
        .limit(1)
        .single();
    return data['id'] as String;
  }

  static Future<void> acceptOrder(String sessionId, double lat, double lng) async {
    await _client.from('training_sessions').update({
      'status': 'accepted',
      'accepted_at': DateTime.now().toIso8601String(),
    }).eq('id', sessionId);

    _logAudit(sessionId: sessionId, metadata: {'action': 'accepted', 'lat': lat, 'lng': lng});
  }

  static Future<void> completePickup(
      String sessionId, String podUrl, double lat, double lng) async {
    await _client.from('training_sessions').update({
      'status': 'pickup_done',
      'pickup_completed_at': DateTime.now().toIso8601String(),
      'pickup_pod_url': podUrl,
      'pickup_lat': lat,
      'pickup_lng': lng,
    }).eq('id', sessionId);

    _logAudit(sessionId: sessionId, metadata: {'action': 'pickup_done', 'pod_url': podUrl});
  }

  static Future<void> startTransit(String sessionId) async {
    await _client.from('training_sessions').update({
      'status': 'in_transit',
      'departed_at': DateTime.now().toIso8601String(),
    }).eq('id', sessionId);
  }

  static Future<void> markArrived(String sessionId, double lat, double lng) async {
    await _client.from('training_sessions').update({
      'status': 'arrived',
      'arrived_at': DateTime.now().toIso8601String(),
      'arrival_lat': lat,
      'arrival_lng': lng,
    }).eq('id', sessionId);
  }

  static Future<void> completeDelivery(
      String sessionId, String podUrl, double lat, double lng, bool geofenceOk) async {
    await _client.from('training_sessions').update({
      'status': 'delivered',
      'delivered_at': DateTime.now().toIso8601String(),
      'delivery_pod_url': podUrl,
      'delivery_lat': lat,
      'delivery_lng': lng,
      'delivery_geofence_ok': geofenceOk,
    }).eq('id', sessionId);

    _logAudit(sessionId: sessionId, metadata: {
      'action': 'delivered',
      'pod_url': podUrl,
      'geofence_ok': geofenceOk,
    });
  }

  static Future<void> startReturn(String sessionId) async {
    await _client.from('training_sessions').update({
      'status': 'returning',
      'return_started_at': DateTime.now().toIso8601String(),
    }).eq('id', sessionId);
  }

  static Future<void> completeReturn(
      String sessionId, double lat, double lng, bool geofenceOk) async {
    await _client.from('training_sessions').update({
      'status': 'completed',
      'return_completed_at': DateTime.now().toIso8601String(),
      'return_lat': lat,
      'return_lng': lng,
      'return_geofence_ok': geofenceOk,
    }).eq('id', sessionId);

    // Calculate score server-side
    await _client.rpc('calculate_session_score', params: {'p_session_id': sessionId});

    _logAudit(sessionId: sessionId, metadata: {'action': 'completed', 'geofence_ok': geofenceOk});
  }

  // ─── HISTORY ─────────────────────────────────────────────────

  static Future<List<TrainingSessionModel>> getHistory() async {
    final data = await _client
        .from('training_sessions')
        .select('*, training_locations(*), stores(*)')
        .eq('rider_id', userId!)
        .inFilter('status', ['completed', 'failed'])
        .order('return_completed_at', ascending: false)
        .limit(30);
    return (data as List).map((e) => TrainingSessionModel.fromJson(e)).toList();
  }

  // ─── NOTIFICATIONS ────────────────────────────────────────────

  static Future<List<Map<String, dynamic>>> getNotifications() async {
    final data = await _client
        .from('notifications')
        .select()
        .eq('recipient_id', userId!)
        .order('created_at', ascending: false)
        .limit(20);
    return List<Map<String, dynamic>>.from(data);
  }

  static Future<void> markNotificationRead(String id) async {
    await _client.from('notifications').update({'is_read': true}).eq('id', id);
  }

  // ─── STORAGE ─────────────────────────────────────────────────

  static Future<String> uploadPod(File file, String storeId, String sessionId, String type) async {
    final uid = userId!;
    final path = '$storeId/$uid/$sessionId/$type.jpg';

    final Uint8List bytes;
    final compressed = await FlutterImageCompress.compressWithFile(
      file.absolute.path,
      minWidth: 1024,
      minHeight: 768,
      quality: 72,
      format: CompressFormat.jpeg,
    );
    bytes = compressed ?? await file.readAsBytes();

    await _client.storage.from('pod-photos').uploadBinary(
      path,
      bytes,
      fileOptions: const FileOptions(upsert: true, contentType: 'image/jpeg'),
    );
    return _client.storage.from('pod-photos').getPublicUrl(path);
  }

  // ─── AUDIT ───────────────────────────────────────────────────

  static void _logAudit({String? sessionId, Map<String, dynamic>? metadata}) {
    _client.from('audit_logs').insert({
      'rider_id': userId,
      'session_id': sessionId,
      'metadata': metadata ?? {},
    }).then((_) {}, onError: (_) {});
  }
}
