import express, { Request, Response } from 'express';
import { pool } from '../config/database';

const router = express.Router();

// Get all available game types
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
      data: fallbackData
    });
  }
});

// Create game room (placeholder)
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { gameType, matchType = 'casual' } = req.body;
    
    // Generate a simple room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const sessionId = `session_${Date.now()}`;
    
    res.status(201).json({
      success: true,
      data: {
        sessionId,
        roomCode,
        gameType,
        matchType,
        status: 'waiting',
        maxPlayers: 2
      }
    });
  } catch (error: any) {
    console.error('Error creating game room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create game room'
    });
  }
});

// Join game room (placeholder)
router.post('/join', async (req: Request, res: Response) => {
  try {
    const { roomCode } = req.body;
    
    // For now, just return success
    res.json({
      success: true,
      data: {
        sessionId: `session_${Date.now()}`,
        roomCode,
        gameType: 'tictactoe',
        status: 'waiting',
        playerOrder: 2
      }
    });
  } catch (error: any) {
    console.error('Error joining game room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join game room'
    });
  }
});

export default router;
