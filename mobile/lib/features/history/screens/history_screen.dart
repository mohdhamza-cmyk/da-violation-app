import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../core/services/supabase_service.dart';
import '../../../core/models/training_session_model.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<TrainingSessionModel> _sessions = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    final sessions = await SupabaseService.getHistory();
    setState(() { _sessions = sessions; _loading = false; });
  }

  Color _scoreColor(double? score) {
    if (score == null) return Colors.grey;
    if (score >= 80) return const Color(0xFF16A34A);
    if (score >= 70) return const Color(0xFFD97706);
    return const Color(0xFFDC2626);
  }

  @override
  Widget build(BuildContext context) {
    final totalCompleted = _sessions.where((s) => s.status == 'completed').length;
    final passed = _sessions.where((s) => s.passed == true).length;
    final avgScore = _sessions.isEmpty ? 0.0
        : _sessions.where((s) => s.score != null).map((s) => s.score!).fold(0.0, (a, b) => a + b) /
            (_sessions.where((s) => s.score != null).length.clamp(1, 9999));

    return Scaffold(
      appBar: AppBar(title: const Text('Training History')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                // Summary bar
                Container(
                  color: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Row(
                    children: [
                      _StatTile('Sessions', '$totalCompleted'),
                      _StatTile('Passed', '$passed'),
                      _StatTile('Avg Score', '${avgScore.toStringAsFixed(1)}%'),
                    ],
                  ),
                ),

                Expanded(
                  child: _sessions.isEmpty
                      ? const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.history, size: 48, color: Color(0xFFD1D5DB)),
                              SizedBox(height: 12),
                              Text('No training sessions yet', style: TextStyle(color: Color(0xFF6B7280))),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(12),
                          itemCount: _sessions.length,
                          itemBuilder: (_, i) {
                            final s = _sessions[i];
                            return Card(
                              margin: const EdgeInsets.only(bottom: 8),
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          s.orderCode,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontFamily: 'monospace',
                                            color: Color(0xFF2563EB),
                                          ),
                                        ),
                                        const Spacer(),
                                        if (s.score != null)
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: _scoreColor(s.score).withOpacity(0.1),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              '${s.score!.toStringAsFixed(1)}% ${s.grade ?? ''}',
                                              style: TextStyle(
                                                fontWeight: FontWeight.bold,
                                                color: _scoreColor(s.score),
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    if (s.location != null)
                                      Row(
                                        children: [
                                          const Icon(Icons.location_on, size: 14, color: Color(0xFF6B7280)),
                                          const SizedBox(width: 4),
                                          Text(s.location!.name,
                                              style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13)),
                                        ],
                                      ),
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        const Icon(Icons.schedule, size: 14, color: Color(0xFF6B7280)),
                                        const SizedBox(width: 4),
                                        Text(
                                          s.returnCompletedAt != null
                                              ? DateFormat('d MMM yyyy, HH:mm').format(s.returnCompletedAt!)
                                              : DateFormat('d MMM yyyy, HH:mm').format(s.assignedAt),
                                          style: const TextStyle(color: Color(0xFF6B7280), fontSize: 13),
                                        ),
                                        const Spacer(),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: s.passed == true
                                                ? const Color(0xFFF0FDF4)
                                                : const Color(0xFFFEF2F2),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: Text(
                                            s.passed == true ? 'PASSED' : 'FAILED',
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.bold,
                                              color: s.passed == true
                                                  ? const Color(0xFF16A34A)
                                                  : const Color(0xFFDC2626),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
    );
  }
}

class _StatTile extends StatelessWidget {
  final String label;
  final String value;
  const _StatTile(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Color(0xFF111827))),
          Text(label, style: const TextStyle(color: Color(0xFF6B7280), fontSize: 12)),
        ],
      ),
    );
  }
}
