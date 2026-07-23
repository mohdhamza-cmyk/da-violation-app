import 'dart:io';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class MapsLauncher {
  static Future<void> showBottomSheet(
    context,
    double lat,
    double lng,
    String label,
  ) async {
    final options = [
      _MapOption(
        name: 'Google Maps',
        icon: '🗺️',
        url: 'https://www.google.com/maps/dir/?api=1&destination=$lat,$lng',
      ),
      _MapOption(
        name: 'Waze',
        icon: '🚗',
        url: 'waze://?ll=$lat,$lng&navigate=yes',
        fallback: 'https://waze.com/ul?ll=$lat,$lng&navigate=yes',
      ),
      _MapOption(
        name: '2GIS',
        icon: '📍',
        url: 'dgis://2gis.ru/routeSearch/rsType/car/to/$lng,$lat',
        fallback: 'https://2gis.ru/routeSearch/rsType/car/to/$lng,$lat',
      ),
      _MapOption(
        name: 'Yandex Maps',
        icon: '🧭',
        url: 'yandexmaps://maps.yandex.ru/?rtext=~$lat,$lng&rtt=auto',
        fallback: 'https://maps.yandex.ru/?rtext=~$lat,$lng&rtt=auto',
      ),
      if (Platform.isIOS)
        _MapOption(
          name: 'Apple Maps',
          icon: '🍎',
          url: 'maps://?daddr=$lat,$lng',
        ),
    ];

    await showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Text(
                'Navigate to $label',
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
            ),
            ...options.map((opt) => ListTile(
                  leading: Text(opt.icon, style: const TextStyle(fontSize: 24)),
                  title: Text(opt.name),
                  onTap: () async {
                    Navigator.pop(context);
                    await _launch(opt.url, opt.fallback);
                  },
                )),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  static Future<void> _launch(String url, [String? fallback]) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (fallback != null) {
      await launchUrl(Uri.parse(fallback), mode: LaunchMode.externalApplication);
    }
  }
}

class _MapOption {
  final String name;
  final String icon;
  final String url;
  final String? fallback;
  const _MapOption({required this.name, required this.icon, required this.url, this.fallback});
}
