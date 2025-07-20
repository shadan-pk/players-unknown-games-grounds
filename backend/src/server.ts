import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { initializeDatabase, pool, redis } from './config/database';
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

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Store connected users and their socket info
const connectedUsers = new Map<string, { socketId: string, userId: string, username: string }>();
const userSockets = new Map<string, string>(); // userId -> socketId

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
    environment: process.env.NODE_ENV || 'development',
    connectedUsers: connectedUsers.size
  });
});

// Game types endpoint
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

// Debug endpoints
app.get('/debug/queue/:gameType/:matchType?', async (req: Request, res: Response) => {
  try {
    const { gameType, matchType = 'casual' } = req.params;
    
    console.log(`[DEBUG] Checking queue for ${gameType} ${matchType}`);
    
    // Get raw database data
    const dbQuery = `
      SELECT mq.*, u.username 
      FROM matchmaking_queue mq
      LEFT JOIN users u ON mq.user_id = u.id
      WHERE mq.game_type = $1 AND mq.match_type = $2
      ORDER BY mq.joined_at ASC
    `;
    const dbResult = await pool.query(dbQuery, [gameType, matchType]);
    
    // Get Redis data
    const redisKeys = await redis.keys('queue:*');
    const redisData: any = {};
    for (const key of redisKeys) {
      const value = await redis.get(key);
      redisData[key] = value;
    }
    
    // Get service status
    const queueStatus = await MatchmakingService.getQueueStatus(gameType, matchType as 'casual' | 'ranked');
    
    res.json({
      gameType,
      matchType,
      serviceStatus: queueStatus,
      databaseEntries: dbResult.rows,
      redisData,
      connectedUsers: connectedUsers.size,
      connectedUsersList: Array.from(connectedUsers.values())
    });
    
  } catch (error) {
    console.error('[DEBUG] Queue check error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/debug/clear-queue', async (req: Request, res: Response) => {
  try {
    const dbResult = await pool.query('DELETE FROM matchmaking_queue');
    const redisKeys = await redis.keys('queue:*');
    if (redisKeys.length > 0) {
      await redis.del(redisKeys);
    }
    
    console.log('[DEBUG] Queue cleared - DB entries:', dbResult.rowCount, 'Redis keys:', redisKeys.length);
    
    res.json({ 
      message: 'All queue data cleared',
      databaseEntriesRemoved: dbResult.rowCount || 0,
      redisKeysRemoved: redisKeys.length
    });
  } catch (error) {
    console.error('[DEBUG] Clear queue error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Test endpoint to add user to queue manually
app.post('/debug/add-user-to-queue', async (req: Request, res: Response) => {
  try {
    const userId = '3fbb039b-5446-40cf-a02e-a073a6f99332'; // Your user ID
    const gameType = 'tictactoe';
    const matchType = 'casual';
    
    console.log(`[DEBUG] Manually adding user ${userId} to queue`);
    
    await MatchmakingService.addToQueue(userId, gameType, matchType, 'debug-socket-123');
    const status = await MatchmakingService.getQueueStatus(gameType, matchType);
    
    res.json({
      message: 'User added to queue',
      status
    });
  } catch (error) {
    console.error('[DEBUG] Error adding user:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);

// Socket.IO connection handling with proper authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const userId = decoded.userId;

    // Store user info in socket
    socket.data = { userId, username: decoded.username };
    
    next();
  } catch (err) {
    next(new Error('Authentication error: Invalid token'));
  }
});

io.on('connection', (socket) => {
  const { userId, username } = socket.data;
  
  console.log(`[SOCKET] User ${username} (${userId}) connected: ${socket.id}`);
  
  // Store connection info
  connectedUsers.set(socket.id, { socketId: socket.id, userId, username });
  userSockets.set(userId, socket.id);

  socket.emit('authenticated', { 
    success: true, 
    user: { id: userId, username },
    message: 'Connected to PUGG servers'
  });

  // Matchmaking events
  socket.on('join-queue', async (data) => {
    console.log(`[SOCKET] ${username} (${userId}) joining queue:`, data);
    const { gameType, matchType = 'casual' } = data;
    
    try {
      // Check queue status before adding
      const beforeStatus = await MatchmakingService.getQueueStatus(gameType, matchType);
      console.log(`[SOCKET] Queue status BEFORE adding ${username}:`, beforeStatus);
      
      // Add player to matchmaking queue with their socket ID
      await MatchmakingService.addToQueue(userId, gameType, matchType, socket.id);
      
      // Get updated queue status
      const queueStatus = await MatchmakingService.getQueueStatus(gameType, matchType);
      console.log(`[SOCKET] Queue status AFTER adding ${username}:`, queueStatus);
      
      socket.emit('queue-joined', {
        gameType,
        matchType,
        status: queueStatus,
        estimatedWaitTime: queueStatus.estimatedWaitTime
      });
      
      console.log(`[SOCKET] ${username} added to ${gameType} ${matchType} queue - Total players: ${queueStatus.playersInQueue}`);
      
      // Send periodic queue updates
      const updateInterval = setInterval(async () => {
        try {
          const updatedStatus = await MatchmakingService.getQueueStatus(gameType, matchType);
          socket.emit('queue-status-update', updatedStatus);
          
          // Try to process queue for matches if we have enough players
          if (updatedStatus.playersInQueue >= 2) {
            console.log(`[MATCHMAKING] Attempting to create match - ${updatedStatus.playersInQueue} players in queue`);
            await MatchmakingService.processQueue(gameType, matchType);
          }
        } catch (error) {
          console.error('[SOCKET] Error updating queue status:', error);
        }
      }, 5000); // Update every 5 seconds
      
      // Store interval to clear later
      socket.data.queueUpdateInterval = updateInterval;
      
    } catch (error) {
      console.error('[SOCKET] Error joining queue:', error);
      socket.emit('error', { message: 'Failed to join queue: ' + (error instanceof Error ? error.message : 'Unknown error') });
    }
  });

  socket.on('leave-queue', async () => {
    console.log(`[SOCKET] ${username} leaving queue`);
    try {
      await MatchmakingService.removeFromAllQueues(userId);
      socket.emit('queue-left');
      
      // Clear queue update interval
      if (socket.data.queueUpdateInterval) {
        clearInterval(socket.data.queueUpdateInterval);
        delete socket.data.queueUpdateInterval;
      }
    } catch (error) {
      console.error('[SOCKET] Error leaving queue:', error);
    }
  });

  socket.on('accept-match', async () => {
    console.log(`[SOCKET] ${username} accepted match`);
    socket.emit('match-accepted', {
      sessionId: `session_${Date.now()}`,
      roomCode: 'ABC123',
      gameType: 'tictactoe',
      players: [
        { id: userId, username: username, elo: 1200 }
      ],
      matchType: 'casual'
    });
  });

  // Handle disconnect
  socket.on('disconnect', async (reason) => {
    console.log(`[SOCKET] User ${username} (${userId}) disconnected: ${reason}`);
    
    // Remove from queue if they were in one
    try {
      await MatchmakingService.removeFromAllQueues(userId);
    } catch (error) {
      console.error('[SOCKET] Error removing user from queue on disconnect:', error);
    }
    
    // Clean up intervals
    if (socket.data.queueUpdateInterval) {
      clearInterval(socket.data.queueUpdateInterval);
    }
    
    // Remove from connection maps
    connectedUsers.delete(socket.id);
    userSockets.delete(userId);
  });
});

// Periodic cleanup of old queue entries
setInterval(async () => {
  try {
    await MatchmakingService.cleanupQueue();
  } catch (error) {
    console.error('[CLEANUP] Error during queue cleanup:', error);
  }
}, 60000); // Clean up every minute

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
      'GET /api/games/types',
      'GET /debug/queue/:gameType/:matchType?',
      'POST /debug/clear-queue',
      'POST /debug/add-user-to-queue'
    ]
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('[ERROR] Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, shutting down gracefully');
  MatchmakingService.cleanup();
  server.close(() => {
    console.log('[SERVER] Server closed');
    process.exit(0);
  });
});

// Test the matchmaking service on startup
const testMatchmakingService = async () => {
  try {
    const status = await MatchmakingService.getQueueStatus('tictactoe', 'casual');
    console.log('[STARTUP] ✅ MatchmakingService working, queue status:', status);
  } catch (error) {
    console.error('[STARTUP] ❌ MatchmakingService error:', error);
  }
};

// Start server
const startServer = async () => {
  const dbConnected = await initializeDatabase();
  
  if (dbConnected) {
    // Test the matchmaking service
    await testMatchmakingService();
  }
  
  server.listen(PORT, () => {
    console.log(`🚀 PUGG Backend server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth routes: http://localhost:${PORT}/api/auth/*`);
    console.log(`🎮 Game routes: http://localhost:${PORT}/api/games/*`);
    console.log(`🧪 Debug routes: http://localhost:${PORT}/debug/*`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 CORS enabled for: localhost:3000, localhost:5173`);
    console.log(`💾 Database: ${dbConnected ? 'Connected' : 'Disconnected (dev mode)'}`);
    console.log(`🔌 WebSocket server ready`);
  });
};

startServer();

export default app;
