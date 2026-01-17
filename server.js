const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(compression());
app.use(morgan('dev'));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Routes - updated
const authRoutes = require('./backend/routes/auth');
const adminRoutes = require('./backend/routes/admin');
const venueRoutes = require('./backend/routes/venue');
const advertiserRoutesNew = require('./backend/routes/advertiserRoutes');
const paymentRoutes = require('./backend/routes/payment');
console.log('🔍 advertiserRoutes:', typeof advertiserRoutesNew);
console.log('🔍 advertiserRoutes._router:', advertiserRoutesNew._router);

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/venue', venueRoutes);
app.use('/api/advertiser', advertiserRoutesNew);
app.use('/api/payment', paymentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AdScreen Pro API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      venue: '/api/venue',
      advertiser: '/api/advertiser',
      payment: '/api/payment'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   🚀 AdScreen Pro API Server        ║
  ║                                      ║
  ║   Port: ${PORT.toString().padEnd(29)}║
  ║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(21)}║
  ║   Time: ${new Date().toLocaleTimeString().padEnd(29)}║
  ╚══════════════════════════════════════╝
  `);
});

module.exports = app;
