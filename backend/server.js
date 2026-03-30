const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();

// Debug - check if JWT_SECRET is loaded
console.log('🔑 JWT_SECRET loaded:', process.env.JWT_SECRET ? '✅ Yes' : '❌ No');
console.log('🔑 JWT_SECRET length:', process.env.JWT_SECRET?.length || 0);
console.log('☁️ Cloudinary configured:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Yes' : '❌ No');

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:5000",
    "http://localhost:3000",
    "https://kuku-backend-ntr4.onrender.com",
    "https://kukuyetu.netlify.app",
    "https://kukuyetu.vercel.app/"
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));

// ============== HEALTH CHECK ENDPOINT ==============
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============== API ROUTES ==============
// Auth routes
app.use('/api/auth', require('./routes/auth'));

// Product routes
app.use('/api/products', require('./routes/products'));

// Order routes
app.use('/api/orders', require('./routes/orders'));

// Notification routes
app.use('/api/notifications', require('./routes/notifications'));

// Dashboard routes
app.use('/api/dashboard', require('./routes/dashboard'));

// User routes
app.use('/api/user', require('./routes/user'));

// ============== ROOT ROUTE ==============
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>KUKU YETU API</title>
        <style>
          body { font-family: Arial; padding: 40px; background: #f5f5f5; }
          h1 { color: #ff6b00; }
          .card { background: white; padding: 20px; border-radius: 10px; max-width: 600px; margin: 20px auto; }
          a { color: #ff6b00; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🐔 KUKU YETU API</h1>
          <p>Your backend is running successfully! 🚀</p>
          <h3>Available Endpoints:</h3>
          <ul>
            <li><a href="/api/products">/api/products</a> - Get all products</li>
            <li><a href="/api/auth/login">/api/auth/login</a> - User login (POST)</li>
            <li><a href="/api/auth/register">/api/auth/register</a> - User registration (POST)</li>
            <li><a href="/health">/health</a> - Health check</li>
            <li><a href="/admin.html">/admin.html</a> - Admin panel</li>
            <li><a href="/index.html">/index.html</a> - User frontend</li>
          </ul>
          <p>Server time: ${new Date().toLocaleString()}</p>
        </div>
      </body>
    </html>
  `);
});

// ============== 404 HANDLER ==============
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'API route not found' 
  });
});

// ============== ERROR HANDLING MIDDLEWARE ==============
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Something went wrong!', 
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// ============== START SERVER ==============
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔧 Admin: http://localhost:${PORT}/admin.html`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
  console.log(`❤️  Health: http://localhost:${PORT}/health`);
});
