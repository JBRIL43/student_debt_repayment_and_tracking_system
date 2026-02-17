// ignore_for_file: unused_field, unused_element
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:student_debt_app/models/debt_model.dart';
import 'package:student_debt_app/screens/payment_screen.dart';
import 'package:student_debt_app/services/debt_service.dart';
import 'package:student_debt_app/screens/cost_sharing_details_screen.dart';
import 'package:student_debt_app/widgets/payment_request_form.dart';

class HomeScreen extends StatefulWidget {
  final dynamic user;
  final String token;

  const HomeScreen({
    super.key,
    required this.user,
    required this.token,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const Color _primary = Color(0xFF0F3D7C);
  static const Color _bg = Color(0xFFEFF5FF);
  static const Color _textDark = Color(0xFF0F172A);
  static const Color _textMuted = Color(0xFF64748B);
  DebtModel? _debtData;
  bool _isLoading = true;
  String? _error;
  Map<String, dynamic>? _clearanceLetter;
  bool _isLoadingClearance = false;
  final ScrollController _scrollController = ScrollController();
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadDebtBalance();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadDebtBalance() async {
    setState(() => _isLoading = true);

    try {
      final response = await DebtService().getDebtBalance(widget.token);

      if (response['success'] == true) {
        setState(() {
          _debtData = DebtModel.fromJson(response['data']);
          _error = null;
        });
        await _loadClearance();
      } else {
        setState(() => _error = response['error'] ?? 'Unknown error');
      }
    } catch (e) {
      setState(() => _error = 'Failed to load balance: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _loadClearance() async {
    if (_isLoadingClearance) return;
    setState(() => _isLoadingClearance = true);
    try {
      final response = await DebtService().getClearance(widget.token);
      if (response['success'] == true) {
        setState(() {
          _clearanceLetter = response['letter'] as Map<String, dynamic>?;
        });
      }
    } catch (_) {
      // ignore clearance fetch errors
    } finally {
      if (mounted) {
        setState(() => _isLoadingClearance = false);
      }
    }
  }

  void _showClearanceDialog() {
    final letter = _clearanceLetter;
    if (letter == null) return;
    final issuedAt = letter['issued_at']?.toString() ?? '';

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clearance Letter (Simulation)'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Issued at: $issuedAt'),
            const SizedBox(height: 8),
            const Text(
              'This is a simulated clearance letter. Please collect the signed physical letter from the registrar office.',
              style: TextStyle(fontSize: 12, color: _textMuted),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        backgroundColor: _bg,
        foregroundColor: _textDark,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none),
            onPressed: () => _showComingSoon('Notifications coming soon'),
          ),
        ],
      ),
      backgroundColor: _bg,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildErrorWidget()
              : _debtData != null
                  ? _buildBalanceDashboard()
                  : const Center(child: Text('No debt data available')),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _selectedIndex,
        onTap: _onNavTap,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(
              icon: Icon(Icons.payments_outlined), label: 'Payments'),
          BottomNavigationBarItem(
              icon: Icon(Icons.person_outline), label: 'Profile'),
          BottomNavigationBarItem(
              icon: Icon(Icons.notifications_outlined), label: 'Notifications'),
        ],
      ),
    );
  }

  Widget _buildErrorWidget() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 60, color: Colors.red),
            const SizedBox(height: 16),
            Text(
              '$_error',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.red, fontSize: 16),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loadDebtBalance,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBalanceDashboard() {
    final debt = _debtData!;
    final formatter = NumberFormat.currency(locale: 'en_ET', symbol: 'ETB ');

    final fullName = (widget.user?['full_name'] ?? 'Student').toString();
    final totalDebt = debt.totalDebt > 0 ? debt.totalDebt : debt.initialAmount;
    final remaining = debt.currentBalance;
    final totalPaid = (totalDebt - remaining).clamp(0.0, totalDebt);
    final percentPaid = remaining <= 0
        ? 1.0
        : (totalDebt <= 0 ? 0.0 : (totalPaid / totalDebt).clamp(0.0, 1.0));
    final hasPendingVerification = debt.pendingRequests
        .any((request) => request['status']?.toString() == 'PENDING');
    final statusText = remaining <= 0
        ? 'Payment completed'
        : hasPendingVerification
            ? 'Pending verification'
            : 'Pending';
    final statusColor = remaining <= 0
        ? const Color(0xFF16A34A)
        : hasPendingVerification
            ? const Color(0xFF2563EB)
            : const Color(0xFFF59E0B);

    return RefreshIndicator(
      onRefresh: _loadDebtBalance,
      child: SingleChildScrollView(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Welcome, $fullName',
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: _textDark,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Debt History',
              style: TextStyle(fontSize: 12, color: _textMuted),
            ),
            const SizedBox(height: 12),
            if (remaining <= 0)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFECFDF3),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF16A34A)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.check_circle, color: Color(0xFF16A34A)),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Paid in full. You have no outstanding debt.',
                        style: TextStyle(
                          color: Color(0xFF166534),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (remaining > 0 && hasPendingVerification)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF2563EB)),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.hourglass_top, color: Color(0xFF2563EB)),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Payment submitted and pending finance verification.',
                        style: TextStyle(
                          color: Color(0xFF1E40AF),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            if (_clearanceLetter != null)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF16A34A)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.verified, color: Color(0xFF16A34A)),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Clearance letter issued. Collect the signed physical copy from registrar office.',
                        style: TextStyle(
                          color: Color(0xFF166534),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: _showClearanceDialog,
                      child: const Text('View'),
                    ),
                  ],
                ),
              ),
            GestureDetector(
              onTap: () => _showCostSharingDetails(debt),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Total Remaining Debt',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: _textMuted,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            formatter.format(remaining),
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: _textDark,
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: _buildLegendBlock(
                                  label: 'Paid',
                                  color: const Color(0xFF1E64F0),
                                  value: formatter.format(totalPaid),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _buildLegendBlock(
                                  label: 'Remaining',
                                  color: const Color(0xFFE2E8F0),
                                  value: formatter.format(remaining),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          const Row(
                            children: [
                              Text(
                                'View cost-sharing details',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Color(0xFF1E64F0),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              SizedBox(width: 4),
                              Icon(
                                Icons.arrow_forward_ios,
                                size: 12,
                                color: Color(0xFF1E64F0),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    SizedBox(
                      height: 120,
                      width: 120,
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          CircularProgressIndicator(
                            value: percentPaid,
                            strokeWidth: 10,
                            backgroundColor: const Color(0xFFE2E8F0),
                            valueColor: const AlwaysStoppedAnimation<Color>(
                              Color(0xFF1E64F0),
                            ),
                          ),
                          Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Text('Paid',
                                  style: TextStyle(
                                      fontSize: 11, color: _textMuted)),
                              Text('${(percentPaid * 100).round()}%',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildSummaryCard(
                      'Total Debt', formatter.format(totalDebt)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildSummaryCard(
                      'Amount Paid', formatter.format(totalPaid)),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _buildSummaryCard(
                      'Remaining', formatter.format(remaining)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildSummaryCard('Status', statusText,
                      valueColor: statusColor),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildHistorySection(debt),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActionButton({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          children: [
            Icon(icon, color: color),
            const SizedBox(height: 6),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLegendBlock({
    required String label,
    required Color color,
    required String value,
  }) {
    return Row(
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style:
                    const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryCard(String title, String value,
      {Color valueColor = _textDark}) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 11, color: _textMuted),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.bold,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPolicyBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(12),
        border:
            const Border(left: BorderSide(width: 4, color: Color(0xFF1E64F0))),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Ethiopian Cost-Sharing Policy',
            style: TextStyle(
                fontWeight: FontWeight.bold, color: Color(0xFF0F3D7C)),
          ),
          SizedBox(height: 6),
          Text(
            '• Living stipend debt must be paid before tuition\n'
            '• 0% interest – pay only what you borrowed\n'
            '• Repayment is structured by semester',
            style:
                TextStyle(fontSize: 12, color: Color(0xFF475569), height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _buildDebtComponentCard({
    required String title,
    required double amount,
    required String subtitle,
    required Color color,
    required bool isPayable,
    required VoidCallback? onTap,
  }) {
    final formatter = NumberFormat.currency(locale: 'en_ET', symbol: 'ETB ');

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isPayable ? color.withOpacity(0.08) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isPayable ? color : const Color(0xFFE2E8F0),
            width: 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: isPayable ? color : _textMuted,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              formatter.format(amount),
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: isPayable ? color : _textMuted,
              ),
            ),
            const SizedBox(height: 4),
            Text(subtitle,
                style: const TextStyle(fontSize: 11, color: _textMuted)),
            const SizedBox(height: 8),
            if (!isPayable)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Text(
                  'PAY LIVING FIRST',
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600),
                ),
              )
            else
              Text(
                'Tap to pay',
                style: TextStyle(
                    color: color, fontSize: 11, fontWeight: FontWeight.w600),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildHistorySection(DebtModel debt) {
    final successPayments = debt.paymentHistory
        .where((p) => (p['status']?.toString() ?? '') == 'SUCCESS')
        .toList();

    if (successPayments.isEmpty) {
      return const Text('No payment history yet');
    }

    final formatter = NumberFormat.currency(locale: 'en_ET', symbol: 'ETB ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Transaction History',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Color(0xFF0F172A),
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Swipe down to refresh',
          style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
        ),
        const SizedBox(height: 12),
        ListView.builder(
          itemCount: successPayments.length,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemBuilder: (context, index) {
            final payment = successPayments[index] as Map<String, dynamic>;
            final amount = formatter.format(payment['amount']);
            final date = DateFormat('MMM dd, yyyy').format(
              DateTime.parse(payment['payment_date'] as String),
            );

            return Container(
              margin: const EdgeInsets.symmetric(vertical: 6),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  const CircleAvatar(
                    backgroundColor: Color(0xFFDCFCE7),
                    child: Icon(Icons.check, color: Color(0xFF166534)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          amount,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Completed',
                          style: TextStyle(
                            color: Color(0xFF166534),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    date,
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  List<Map<String, dynamic>> _unpaidByType(String componentType) {
    return _debtData?.unpaidComponents
            .where((c) => (c['component_type'] as String?) == componentType)
            .toList() ??
        [];
  }

  void _showPolicyRestriction() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Ethiopian University Policy'),
        content: const Text(
          'Living stipend debt must be fully paid before tuition payments are accepted.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('UNDERSTAND'),
          ),
        ],
      ),
    );
  }

  void _showSemesterSelector(String componentType) {
    final components = _unpaidByType(componentType);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Pay $componentType Debt'),
        content: SizedBox(
          width: double.maxFinite,
          child: components.isEmpty
              ? const Text('No unpaid semesters available for this component.')
              : ListView.builder(
                  shrinkWrap: true,
                  itemCount: components.length,
                  itemBuilder: (context, index) {
                    final c = components[index];
                    return _buildSemesterTile(c, componentType);
                  },
                ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('CANCEL'),
          ),
        ],
      ),
    );
  }

  Widget _buildSemesterTile(
      Map<String, dynamic> component, String componentType) {
    final formatter = NumberFormat.currency(locale: 'en_ET', symbol: 'ETB ');
    final semester = component['semester']?.toString() ?? '';
    final year = component['academic_year']?.toString() ?? '';
    final amountRaw = component['amount'];
    final amount = amountRaw is num
        ? amountRaw.toDouble()
        : double.tryParse(amountRaw?.toString() ?? '') ?? 0;

    return ListTile(
      leading: Icon(
        componentType == 'LIVING_STIPEND' ? Icons.house : Icons.school,
        color: componentType == 'LIVING_STIPEND'
            ? const Color(0xFFF59E0B)
            : const Color(0xFF16A34A),
      ),
      title: Text('$semester $year'),
      subtitle: Text(componentType == 'LIVING_STIPEND'
          ? '3,000 Birr × 5 months'
          : '15% tuition share'),
      trailing: Text(
        formatter.format(amount),
        style: const TextStyle(fontWeight: FontWeight.bold),
      ),
      onTap: () {
        Navigator.pop(context);
        _showPaymentRequestForm(
          semester: semester,
          academicYear: year,
          componentType: componentType,
          amount: amount,
        );
      },
    );
  }

  void _showPaymentRequestForm({
    required String semester,
    required String academicYear,
    required String componentType,
    required double amount,
  }) {
    showDialog(
      context: context,
      builder: (context) => PaymentRequestForm(
        currentBalance: amount,
        token: widget.token,
        semester: semester,
        academicYear: academicYear,
        componentType: componentType,
        onSubmitted: _loadDebtBalance,
      ),
    );
  }

  void _scrollToHistory() {
    if (!_scrollController.hasClients) return;
    _scrollController.animateTo(
      _scrollController.position.maxScrollExtent,
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeInOut,
    );
  }

  void _showCostSharingDetails(DebtModel debt) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => CostSharingDetailsScreen(
          debt: debt,
          studentName: (widget.user?['full_name'] ?? 'Student').toString(),
          token: widget.token,
        ),
      ),
    );
  }

  Future<void> _onNavTap(int index) async {
    setState(() => _selectedIndex = index);
    if (index == 1 && _debtData != null) {
      await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => PaymentScreen(
            token: widget.token,
            totalBalance: _debtData!.currentBalance,
          ),
        ),
      );
      await _loadDebtBalance();
    } else if (index == 2) {
      _showComingSoon('Profile coming soon');
    } else if (index == 3) {
      _showComingSoon('Notifications coming soon');
    }
  }

  void _showComingSoon(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(seconds: 2),
      ),
    );
  }
}
