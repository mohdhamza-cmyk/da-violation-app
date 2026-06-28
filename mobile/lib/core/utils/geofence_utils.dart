import 'dart:math';

class GeofenceUtils {
  // Haversine distance in meters
  static double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
    const r = 6371000.0;
    final phi1 = lat1 * pi / 180;
    final phi2 = lat2 * pi / 180;
    final dPhi = (lat2 - lat1) * pi / 180;
    final dLambda = (lng2 - lng1) * pi / 180;
    final a = sin(dPhi / 2) * sin(dPhi / 2) +
        cos(phi1) * cos(phi2) * sin(dLambda / 2) * sin(dLambda / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return r * c;
  }

  static bool isWithin(double userLat, double userLng,
      double targetLat, double targetLng, double radiusMeters) {
    return distanceMeters(userLat, userLng, targetLat, targetLng) <= radiusMeters;
  }
}
