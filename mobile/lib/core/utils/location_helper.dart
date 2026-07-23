import 'package:geolocator/geolocator.dart';

/// Centralised location access with a proper permission + services flow.
/// Every screen that needs GPS should call [getCurrentPosition] instead of
/// calling Geolocator directly, so denials surface as clear messages and the
/// OS permission prompt is actually requested.
class LocationHelper {
  static Future<Position> getCurrentPosition() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw 'Location is turned off. Enable GPS/Location in your device settings and try again.';
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.deniedForever) {
      throw 'Location permission is permanently denied. Enable it in Settings → Apps → Rider Training → Permissions → Location.';
    }
    if (permission == LocationPermission.denied) {
      throw 'Location permission is required to continue. Please allow location access.';
    }

    return Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
  }
}
