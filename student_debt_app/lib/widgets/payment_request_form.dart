import 'dart:convert';

import 'package:flutter/foundation.dart'
    show TargetPlatform, defaultTargetPlatform, kIsWeb;
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:student_debt_app/screens/payment_status_screen.dart';

class PaymentRequestForm extends StatefulWidget {
  final double currentBalance;
  final String token;
  final String semester;
  final String academicYear;
  final String componentType;
  final VoidCallback onSubmitted;

  const PaymentRequestForm({
    super.key,
    required this.currentBalance,
    required this.token,
    required this.semester,
    required this.academicYear,
    required this.componentType,
    required this.onSubmitted,
  });

  @override
  State<PaymentRequestForm> createState() => _PaymentRequestFormState();
}

class _PaymentRequestFormState extends State<PaymentRequestForm> {
  static const String _apiOverride = String.fromEnvironment('API_URL');
  bool _isLoading = false;
  String? _error;
  String _paymentMethod = 'RECEIPT';
  final TextEditingController _transactionRefController =
      TextEditingController();

  @override
  void dispose() {
    _transactionRefController.dispose();
    super.dispose();
  }

  String get _apiUrl {
    if (_apiOverride.isNotEmpty) return _apiOverride;
    if (kIsWeb) return 'http://127.0.0.1:5000';
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://127.0.0.1:5000';
    }
    return 'http://127.0.0.1:5000';
  }

  Future<void> _submitRequest() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await http.post(
        Uri.parse('$_apiUrl/api/payments/request'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${widget.token}',
        },
        body: jsonEncode({
          'semester': widget.semester,
          'academicYear': widget.academicYear,
          'componentType': widget.componentType,
          'amount': widget.currentBalance,
          'paymentMethod': _paymentMethod,
          'transactionRef': _transactionRefController.text.trim().isEmpty
              ? null
              : _transactionRefController.text.trim(),
        }),
      );

      if (!mounted) return;

      if (response.statusCode == 201) {
        final payload = jsonDecode(response.body) as Map<String, dynamic>;
        final data = payload['data'] as Map<String, dynamic>;
        final requestId = data['requestId'] as int;
        widget.onSubmitted();
        Navigator.pop(context);
        if (!mounted) return;
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (context) => PaymentStatusScreen(
              token: widget.token,
              requestId: requestId,
              amount: widget.currentBalance,
              method: _paymentMethod,
              semester: widget.semester,
              academicYear: widget.academicYear,
            ),
          ),
        );
      } else {
        final payload = jsonDecode(response.body) as Map<String, dynamic>;
        setState(() {
          _error = payload['error']?.toString() ?? 'Request failed';
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Network error: $e';
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final formatter = NumberFormat.currency(locale: 'en_ET', symbol: 'ETB ');
    final isLiving = widget.componentType == 'LIVING_STIPEND';
    final accent = isLiving ? const Color(0xFFF59E0B) : const Color(0xFF16A34A);
    final bgTint = isLiving ? const Color(0xFFFFF7ED) : const Color(0xFFECFDF3);
    final icon = isLiving ? Icons.house_rounded : Icons.school_rounded;

    return AlertDialog(
      title: Text(
        isLiving ? 'Pay Living Stipend' : 'Pay Tuition Share',
        style: const TextStyle(fontWeight: FontWeight.bold),
      ),
      content: SizedBox(
        width: double.maxFinite,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: bgTint,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: accent.withOpacity(0.2)),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: accent.withOpacity(0.15),
                    child: Icon(icon, color: accent),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    '${widget.semester} ${widget.academicYear}',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: accent,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    isLiving
                        ? '3,000 Birr monthly stipend × 5 months'
                        : '15% tuition share',
                    style: const TextStyle(color: Color(0xFF475569)),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    formatter.format(widget.currentBalance),
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      color: accent,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _paymentMethod,
              items: const [
                DropdownMenuItem(value: 'RECEIPT', child: Text('Bank Receipt')),
                DropdownMenuItem(
                    value: 'CHAPA', child: Text('Chapa (Simulated)')),
              ],
              onChanged: _isLoading
                  ? null
                  : (value) =>
                      setState(() => _paymentMethod = value ?? 'RECEIPT'),
              decoration: const InputDecoration(
                labelText: 'Payment method',
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _transactionRefController,
              decoration: const InputDecoration(
                labelText: 'Bank transaction reference (optional)',
                hintText: 'AWB/2026/123456',
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: accent, size: 18),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Payments are verified by Finance Office before your balance updates.',
                      style: TextStyle(
                          fontSize: 12, color: Color(0xFF475569)),
                    ),
                  ),
                ],
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 10),
              Text(
                _error!,
                style: const TextStyle(color: Colors.red, fontSize: 12),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isLoading ? null : () => Navigator.pop(context),
          child: const Text('CANCEL'),
        ),
        ElevatedButton(
          onPressed: _isLoading ? null : _submitRequest,
          style: ElevatedButton.styleFrom(
            backgroundColor: accent,
          ),
          child: _isLoading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(color: Colors.white),
                )
              : const Text('REQUEST APPROVAL'),
        ),
      ],
    );
  }
}
