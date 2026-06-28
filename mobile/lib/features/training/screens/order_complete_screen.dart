import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/models/training_session_model.dart';

class OrderCompleteScreen extends StatefulWidget {
  final String sessionId;
  const OrderCompleteScreen({super.key, required this.sessionId});

  @override
  State<OrderCompleteScreen> createState() => _OrderCompleteScreenState();
}

class _OrderCompleteScreenState extends State<OrderCompleteScreen> {
  TrainingSessionModel? _session;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSession();
  }

  Future<void> _loadSession() async {
    // Poll briefly for score calculation
    for (int i = 0; i < 5; i++) {
      final s = await SupabaseService.getSession(widget.sessionId);
      if (s?.score != null) {
        setState(() { _session = s; _loading = false; });
        return;
      }
      await Future.delayed(const Duration(seconds: 1));
    }
    final s = await SupabaseService.getSession(widget.sessionId);
    setState(() { _session = s; _loading = false; });
  }

  Color _scoreColor(double? score) {
    if (score == null) return Colors.grey;
    if (score >= 80) return const Color(0xFF16A34A);
    if (score >= 70) return const Color(0xFFD97706);
    return const Color(0xFFDC2626);
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    final score = session?.score;
    final passed = session?.passed ?? false;
    final grade = session?.grade ?? '—';
    final breakdown = session?.scoreBreakdown as Map<String, dynamic>?;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: _loading
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Calculating your score…'),
                ],
              ),
            )
          : SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    const SizedBox(height: 20),
                    // Result icon
                    Icon(
                      passed ? Icons.emoji_events : Icons.refresh,
                      size: 64,
                      color: passed ? const Color(0xFFF59E0B) : const Color(0xFFDC2626),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      passed ? 'Training Passed!' : 'Training Complete',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.bold,
                        color: passed ? const Color(0xFF111827) : const Color(0xFFDC2626),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      passed
                          ? 'Great job! You have completed the training successfully.'
                          : 'You did not pass this time. Keep practicing!',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Color(0xFF6B7280)),
                    ),
                    const SizedBox(height: 24),

                    // Score
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                      ),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                score != null ? score.toStringAsFixed(1) : '—',
                                style: TextStyle(
                                  fontSize: 56,
                                  fontWeight: FontWeight.bold,
                                  color: _scoreColor(score),
                                ),
                              ),
                              const Text('%', style: TextStyle(fontSize: 24, color: Color(0xFF6B7280))),
                              const SizedBox(width: 16),
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: _scoreColor(score).withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Center(
                                  child: Text(
                                    grade,
                                    style: TextStyle(
                                      fontSize: 24,
                                      fontWeight: FontWeight.bold,
                                      color: _scoreColor(score),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            passed ? 'PASSED ✓' : 'FAILED ✗',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: passed ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Score breakdown
                    if (breakdown != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE5E7EB)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Score Breakdown',
                                style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF374151))),
                            const Divider(height: 16),
                            ...{
                              'Acceptance Time (15%)': 'acceptance',
                              'Pickup Time (15%)': 'pickup',
                              'Travel Time (30%)': 'travel',
                              'Return Time (20%)': 'return',
                              'POD Compliance (15%)': 'pod',
                              'Geofence (5%)': 'geofence',
                            }.entries.map((e) {
                              final val = (breakdown[e.value] as num?)?.toDouble() ?? 0;
                              return Padding(
                                padding: const EdgeInsets.only(bottom: 10),
                                child: Row(
                                  children: [
                                    Expanded(
                                      flex: 3,
                                      child: Text(e.key,
                                          style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280))),
                                    ),
                                    Expanded(
                                      flex: 4,
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(4),
                                        child: LinearProgressIndicator(
                                          value: val / 100,
                                          backgroundColor: const Color(0xFFF3F4F6),
                                          color: _scoreColor(val),
                                          minHeight: 8,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      '${val.toStringAsFixed(0)}%',
                                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                                    ),
                                  ],
                                ),
                              );
                            }),
                          ],
                        ),
                      ),
                    ],

                    const SizedBox(height: 24),

                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () => context.go('/ready'),
                        icon: const Icon(Icons.replay),
                        label: const Text('START NEW TRAINING'),
                      ),
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => context.push('/history'),
                        icon: const Icon(Icons.history),
                        label: const Text('View Training History'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
