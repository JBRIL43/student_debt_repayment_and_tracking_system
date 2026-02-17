import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';

class MinimalAuthTest extends StatefulWidget {
  const MinimalAuthTest({super.key});

  @override
  State<MinimalAuthTest> createState() => _MinimalAuthTestState();
}

class _MinimalAuthTestState extends State<MinimalAuthTest> {
  final _emailController = TextEditingController(text: 'hustudent@hu.edu.et');
  final _passwordController = TextEditingController(text: 'Test@123');
  bool _isLoading = false;
  String _result = '';

  Future<void> _signIn() async {
    setState(() {
      _isLoading = true;
      _result = '🔐 Attempting Firebase sign-in...\n';
    });

    try {
      // PURE FIREBASE AUTH - NO BACKEND CALLS
      print('🔐 Starting Firebase sign in...');
      final userCredential =
          await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );

      print('✅ Firebase sign in successful!');
      print('User UID: ${userCredential.user!.uid}');
      print('Email: ${userCredential.user!.email}');

      setState(() {
        _result = '''✅ FIREBASE AUTH SUCCESS!

User UID: ${userCredential.user!.uid}
Email: ${userCredential.user!.email}
Email Verified: ${userCredential.user!.emailVerified}
Phone: ${userCredential.user!.phoneNumber ?? 'Not set'}
Created: ${userCredential.user!.metadata.creationTime}

🎉 NO TYPE CAST ERRORS!
MediaTek Firebase plugin working correctly.
        ''';
        _isLoading = false;
      });
    } on FirebaseAuthException catch (e) {
      print('❌ Firebase Auth Exception: ${e.code}');
      setState(() {
        _isLoading = false;
        _result = '''❌ Firebase Error:

Code: ${e.code}
Message: ${e.message ?? 'Unknown error'}

Common codes:
- user-not-found: Create user in Firebase Console
- wrong-password: Check password
- network-request-failed: Check internet connection
        ''';
      });
    } catch (e) {
      print('💥 Unexpected Error: $e');
      setState(() {
        _isLoading = false;
        _result = '''💥 Unexpected Error:

${e.toString()}

⚠️ If you see "PigeonUserDetails cast error":
1. Run: flutter clean
2. Delete: android/.gradle
3. Rebuild: flutter run
        ''';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Firebase Auth Test'),
        backgroundColor: Colors.blue[700],
        foregroundColor: Colors.white,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            // Info banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange[50],
                border: Border.all(color: Colors.orange[300]!),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '⚠️ Password Required',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8),
                  Text(
                    '1. Check Firebase Console → Authentication\n'
                    '2. Verify student@hu.edu.et exists\n'
                    '3. If not, create new user with a password\n'
                    '4. Enter that password below',
                    style: TextStyle(fontSize: 13, color: Colors.black87),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Email field
            TextField(
              controller: _emailController,
              decoration: InputDecoration(
                labelText: 'Email',
                prefixIcon: const Icon(Icons.email),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Password field
            TextField(
              controller: _passwordController,
              decoration: InputDecoration(
                labelText: 'Password (from Firebase Console)',
                hintText: 'Enter the password you set in Firebase',
                prefixIcon: const Icon(Icons.lock),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              obscureText: true,
            ),
            const SizedBox(height: 20),

            // Test button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _signIn,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue[700],
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isLoading
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text(
                        'TEST FIREBASE AUTH ONLY',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 30),

            // Result display
            Expanded(
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(15),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey),
                  borderRadius: BorderRadius.circular(10),
                  color: Colors.grey[100],
                ),
                child: SingleChildScrollView(
                  child: _result.isEmpty
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Instructions:',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              '1. Open Firebase Console → Authentication\n'
                              '2. Go to "Users" tab\n'
                              '3. Create new user:\n'
                              '   Email: student@hu.edu.et\n'
                              '   Password: (enter any password, e.g., "Student@123")\n'
                              '4. Copy that password and enter it above\n'
                              '5. Tap "TEST FIREBASE AUTH ONLY"\n\n'
                              'Or use existing Firebase credentials if available.',
                              style: TextStyle(
                                  fontSize: 13, color: Colors.grey[700]),
                            ),
                          ],
                        )
                      : SelectableText(
                          _result,
                          style: const TextStyle(
                            fontSize: 14,
                            fontFamily: 'monospace',
                            height: 1.5,
                          ),
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}
