import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

export interface GameSession {
  id: string;
  room_code: string;
  game_type: string;
  status: 'waiting' | 'playing' | 'finished';
  max_players: number;
  created_at: Date;
  started_at?: Date;
  finished_at?: Date;
  winner_id?: string;
}

export class GameSessionModel {
  static async create(gameType: string, maxPlayers: number): Promise<GameSession> {
    const roomCode = this.generateRoomCode();
    
    const query = `
      INSERT INTO game_sessions (room_code, game_type, max_players)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    const result = await pool.query(query, [roomCode, gameType, maxPlayers]);
    return result.rows[0];
  }

  static async findByRoomCode(roomCode: string): Promise<GameSession | null> {
    const query = 'SELECT * FROM game_sessions WHERE room_code = $1';
    const result = await pool.query(query, [roomCode]);
    return result.rows[0] || null;
  }

  static async addPlayer(sessionId: string, userId: string, playerOrder: number): Promise<void> {
    const query = `
      INSERT INTO game_participants (session_id, user_id, player_order)
      VALUES ($1, $2, $3)
    `;
    await pool.query(query, [sessionId, userId, playerOrder]);
  }

  static async getPlayers(sessionId: string): Promise<any[]> {
    const query = `
      SELECT u.id, u.username, gp.player_order, gp.joined_at
      FROM game_participants gp
      JOIN users u ON gp.user_id = u.id
      WHERE gp.session_id = $1
      ORDER BY gp.player_order
    `;
    const result = await pool.query(query, [sessionId]);
    return result.rows;
  }

  static async updateStatus(sessionId: string, status: string): Promise<void> {
    const query = 'UPDATE game_sessions SET status = $1 WHERE id = $2';
    await pool.query(query, [status, sessionId]);
  }

  private static generateRoomCode(): string {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  }
}
