const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const admin = require('../firebase-admin');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.user_id,
      email: user.email,
      role: user.role,
      studentId: user.student_id,
      departmentId: user.department_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Login endpoint (called by Flutter/React apps)
exports.login = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    const tokenParts = idToken.split('.');
    if (tokenParts.length !== 3) {
      console.error('Login error: Invalid ID token format', {
        length: idToken.length,
        parts: tokenParts.length,
      });
      return res.status(400).json({
        error: 'Invalid ID token format received by backend',
      });
    }

    // Verify Firebase ID token (with timeout)
    const decodedToken = await Promise.race([
      admin.auth().verifyIdToken(idToken),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firebase token verification timed out')), 8000)
      ),
    ]);
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;

    // Find user in PostgreSQL by firebase_uid
    const userResult = await pool.query(
      'SELECT * FROM users WHERE firebase_uid = $1 AND is_active = TRUE',
      [firebaseUid]
    );

    if (userResult.rows.length === 0) {
      // User doesn't exist in our DB - check if email exists (first-time login)
      const emailResult = await pool.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
        [email]
      );

      if (emailResult.rows.length === 0) {
        return res.status(401).json({
          error: 'User not registered in debt system. Contact registrar office.',
        });
      }

      // Link existing user with Firebase UID (first login sync)
      await pool.query('UPDATE users SET firebase_uid = $1 WHERE email = $2', [
        firebaseUid,
        email,
      ]);

      // Fetch updated user
      const updatedUser = await pool.query(
        'SELECT * FROM users WHERE firebase_uid = $1',
        [firebaseUid]
      );

      const token = generateToken(updatedUser.rows[0]);
      return res.json({
        success: true,
        token,
        user: updatedUser.rows[0],
      });
    }

    // User exists - generate JWT
    const token = generateToken(userResult.rows[0]);
    res.json({
      success: true,
      token,
      user: userResult.rows[0],
    });
  } catch (error) {
    console.error('Login error:', error);
    res
      .status(500)
      .json({ error: 'Authentication failed', details: error.message });
  }
};

// Protected route middleware (role-based)
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized, no token' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Not authorized, token failed' });
  }
};

// Role-based access middleware
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'You do not have permission to perform this action',
      });
    }
    next();
  };
};
