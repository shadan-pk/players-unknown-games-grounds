// import express, { Request, Response } from 'express';
// import { GameTypeModel } from '../models/GameType';
// import { GameSessionModel } from '../models/GameSession';
// import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

// const router = express.Router();

// // Get all available game types
// router.get('/types', async (req: Request, res: Response) => {
//   try {
//     const gameTypes = await GameTypeModel.getAllActive();
//     res.json({
//       success: true,
//       data: gameTypes
//     });
//   } catch (error: any) {
//     console.error('Error fetching game types:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to fetch game types',
//       message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
//     });
//   }
// });

// // Get specific game type details
// router.get('/types/:id', async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;
//     const gameType = await GameTypeModel.getById(id);
    
//     if (!gameType) {
//       return res.status(404).json({
//         success: false,
//         error: 'Game type not found'
//       });
//     }

//     const configurations = await GameTypeModel.getConfigurations(id);
    
//     res.json({
//       success: true,
//       data: {
//         ...gameType,
//         configurations
//       }
//     });
//   } catch (error: any) {
//     console.error('Error fetching game type:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to fetch game type details',
//       message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
//     });
//   }
// });

// // Search game types
// router.get('/types/search', async (req: Request, res: Response) => {
//   try {
//     const { difficulty, tags, minPlayers, maxPlayers } = req.query;
    
//     const filters = {
//       difficulty: difficulty as string,
//       tags: tags ? (tags as string).split(',') : undefined,
//       minPlayers: minPlayers ? parseInt(minPlayers as string) : undefined,
//       maxPlayers: maxPlayers ? parseInt(maxPlayers as string) : undefined
//     };

//     const gameTypes = await GameTypeModel.search(filters);
    
//     res.json({
//       success: true,
//       data: gameTypes
//     });
//   } catch (error: any) {
//     console.error('Error searching game types:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to search game types',
//       message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
//     });
//   }
// });

// // Create game room
// router.post('/create', authenticateToken, async (req: AuthenticatedRequest, res) => {
//   try {
//     const { gameType } = req.body;
    
//     // Validate game type exists
//     const gameTypeData = await GameTypeModel.getById(gameType);
//     if (!gameTypeData) {
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid game type'
//       });
//     }
    
//     const session = await GameSessionModel.create(gameType, gameTypeData.max_players, req.user!.id);
//     await GameSessionModel.addPlayer(session.id, req.user!.id, 1);
    
//     res.status(201).json({
//       success: true,
//       data: {
//         sessionId: session.id,
//         roomCode: session.room_code,
//         gameType: session.game_type,
//         status: session.status,
//         maxPlayers: gameTypeData.max_players
//       }
//     });
//   } catch (error: any) {
//     console.error('Error creating game room:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to create game room',
//       message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
//     });
//   }
// });

// // Join game room
// router.post('/join', authenticateToken, async (req: AuthenticatedRequest, res) => {
//   try {
//     const { roomCode } = req.body;
    
//     const session = await GameSessionModel.findByRoomCode(roomCode);
//     if (!session) {
//       return res.status(404).json({
//         success: false,
//         error: 'Room not found'
//       });
//     }

//     if (session.status !== 'waiting') {
//       return res.status(400).json({
//         success: false,
//         error: 'Game already started or finished'
//       });
//     }

//     const players = await GameSessionModel.getPlayers(session.id);
//     if (players.length >= session.max_players) {
//       return res.status(400).json({
//         success: false,
//         error: 'Room is full'
//       });
//     }

//     // Check if user already in room
//     const existingPlayer = players.find(p => p.id === req.user!.id);
//     if (existingPlayer) {
//       return res.status(400).json({
//         success: false,
//         error: 'Already in this room'
//       });
//     }

//     const playerOrder = players.length + 1;
//     await GameSessionModel.addPlayer(session.id, req.user!.id, playerOrder);
    
//     res.json({
//       success: true,
//       data: {
//         sessionId: session.id,
//         roomCode: session.room_code,
//         gameType: session.game_type,
//         playerOrder
//       }
//     });
//   } catch (error: any) {
//     console.error('Error joining game room:', error);
//     res.status(500).json({
//       success: false,
//       error: 'Failed to join game room',
//       message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
//     });
//   }
// });

import express, { Request, Response } from 'express';
import { pool } from '../config/database';

const router = express.Router();

// Simplified route without the model for now
router.get('/types', async (req: Request, res: Response) => {
  try {
    console.log('Fetching game types from database...');
    
    // Direct database query for now
    const query = `
      SELECT * FROM game_types 
      WHERE is_active = true 
      ORDER BY difficulty_level ASC, name ASC
    `;
    
    const result = await pool.query(query);
    console.log('Found games:', result.rows);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    console.error('Error fetching game types:', error);
    
    // Return fallback data if database fails
    const fallbackData = [
      {
        id: 'tictactoe',
        name: 'Tic Tac Toe',
        description: 'Classic 3x3 grid game where you try to get three in a row',
        min_players: 2,
        max_players: 2,
        estimated_duration: '00:03:00',
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
        estimated_duration: '00:15:00',
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
        estimated_duration: '00:30:00',
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
      data: fallbackData,
      message: 'Using fallback data - database connection issues'
    });
  }
});

// Test route
router.get('/test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Game routes are working!'
  });
});

export default router;
