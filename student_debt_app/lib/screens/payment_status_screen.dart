import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:student_debt_app/services/debt_service.dart';

class PaymentStatusScreen extends StatefulWidget {
  final String token;
  final int? requestId;
  final double amount;
  final String method;
  final String semester;
  final String academicYear;
  final String? initialStatus;

  const PaymentStatusScreen({
    super.key,
    required this.token,
    this.requestId,
    required this.amount,
    required this.method,
    required this.semester,
    required this.academicYear,
    this.initialStatus,
  });

  @override
  State<PaymentStatusScreen> createState() => _PaymentStatusScreenState();
}

class _PaymentStatusScreenState extends State<PaymentStatusScreen> {
  bool _checking = false;
  String _status = 'PENDING';

  @override
  void initState() {
    super.initState();
    if (widget.initialStatus != null) {
      _status = widget.initialStatus!.toUpperCase();
    } else if (widget.requestId == null) {
      _status = 'VERIFIED';
    }
  }

  Future<void> _checkVerification() async {
    setState(() => _checking = true);
    try {
      final response = await DebtService().getDebtBalance(widget.token);
      if (response['success'] == true) {
        final data = response['data'] as Map<String, dynamic>;
        final pending = (data['pending_requests'] as List?) ?? [];
        if (widget.requestId == null) {
          setState(() => _status = 'VERIFIED');
        } else {
          final Map<String, dynamic> match =
              pending.cast<Map<String, dynamic>>().firstWhere(
                    (req) => req['request_id'] == widget.requestId,
                    orElse: () => <String, dynamic>{},
                  );
          if (match.isEmpty) {
            setState(() => _status = 'VERIFIED');
          } else {
            final status = match['status']?.toString() ?? 'PENDING';
            setState(() => _status = status.toUpperCase());
          }
        }
      }
    } catch (_) {
      // ignore
    } finally {
      if (mounted) {
        setState(() => _checking = false);
      }
    }
  }

  void _showPaymentOptions() {
    showModalBottomSheet(
      context: context,
      builder: (context) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Payment Options (Simulation)',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 8),
            ListTile(
              leading: const Icon(Icons.account_balance),
              title: const Text('Awash Bank / Bank of Abyssinia'),
              subtitle: const Text('Pay at campus cashier and upload receipt.'),
              onTap: () => Navigator.pop(context),
            ),
            ListTile(
              leading: const Icon(Icons.credit_card),
              title: const Text('Chapa (Simulated)'),
              subtitle: const Text('Redirect to payment gateway (demo).'),
              onTap: () => Navigator.pop(context),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.currency(locale: 'en_ET', symbol: 'ETB ');
    final isVerified = _status == 'VERIFIED';
    final isRejected = _status == 'REJECTED';
    final steps = [
      _StepItem(
        title: 'Payment Initiated',
        description:
            'Voucher created for ${widget.semester} ${widget.academicYear}.',
        isDone: true,
      ),
      _StepItem(
        title: 'Redirected to Payment',
        description: 'Proceed using ${widget.method}.',
        isDone: true,
      ),
      _StepItem(
        title: 'Pending Verification',
        description: 'Finance Office will verify the receipt.',
        isDone: !isRejected,
      ),
      _StepItem(
        title: 'Verified & Balance Updated',
        description: 'Your balance will update after verification.',
        isDone: isVerified,
      ),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Payment Status'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Amount: ${formatter.format(widget.amount)}',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: _showPaymentOptions,
            icon: const Icon(Icons.open_in_new),
            label: const Text('Open Payment Options'),
          ),
          const SizedBox(height: 16),
          if (isRejected)
            Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFEF4444)),
              ),
              child: const Text(
                'Payment rejected. Please resubmit with a valid receipt.',
                style: TextStyle(color: Color(0xFFB91C1C)),
              ),
            ),
          ...steps.map((step) => _buildStep(step)),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _checking ? null : _checkVerification,
            child: _checking
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(color: Colors.white),
                  )
                : const Text('Check Verification Status'),
          ),
          if (isVerified)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Text(
                'Payment verified. Balance updated.',
                style: TextStyle(color: Color(0xFF16A34A)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildStep(_StepItem step) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: step.isDone ? const Color(0xFFF0FDF4) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color:
              step.isDone ? const Color(0xFF16A34A) : const Color(0xFFE2E8F0),
        ),
      ),
      child: Row(
        children: [
          Icon(
            step.isDone ? Icons.check_circle : Icons.hourglass_top,
            color:
                step.isDone ? const Color(0xFF16A34A) : const Color(0xFF64748B),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step.title,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  step.description,
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StepItem {
  final String title;
  final String description;
  final bool isDone;

  _StepItem({
    required this.title,
    required this.description,
    required this.isDone,
  });
}
