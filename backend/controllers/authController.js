const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

class AuthController {
  async login(req, res) {
    try {
      const { email, password } = req.body;

      console.log('🔍 Login attempt for:', email);

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      const result = await db.query(
        'SELECT id, email, password_hash, full_name, role, is_active FROM users WHERE email = $1',
        [email]
      );

      console.log('🔍 Query result rows:', result.rows.length);

      if (result.rows.length === 0) {
        console.log('❌ User not found');
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];
      
      console.log('🔍 User found:', user.email, 'Role:', user.role);
      console.log('🔍 Password hash from DB:', user.password_hash);
      console.log('🔍 Password from request:', password);

      if (!user.is_active) {
        return res.status(401).json({ error: 'Account is inactive' });
      }

      console.log('🔍 Comparing passwords...');
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      console.log('🔍 Password valid:', isValidPassword);

      if (!isValidPassword) {
        console.log('❌ Invalid password');
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      console.log('✅ Login successful for:', user.email);

      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role
        },
        token
      });
    } catch (error) {
      console.error('❌ Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  async register(req, res) {
    try {
      const { email, password, fullName, phone, role, businessName } = req.body;

      if (!email || !password || !fullName || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const existingUser = await db.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      const userResult = await db.query(
        `INSERT INTO users (email, password_hash, full_name, phone, role) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, email, full_name, role`,
        [email, passwordHash, fullName, phone, role]
      );

      const user = userResult.rows[0];

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'Registration successful',
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role
        },
        token
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  async me(req, res) {
    try {
      const result = await db.query(
        'SELECT id, email, full_name, role, language, created_at FROM users WHERE id = $1',
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ user: result.rows[0] });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({ error: 'Failed to get user info' });
    }
  }
}

module.exports = new AuthController();
