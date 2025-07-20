import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initializeDatabase } from './config/database';
import { MatchmakingService } from './services/MatchmakingService';
import authRoutes from './routes/auth';
import gameRoutes from './routes/games';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    ],
    credentials: true
  }
});

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
app.use('/api/games', gameRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on('authenticate', (token) => {
    // For now, just acknowledge the authentication
    socket.emit('authenticated', { success: true, user: { id: 'user123', username: 'Player' } });
  });

  // Matchmaking events
  socket.on('join-queue', async (data) => {
    console.log('Player joining queue:', data);
    const { gameType, matchType = 'casual' } = data;
    
    try {
      // Add player to matchmaking queue
      await MatchmakingService.addToQueue('user123', gameType, matchType);
      
      // Get queue status
      const queueStatus = await MatchmakingService.getQueueStatus(gameType);
      
      socket.emit('queue-joined', {
        gameType,
        matchType,
        status: queueStatus,
        estimatedWaitTime: 30
      });
      
      console.log(`Player user123 added to ${gameType} ${matchType} queue`);
      
      // Start checking for matches
      checkForMatches(gameType, matchType);
    } catch (error) {
      console.error('Error joining queue:', error);
      socket.emit('error', { message: 'Failed to join queue' });
    }
  });

  socket.on('leave-queue', async () => {
    console.log('Player leaving queue');
    try {
      await MatchmakingService.removeFromAllQueues('user123');
      socket.emit('queue-left');
    } catch (error) {
      console.error('Error leaving queue:', error);
    }
  });

  socket.on('accept-match', () => {
    console.log('Player accepted match');
    socket.emit('match-accepted', {
      sessionId: `session_${Date.now()}`,
      roomCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      gameType: 'tictactoe',
      players: [
        { id: 'user123', username: 'Player 1', elo: 1200 },
        { id: 'user456', username: 'Player 2', elo: 1250 }
      ],
      matchType: 'casual'
    });
  });

  socket.on('decline-match', () => {
    console.log('Player declined match');
    socket.emit('match-declined');
  });

  // Game room events
  socket.on('create-room', (data) => {
    const { gameType } = data;
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const sessionId = `session_${Date.now()}`;
    
    socket.emit('room-created', {
      sessionId,
      roomCode,
      gameType,
      players: [{ id: 'user123', username: 'Player', elo: 1200 }],
      matchType: 'casual'
    });
  });

  socket.on('join-room', (data) => {
    const { roomCode } = data;
    
    socket.emit('room-joined', {
      sessionId: `session_${Date.now()}`,
      roomCode,
      gameType: 'tictactoe',
      players: [
        { id: 'user123', username: 'Player 1', elo: 1200 },
        { id: 'user456', username: 'Player 2', elo: 1250 }
      ],
      matchType: 'casual'
    });
  });

  socket.on('leave-room', () => {
    socket.emit('room-left');
  });

  // Gameplay events
  socket.on('make-move', (data) => {
    // Echo the move back for now
    socket.emit('move-made', {
      gameState: { currentPlayerIndex: 1 },
      move: data.move,
      nextPlayer: { id: 'user456', username: 'Player 2' }
    });
  });

  socket.on('forfeit-game', () => {
    socket.emit('game-ended', {
      result: { result: 'forfeit', winner: { id: 'user456', username: 'Player 2' } },
      stats: { duration: 120, totalMoves: 5 }
    });
  });

  socket.on('request-rematch', () => {
    socket.emit('rematch-requested', { playerName: 'Player' });
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Helper function to check for matches
async function checkForMatches(gameType: string, matchType: 'casual' | 'ranked') {
  try {
    // Process the queue to find matches
    await MatchmakingService.processQueue(gameType, matchType);
    
    // Check if any matches were created
    const queueStatus = await MatchmakingService.getQueueStatus(gameType);
    console.log(`Queue status for ${gameType} ${matchType}:`, queueStatus);
    
    // If there are still players in queue, schedule another check
    if (queueStatus.playersInQueue > 0) {
      setTimeout(() => checkForMatches(gameType, matchType), 5000);
    }
  } catch (error) {
    console.error('Error checking for matches:', error);
  }
}

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
  
  server.listen(PORT, () => {
    console.log(`🚀 PUGG Backend server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth routes: http://localhost:${PORT}/api/auth/*`);
    console.log(`🎮 Game routes: http://localhost:${PORT}/api/games/*`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 CORS enabled for: localhost:3000, localhost:5173`);
    console.log(`💾 Database: ${dbConnected ? 'Connected' : 'Disconnected (dev mode)'}`);
    console.log(`🔌 WebSocket server ready`);
  });
};

startServer();

export default app;
