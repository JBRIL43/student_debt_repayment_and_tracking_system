import 'dart:convert';
import 'package:flutter/foundation.dart'
    show TargetPlatform, defaultTargetPlatform, kIsWeb;
import 'package:http/http.dart' as http;

class DebtService {
  static const String _apiOverride = String.fromEnvironment('API_URL');
  String get _apiUrl {
    if (_apiOverride.isNotEmpty) return _apiOverride;
    if (kIsWeb) return 'http://127.0.0.1:5000';
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://127.0.0.1:5000';
    }
    return 'http://127.0.0.1:5000';
  }

  Future<Map<String, dynamic>> getDebtBalance(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$_apiUrl/api/debt/balance'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } else {
        final error = jsonDecode(response.body) as Map<String, dynamic>;
        throw Exception(error['error'] ?? 'Failed to load debt balance');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  Future<Map<String, dynamic>> mockPay(
    String token,
    double amount, {
    String paymentMethod = 'RECEIPT',
    String? transactionRef,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$_apiUrl/api/debt/mock-pay'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'amount': amount,
          'paymentMethod': paymentMethod,
          'transactionRef': transactionRef,
        }),
      );

      Map<String, dynamic>? payload;
      try {
        payload = jsonDecode(response.body) as Map<String, dynamic>;
      } catch (_) {
        payload = null;
      }

      if (response.statusCode == 200) {
        if (payload == null) {
          throw Exception('Unexpected response from server');
        }
        return payload;
      } else {
        final errorMessage = payload?['error']?.toString();
        throw Exception(errorMessage ?? 'Mock payment failed');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }

  Future<Map<String, dynamic>> getClearance(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$_apiUrl/api/registrar/clearance'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } else {
        final error = jsonDecode(response.body) as Map<String, dynamic>;
        throw Exception(error['error'] ?? 'Failed to load clearance letter');
      }
    } catch (e) {
      throw Exception('Network error: $e');
    }
  }
}
