import { pool } from '../config/database';

export interface GameType {
  id: string;
  name: string;
  description: string;
  min_players: number;
  max_players: number;
  estimated_duration: string;
  difficulty_level: 'easy' | 'medium' | 'hard';
  is_active: boolean;
  icon?: string;
  rules?: string;
  tags?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface GameConfiguration {
  game_type_id: string;
  config_key: string;
  config_value: any;
  description?: string;
}

export class GameTypeModel {
  // Get all active game types
  static async getAllActive(): Promise<GameType[]> {
    const query = `
      SELECT * FROM game_types 
      WHERE is_active = true 
      ORDER BY difficulty_level ASC, name ASC
    `;
    
    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error fetching game types:', error);
      throw new Error('Failed to fetch game types');
    }
  }

  // Get game type by ID
  static async getById(id: string): Promise<GameType | null> {
    const query = 'SELECT * FROM game_types WHERE id = $1 AND is_active = true';
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error fetching game type:', error);
      return null;
    }
  }

  // Get game configurations
  static async getConfigurations(gameTypeId: string): Promise<Record<string, any>> {
    const query = 'SELECT config_key, config_value FROM game_configurations WHERE game_type_id = $1';
    
    try {
      const result = await pool.query(query, [gameTypeId]);
      const configurations: Record<string, any> = {};
      
      result.rows.forEach(row => {
        configurations[row.config_key] = row.config_value;
      });
      
      return configurations;
    } catch (error) {
      console.error('Error fetching game configurations:', error);
      return {};
    }
  }

  // Create new game type (for adding new games)
  static async create(gameType: Partial<GameType>): Promise<GameType> {
    const query = `
      INSERT INTO game_types (
        id, name, description, min_players, max_players, 
        estimated_duration, difficulty_level, icon, rules, tags
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [
        gameType.id,
        gameType.name,
        gameType.description,
        gameType.min_players || 2,
        gameType.max_players || 2,
        gameType.estimated_duration || '5 minutes',
        gameType.difficulty_level || 'medium',
        gameType.icon,
        gameType.rules,
        gameType.tags || []
      ]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating game type:', error);
      throw new Error('Failed to create game type');
    }
  }

  // Search game types
  static async search(filters: {
    difficulty?: string;
    tags?: string[];
    minPlayers?: number;
    maxPlayers?: number;
  }): Promise<GameType[]> {
    let query = 'SELECT * FROM game_types WHERE is_active = true';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.difficulty) {
      query += ` AND difficulty_level = $${paramIndex}`;
      params.push(filters.difficulty);
      paramIndex++;
    }

    if (filters.tags && filters.tags.length > 0) {
      query += ` AND tags && $${paramIndex}`;
      params.push(filters.tags);
      paramIndex++;
    }

    if (filters.minPlayers) {
      query += ` AND max_players >= $${paramIndex}`;
      params.push(filters.minPlayers);
      paramIndex++;
    }

    if (filters.maxPlayers) {
      query += ` AND min_players <= $${paramIndex}`;
      params.push(filters.maxPlayers);
      paramIndex++;
    }

    query += ' ORDER BY name ASC';

    try {
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error searching game types:', error);
      throw new Error('Failed to search game types');
    }
  }
}
