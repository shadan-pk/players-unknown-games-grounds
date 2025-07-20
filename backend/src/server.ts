import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/database';
import authRoutes from './routes/auth';
import gameRoutes from './routes/games';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001; // Fix: Parse to number

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    message: 'PUGG Backend is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Temporary game types route (until we fix the routes)
app.get('/api/games/types', async (req: Request, res: Response) => {
  try {
    const fallbackData = [
      {
        id: 'tictactoe',
        name: 'Tic Tac Toe',
        description: 'Classic 3x3 grid game where you try to get three in a row',
        min_players: 2,
        max_players: 2,
        estimated_duration: '3 minutes',
        difficulty_level: 'easy',
        is_active: true,
        icon: '⭕',
        rules: 'Take turns placing X or O on a 3x3 grid. First to get three in a row wins!',
        tags: ['classic', 'quick', 'simple'],
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'checkers',
        name: 'Checkers',
        description: 'Strategic board game with jumping and capturing',
        min_players: 2,
        max_players: 2,
        estimated_duration: '15 minutes',
        difficulty_level: 'medium',
        is_active: true,
        icon: '🔴',
        rules: 'Move your pieces diagonally and jump over opponents to capture them.',
        tags: ['strategy', 'classic', 'board'],
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'chess',
        name: 'Chess',
        description: 'Ultimate strategy game with different piece types',
        min_players: 2,
        max_players: 2,
        estimated_duration: '30 minutes',
        difficulty_level: 'hard',
        is_active: true,
        icon: '♔',
        rules: 'Checkmate your opponent\'s king using various pieces with unique movement patterns.',
        tags: ['strategy', 'classic', 'complex'],
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    
    res.json({
      success: true,
      data: fallbackData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch games'
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
// Comment out the game routes import until we fix the files
// app.use('/api/games', gameRoutes);

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    availableRoutes: [
      'GET /health',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/verify',
      'GET /api/games/types'
    ]
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const startServer = async () => {
  // Initialize database connections
  const dbConnected = await initializeDatabase();
  
  app.listen(PORT, () => {
    console.log(`🚀 PUGG Backend server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth routes: http://localhost:${PORT}/api/auth/*`);
    console.log(`🎮 Game routes: http://localhost:${PORT}/api/games/*`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 CORS enabled for: localhost:3000, localhost:5173`);
    console.log(`💾 Database: ${dbConnected ? 'Connected' : 'Disconnected (dev mode)'}`);
  });
};

startServer();

export default app;
