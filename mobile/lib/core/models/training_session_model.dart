class TrainingSessionModel {
  final String id;
  final String orderCode;
  final String riderId;
  final String storeId;
  final String locationId;
  final String? assignedBy;
  final String status;
  final String? difficulty;
  final String? mot;
  final DateTime assignedAt;
  final DateTime? acceptedAt;
  final DateTime? pickupCompletedAt;
  final DateTime? departedAt;
  final DateTime? arrivedAt;
  final DateTime? deliveredAt;
  final DateTime? returnStartedAt;
  final DateTime? returnCompletedAt;
  final double? pickupLat;
  final double? pickupLng;
  final double? arrivalLat;
  final double? arrivalLng;
  final double? deliveryLat;
  final double? deliveryLng;
  final double? returnLat;
  final double? returnLng;
  final String? pickupPodUrl;
  final String? deliveryPodUrl;
  final bool? deliveryGeofenceOk;
  final bool? returnGeofenceOk;
  final double? score;
  final Map<String, dynamic>? scoreBreakdown;
  final bool? passed;
  final String? grade;
  final String? trainerNotes;
  final TrainingLocationInfo? location;
  final StoreInfo? store;

  const TrainingSessionModel({
    required this.id,
    required this.orderCode,
    required this.riderId,
    required this.storeId,
    required this.locationId,
    this.assignedBy,
    required this.status,
    this.difficulty,
    this.mot,
    required this.assignedAt,
    this.acceptedAt,
    this.pickupCompletedAt,
    this.departedAt,
    this.arrivedAt,
    this.deliveredAt,
    this.returnStartedAt,
    this.returnCompletedAt,
    this.pickupLat,
    this.pickupLng,
    this.arrivalLat,
    this.arrivalLng,
    this.deliveryLat,
    this.deliveryLng,
    this.returnLat,
    this.returnLng,
    this.pickupPodUrl,
    this.deliveryPodUrl,
    this.deliveryGeofenceOk,
    this.returnGeofenceOk,
    this.score,
    this.scoreBreakdown,
    this.passed,
    this.grade,
    this.trainerNotes,
    this.location,
    this.store,
  });

  factory TrainingSessionModel.fromJson(Map<String, dynamic> json) {
    return TrainingSessionModel(
      id: json['id'] as String,
      orderCode: json['order_code'] as String? ?? '',
      riderId: json['rider_id'] as String,
      storeId: json['store_id'] as String,
      locationId: json['location_id'] as String,
      assignedBy: json['assigned_by'] as String?,
      status: json['status'] as String,
      difficulty: json['difficulty'] as String?,
      mot: json['mot'] as String?,
      assignedAt: DateTime.parse(json['assigned_at'] as String),
      acceptedAt: json['accepted_at'] != null ? DateTime.parse(json['accepted_at'] as String) : null,
      pickupCompletedAt: json['pickup_completed_at'] != null ? DateTime.parse(json['pickup_completed_at'] as String) : null,
      departedAt: json['departed_at'] != null ? DateTime.parse(json['departed_at'] as String) : null,
      arrivedAt: json['arrived_at'] != null ? DateTime.parse(json['arrived_at'] as String) : null,
      deliveredAt: json['delivered_at'] != null ? DateTime.parse(json['delivered_at'] as String) : null,
      returnStartedAt: json['return_started_at'] != null ? DateTime.parse(json['return_started_at'] as String) : null,
      returnCompletedAt: json['return_completed_at'] != null ? DateTime.parse(json['return_completed_at'] as String) : null,
      pickupLat: (json['pickup_lat'] as num?)?.toDouble(),
      pickupLng: (json['pickup_lng'] as num?)?.toDouble(),
      arrivalLat: (json['arrival_lat'] as num?)?.toDouble(),
      arrivalLng: (json['arrival_lng'] as num?)?.toDouble(),
      deliveryLat: (json['delivery_lat'] as num?)?.toDouble(),
      deliveryLng: (json['delivery_lng'] as num?)?.toDouble(),
      returnLat: (json['return_lat'] as num?)?.toDouble(),
      returnLng: (json['return_lng'] as num?)?.toDouble(),
      pickupPodUrl: json['pickup_pod_url'] as String?,
      deliveryPodUrl: json['delivery_pod_url'] as String?,
      deliveryGeofenceOk: json['delivery_geofence_ok'] as bool?,
      returnGeofenceOk: json['return_geofence_ok'] as bool?,
      score: (json['score'] as num?)?.toDouble(),
      scoreBreakdown: json['score_breakdown'] as Map<String, dynamic>?,
      passed: json['passed'] as bool?,
      grade: json['grade'] as String?,
      trainerNotes: json['trainer_notes'] as String?,
      location: json['training_locations'] != null
          ? TrainingLocationInfo.fromJson(json['training_locations'] as Map<String, dynamic>)
          : null,
      store: json['stores'] != null
          ? StoreInfo.fromJson(json['stores'] as Map<String, dynamic>)
          : null,
    );
  }
}

class TrainingLocationInfo {
  final String id;
  final String name;
  final double latitude;
  final double longitude;
  final String? landmark;
  final String? notes;
  final int expectedDuration;
  final int geofenceRadiusMeters;

  const TrainingLocationInfo({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    this.landmark,
    this.notes,
    required this.expectedDuration,
    required this.geofenceRadiusMeters,
  });

  factory TrainingLocationInfo.fromJson(Map<String, dynamic> json) => TrainingLocationInfo(
        id: json['id'] as String,
        name: json['name'] as String,
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
        landmark: json['landmark'] as String?,
        notes: json['notes'] as String?,
        expectedDuration: (json['expected_duration'] as num?)?.toInt() ?? 10,
        geofenceRadiusMeters: (json['geofence_radius_meters'] as num?)?.toInt() ?? 50,
      );
}

class StoreInfo {
  final String id;
  final String name;
  final String storeCode;
  final double latitude;
  final double longitude;

  const StoreInfo({
    required this.id,
    required this.name,
    required this.storeCode,
    required this.latitude,
    required this.longitude,
  });

  factory StoreInfo.fromJson(Map<String, dynamic> json) => StoreInfo(
        id: json['id'] as String,
        name: json['name'] as String,
        storeCode: json['store_code'] as String,
        latitude: (json['latitude'] as num).toDouble(),
        longitude: (json['longitude'] as num).toDouble(),
      );
}
