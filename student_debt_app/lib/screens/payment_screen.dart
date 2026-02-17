import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:student_debt_app/services/debt_service.dart';
import 'package:student_debt_app/screens/payment_status_screen.dart';

class PaymentScreen extends StatefulWidget {
  final String token;
  final double? totalBalance;

  const PaymentScreen({super.key, required this.token, this.totalBalance});

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  static const Color _primary = Color(0xFF0F3D7C);
  static const Color _bg = Color(0xFFEFF5FF);
  static const Color _textDark = Color(0xFF0F172A);
  static const Color _textMuted = Color(0xFF64748B);
  String _selectedPlan = 'Semester';
  String _selectedMethod = 'CHAPA';
  int _selectedIndex = 1;
  bool _isLoading = true;
  bool _isPaying = false;
  String? _error;
  double? _currentBalance;

  @override
  void initState() {
    super.initState();
    _currentBalance = widget.totalBalance;
    _loadBalance();
  }

  Future<void> _loadBalance() async {
    try {
      final response = await DebtService().getDebtBalance(widget.token);
      if (response['success'] == true) {
        final data = response['data'] as Map<String, dynamic>;
        setState(() {
          _currentBalance = (data['current_balance'] as num).toDouble();
          _error = null;
        });
      } else {
        setState(() => _error = response['error']?.toString());
      }
    } catch (e) {
      setState(() => _error = 'Failed to load balance: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  double _calculateAmount() {
    final balance = _currentBalance ?? widget.totalBalance ?? 0.0;
    switch (_selectedPlan) {
      case 'Advance':
        return balance * 0.25;
      case 'Full Year':
        return balance;
      case 'Semester':
      default:
        return balance * 0.5;
    }
  }

  Future<void> _submitMockPayment() async {
    if (_currentBalance == null) return;
    final amount = _calculateAmount();
    if (amount <= 0) return;

    setState(() => _isPaying = true);
    try {
      final response = await DebtService().mockPay(
        widget.token,
        amount,
        paymentMethod: _selectedMethod,
      );
      if (response['success'] == true) {
        final data = response['data'] as Map<String, dynamic>;
        final requestId = data['request_id'] as int;
        setState(() => _error = null);
        if (!mounted) return;
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (context) => PaymentStatusScreen(
              token: widget.token,
              requestId: requestId,
              amount: amount,
              method: _selectedMethod,
              semester: 'CURRENT',
              academicYear: DateTime.now().year.toString(),
              initialStatus: 'PENDING',
            ),
          ),
        );
      }
    } catch (e) {
      setState(() => _error = 'Payment failed: $e');
    } finally {
      if (mounted) {
        setState(() => _isPaying = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.currency(locale: 'en_ET', symbol: 'ETB ');
    final amount = _calculateAmount();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Make a Payment'),
        backgroundColor: _bg,
        foregroundColor: _textDark,
        elevation: 0,
      ),
      backgroundColor: _bg,
      body: SafeArea(
        child: _isLoading && _currentBalance == null
            ? const Center(child: CircularProgressIndicator())
            : SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_error != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.red[50],
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.red[200]!),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: Colors.red),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _error!,
                                style: const TextStyle(color: Colors.red),
                              ),
                            ),
                            TextButton(
                              onPressed: _loadBalance,
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      ),
                    _buildAmountCard(
                      title: 'Remaining Balance',
                      amount: formatter.format(_currentBalance ?? 0),
                      subtitle: 'This is your current outstanding balance.',
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'Choose your payment plan',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: _textDark,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
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
                          _buildPlanButton('Advance'),
                          _buildPlanButton('Semester'),
                          _buildPlanButton('Full Year'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    _buildAmountCard(
                      title: 'Payment Amount',
                      amount: formatter.format(amount),
                      subtitle:
                          'This is the calculated amount for the selected plan.',
                    ),
                    const SizedBox(height: 16),
                    const Text(
                      'How would you like to pay?',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: _textDark,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildMethodCard(
                      title: 'Pay Online (Chapa)',
                      subtitle: 'Secure online payment',
                      icon: Icons.credit_card,
                      value: 'CHAPA',
                    ),
                    const SizedBox(height: 10),
                    _buildMethodCard(
                      title: 'Upload Bank Receipt',
                      subtitle: 'Works offline',
                      icon: Icons.receipt_long,
                      value: 'RECEIPT',
                    ),
                    const SizedBox(height: 12),
                    Container(
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
                      child: const Row(
                        children: [
                          Icon(Icons.info_outline, color: _primary),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Online payments are processed securely by Chapa. You can upload receipts later if you are offline.',
                              style: TextStyle(color: _textMuted, fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _isPaying ? null : _submitMockPayment,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _primary,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _isPaying
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(
                                    color: Colors.white),
                              )
                            : Text(
                                _selectedMethod == 'CHAPA'
                                    ? 'Pay (Mock)'
                                    : 'Upload Receipt (Mock)',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
      ),
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

  void _onNavTap(int index) {
    setState(() => _selectedIndex = index);
    if (index == 0) {
      if (Navigator.canPop(context)) {
        Navigator.pop(context);
      }
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

  Widget _buildPlanButton(String label) {
    final isSelected = _selectedPlan == label;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedPlan = label),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          margin: const EdgeInsets.symmetric(horizontal: 2),
          decoration: BoxDecoration(
            color: isSelected ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: isSelected ? _primary : _textMuted,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAmountCard({
    required String title,
    required String amount,
    required String subtitle,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Text(
            amount,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: _primary,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: const TextStyle(color: _textMuted, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildMethodCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required String value,
  }) {
    final isSelected = _selectedMethod == value;
    return InkWell(
      onTap: () => setState(() => _selectedMethod = value),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color:
                isSelected ? const Color(0xFF1E64F0) : const Color(0xFFE2E8F0),
            width: 1.4,
          ),
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
            CircleAvatar(
              backgroundColor: const Color(0xFFEAF1FF),
              child: Icon(icon, color: const Color(0xFF1E64F0)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    style:
                        const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                  ),
                ],
              ),
            ),
            Radio<String>(
              value: value,
              groupValue: _selectedMethod,
              onChanged: (val) {
                if (val == null) return;
                setState(() => _selectedMethod = val);
              },
            ),
          ],
        ),
      ),
    );
  }
}
