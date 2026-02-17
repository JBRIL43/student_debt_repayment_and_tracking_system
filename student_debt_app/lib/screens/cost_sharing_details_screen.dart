import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:student_debt_app/models/debt_model.dart';
import 'package:student_debt_app/screens/payment_screen.dart';
import 'package:student_debt_app/services/debt_service.dart';

class CostSharingDetailsScreen extends StatefulWidget {
  final DebtModel debt;
  final String studentName;
  final String token;

  const CostSharingDetailsScreen({
    super.key,
    required this.debt,
    required this.studentName,
    required this.token,
  });

  @override
  State<CostSharingDetailsScreen> createState() =>
      _CostSharingDetailsScreenState();
}

class _CostSharingDetailsScreenState extends State<CostSharingDetailsScreen> {
  late DebtModel _debt;
  bool _isRefreshing = false;

  @override
  void initState() {
    super.initState();
    _debt = widget.debt;
    _loadDebtBalance();
  }

  Future<void> _loadDebtBalance() async {
    if (_isRefreshing) return;
    setState(() => _isRefreshing = true);
    try {
      final response = await DebtService().getDebtBalance(widget.token);
      if (response['success'] == true) {
        final data = response['data'] as Map<String, dynamic>;
        setState(() {
          _debt = DebtModel.fromJson(data);
        });
      }
    } catch (_) {
      // keep existing snapshot on failure
    } finally {
      if (mounted) {
        setState(() => _isRefreshing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.currency(locale: 'en_ET', symbol: 'ETB ');
    final totalDebt =
        _debt.totalDebt > 0 ? _debt.totalDebt : _debt.initialAmount;
    final remaining = _debt.currentBalance;
    final totalPaid = (totalDebt - remaining).clamp(0.0, totalDebt);

    final livingComponents = _filterComponents('LIVING_STIPEND');
    final tuitionComponents = _filterComponents('TUITION');
    final medicalComponents = _filterComponents('MEDICAL');
    final otherComponents = _filterComponents('OTHER');

    final livingTotal = _sumAmount(livingComponents);
    final tuitionTotal = _sumAmount(tuitionComponents);
    final medicalTotal = _sumAmount(medicalComponents);
    final otherTotal = _sumAmount(otherComponents);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Cost Sharing Details'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildHeader(formatter, totalDebt, totalPaid, remaining),
          const SizedBox(height: 16),
          _buildSummaryGrid(
            formatter: formatter,
            livingTotal: livingTotal,
            tuitionTotal: tuitionTotal,
            medicalTotal: medicalTotal,
            otherTotal: otherTotal,
          ),
          const SizedBox(height: 16),
          _buildSection(
            title: 'Food & Accommodation',
            subtitle: 'Living stipend for meals, housing, and daily expenses.',
            items: livingComponents,
            formatter: formatter,
            accent: const Color(0xFFF59E0B),
            icon: Icons.restaurant,
          ),
          _buildSection(
            title: 'Tuition Cost Sharing',
            subtitle: '15% tuition cost sharing per semester.',
            items: tuitionComponents,
            formatter: formatter,
            accent: const Color(0xFF16A34A),
            icon: Icons.menu_book,
          ),
          _buildSection(
            title: 'Medical Coverage',
            subtitle: 'Medical cost sharing and campus health services.',
            items: medicalComponents,
            formatter: formatter,
            accent: const Color(0xFF2563EB),
            icon: Icons.local_hospital,
          ),
          _buildSection(
            title: 'Other Cost Sharing',
            subtitle: 'Additional approved charges (if any).',
            items: otherComponents,
            formatter: formatter,
            accent: const Color(0xFF7C3AED),
            icon: Icons.more_horiz,
          ),
          const SizedBox(height: 16),
          _buildPolicyNote(),
          const SizedBox(height: 16),
          _buildPayButton(context, remaining),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _filterComponents(String type) {
    final source =
        _debt.components.isNotEmpty ? _debt.components : _debt.unpaidComponents;
    return source
        .where((c) => (c['component_type'] as String?) == type)
        .toList();
  }

  Widget _buildHeader(
    NumberFormat formatter,
    double totalDebt,
    double totalPaid,
    double remaining,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Student: ${widget.studentName}',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          _buildAmountRow('Total Cost Sharing', formatter.format(totalDebt)),
          _buildAmountRow('Amount Paid', formatter.format(totalPaid)),
          _buildAmountRow('Remaining Balance', formatter.format(remaining)),
        ],
      ),
    );
  }

  Widget _buildSection({
    required String title,
    required String subtitle,
    required List<Map<String, dynamic>> items,
    required NumberFormat formatter,
    required Color accent,
    required IconData icon,
  }) {
    final semesterTotals = _groupBySemester(items);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accent.withOpacity(0.3)),
      ),
      child: Theme(
        data: ThemeData(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: EdgeInsets.zero,
          collapsedIconColor: accent,
          iconColor: accent,
          initiallyExpanded: items.isNotEmpty,
          title: Row(
            children: [
              Icon(icon, color: accent, size: 18),
              const SizedBox(width: 6),
              Text(
                title,
                style: TextStyle(fontWeight: FontWeight.bold, color: accent),
              ),
            ],
          ),
          subtitle: Text(
            subtitle,
            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),
          children: [
            const SizedBox(height: 4),
            if (items.isEmpty) const Text('No items in this category.'),
            if (semesterTotals.isNotEmpty) ...[
              const SizedBox(height: 8),
              const Text(
                'Semester Totals',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              ...semesterTotals.entries.map(
                (entry) => _buildSemesterTotalRow(
                  entry.key,
                  formatter.format(entry.value),
                ),
              ),
              const SizedBox(height: 8),
            ],
            ...items.map((item) => _buildComponentRow(item, formatter, accent)),
          ],
        ),
      ),
    );
  }

  Widget _buildComponentRow(
    Map<String, dynamic> item,
    NumberFormat formatter,
    Color accent,
  ) {
    final semester = item['semester']?.toString() ?? '';
    final year = item['academic_year']?.toString() ?? '';
    final description = item['description']?.toString() ?? 'Cost sharing item';
    final amountRaw = item['amount'];
    final status = (item['status']?.toString() ?? 'UNPAID').toUpperCase();
    final amount = amountRaw is num
        ? amountRaw.toDouble()
        : double.tryParse(amountRaw?.toString() ?? '') ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: accent.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.receipt_long, color: accent),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$semester $year',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Text(
                  description,
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 6),
                _buildStatusChip(status),
              ],
            ),
          ),
          Text(
            formatter.format(amount),
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusChip(String status) {
    final normalized = status.replaceAll('_', ' ');
    final color = status == 'PAID'
        ? const Color(0xFF16A34A)
        : status == 'PARTIALLY_PAID'
            ? const Color(0xFFF59E0B)
            : const Color(0xFFEF4444);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        normalized,
        style:
            TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color),
      ),
    );
  }

  Widget _buildAmountRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF64748B))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  double _sumAmount(List<Map<String, dynamic>> items) {
    return items.fold(0.0, (sum, item) {
      final amountRaw = item['amount'];
      final amount = amountRaw is num
          ? amountRaw.toDouble()
          : double.tryParse(amountRaw?.toString() ?? '') ?? 0;
      return sum + amount;
    });
  }

  Widget _buildSummaryGrid({
    required NumberFormat formatter,
    required double livingTotal,
    required double tuitionTotal,
    required double medicalTotal,
    required double otherTotal,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Cost Sharing Breakdown',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildSummaryCard(
                title: 'Food & Accommodation',
                value: formatter.format(livingTotal),
                icon: Icons.restaurant,
                color: const Color(0xFFF59E0B),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildSummaryCard(
                title: 'Tuition',
                value: formatter.format(tuitionTotal),
                icon: Icons.menu_book,
                color: const Color(0xFF16A34A),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _buildSummaryCard(
                title: 'Medical',
                value: formatter.format(medicalTotal),
                icon: Icons.local_hospital,
                color: const Color(0xFF2563EB),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _buildSummaryCard(
                title: 'Other',
                value: formatter.format(otherTotal),
                icon: Icons.more_horiz,
                color: const Color(0xFF7C3AED),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSummaryCard({
    required String title,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF64748B),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  Widget _buildPolicyNote() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Text(
        'Policy reminder: Living stipend must be fully paid before tuition cost sharing is accepted.',
        style: TextStyle(fontSize: 12, color: Color(0xFF1E64F0)),
      ),
    );
  }

  Widget _buildPayButton(BuildContext context, double remaining) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: remaining <= 0
            ? null
            : () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => PaymentScreen(
                      token: widget.token,
                      totalBalance: remaining,
                    ),
                  ),
                ).then((_) => _loadDebtBalance());
              },
        icon: const Icon(Icons.payments_outlined),
        label: const Text('Pay Cost Sharing'),
        style: ElevatedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
      ),
    );
  }

  Map<String, double> _groupBySemester(List<Map<String, dynamic>> items) {
    final totals = <String, double>{};
    for (final item in items) {
      final semester = item['semester']?.toString() ?? '';
      final year = item['academic_year']?.toString() ?? '';
      final key = '$semester $year'.trim();
      final amountRaw = item['amount'];
      final amount = amountRaw is num
          ? amountRaw.toDouble()
          : double.tryParse(amountRaw?.toString() ?? '') ?? 0;
      totals[key] = (totals[key] ?? 0) + amount;
    }
    return totals;
  }

  Widget _buildSemesterTotalRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
          Text(value,
              style:
                  const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
