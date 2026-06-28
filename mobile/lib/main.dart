import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'app/router.dart';
import 'app/theme.dart';

const supabaseUrl = 'https://xrghxfmtbmajmibsvwpr.supabase.co';
const supabaseAnonKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhyZ2h4Zm10Ym1ham1pYnN2d3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5Njc4NzUsImV4cCI6MjA5NzU0Mzg3NX0.KgciQCK6QgO20L_BTbZycB1imha0ZMU5dyn4kHpvj64';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
  runApp(const ProviderScope(child: RiderTrainingApp()));
}

class RiderTrainingApp extends ConsumerWidget {
  const RiderTrainingApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Rider Training',
      theme: AppTheme.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
