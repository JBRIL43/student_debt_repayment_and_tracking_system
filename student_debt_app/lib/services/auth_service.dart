import 'dart:async';
import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart'
    show TargetPlatform, defaultTargetPlatform, kIsWeb;
import 'package:http/http.dart' as http;

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  static const String _apiOverride = String.fromEnvironment('API_URL');
  String get _apiUrl {
    if (_apiOverride.isNotEmpty) return _apiOverride;
    if (kIsWeb) return 'http://127.0.0.1:5000';
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://127.0.0.1:5000';
    }
    return 'http://127.0.0.1:5000';
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      // 1. Sign in with Firebase Auth
      print('🔐 Attempting Firebase sign in...');
      UserCredential userCredential = await _auth.signInWithEmailAndPassword(
        email: email,
        password: password,
      );

      print('✅ Firebase sign in successful');

      // 2. Get Firebase ID token
      if (userCredential.user == null) {
        return {'success': false, 'error': 'User not found after sign in'};
      }

      print('🔑 Getting Firebase ID token...');
      String? idToken;
      try {
        idToken = await userCredential.user!.getIdToken(false);
      } catch (e) {
        print('⚠️ Token fetch error (trying alternative): $e');
        // Fallback: reload user and try again
        await userCredential.user!.reload();
        User? refreshedUser = _auth.currentUser;
        if (refreshedUser != null) {
          idToken = await refreshedUser.getIdToken(false);
        }
      }

      if (idToken == null || idToken.isEmpty) {
        return {
          'success': false,
          'error': 'Failed to get authentication token'
        };
      }

      print('🔑 Firebase ID Token obtained, length: ${idToken.length}');

      // 3. Exchange for our JWT token via backend API
      print('🌐 Calling backend: $_apiUrl/api/auth/login');
      final response = await http
          .post(
            Uri.parse('$_apiUrl/api/auth/login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'idToken': idToken}),
          )
          .timeout(const Duration(seconds: 10));

      print('📡 Backend response: ${response.statusCode}');
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        print('✅ Login successful! User: ${data['user']['email']}');
        // Save token to SharedPreferences (implement later)
        return {'success': true, 'user': data['user'], 'token': data['token']};
      } else {
        print('❌ Backend error: ${response.statusCode} - ${response.body}');
        final error = jsonDecode(response.body);
        return {'success': false, 'error': error['error'] ?? 'Login failed'};
      }
    } on FirebaseAuthException catch (e) {
      if (e.code == 'user-not-found') {
        return {'success': false, 'error': 'No user found for that email.'};
      } else if (e.code == 'wrong-password') {
        return {'success': false, 'error': 'Wrong password provided.'};
      } else {
        return {'success': false, 'error': 'Authentication error: ${e.code}'};
      }
    } on TimeoutException {
      return {
        'success': false,
        'error': 'Request timed out. Check backend connection.'
      };
    } catch (e) {
      print('💥 Exception in login: $e');
      return {'success': false, 'error': 'Network error: $e'};
    }
  }

  Future<void> logout() async {
    await _auth.signOut();
    // Clear saved token from SharedPreferences
  }
}
