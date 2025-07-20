import { pool, redis } from '../config/database';
import { GameFactory } from '../games/GameFactory';
import { EloRatingService } from './EloRatingService';

export interface QueueEntry {
  id: string;
  user_id: string;
  username: string;
  game_type: string;
  match_type: 'casual' | 'ranked';
  elo_rating: number;
  joined_at: Date;
  preferences: any;
  region: string;
}

export interface MatchResult {
  session_id: string;
  players: QueueEntry[];
  room_code: string;
}

export class MatchmakingService {
  private static readonly ELO_THRESHOLD = 100; // Max ELO difference for matching
  private static readonly QUEUE_TIMEOUT = 300000; // 5 minutes timeout
  private static readonly EXPANSION_INTERVAL = 30000; // Expand search every 30s

  // Add player to matchmaking queue
  static async addToQueue(
    userId: string, 
    gameType: string, 
    matchType: 'casual' | 'ranked' = 'casual',
    preferences: any = {}
  ): Promise<void> {
    try {
      // Get user's current ELO
      const userStats = await this.getUserStats(userId);
      const eloRating = matchType === 'ranked' ? userStats.elo_rating : 1000;

      // Remove from existing queues first
      await this.removeFromAllQueues(userId);

      // Add to queue
      const query = `
        INSERT INTO matchmaking_queue (user_id, game_type, match_type, elo_rating, preferences)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, game_type) 
        DO UPDATE SET match_type = $3, elo_rating = $4, preferences = $5, joined_at = NOW()
      `;
      
      await pool.query(query, [userId, gameType, matchType, eloRating, preferences]);

      // Start matchmaking process
      this.processQueue(gameType, matchType);
      
      console.log(`Player ${userId} added to ${gameType} ${matchType} queue with ELO ${eloRating}`);
    } catch (error) {
      console.error('Error adding to queue:', error);
      throw error;
    }
  }

  // Remove player from queue
  static async removeFromQueue(userId: string, gameType: string): Promise<void> {
    const query = 'DELETE FROM matchmaking_queue WHERE user_id = $1 AND game_type = $2';
    await pool.query(query, [userId, gameType]);
  }

  // Remove from all queues
  static async removeFromAllQueues(userId: string): Promise<void> {
    const query = 'DELETE FROM matchmaking_queue WHERE user_id = $1';
    await pool.query(query, [userId]);
  }

  // Process matchmaking queue
  static async processQueue(gameType: string, matchType: 'casual' | 'ranked'): Promise<void> {
    try {
      const gameConfig = await this.getGameConfig(gameType);
      const requiredPlayers = gameConfig.max_players;

      // Get players from queue
      const queuedPlayers = await this.getQueuedPlayers(gameType, matchType);
      
      if (queuedPlayers.length < requiredPlayers) {
        console.log(`Not enough players in ${gameType} ${matchType} queue: ${queuedPlayers.length}/${requiredPlayers}`);
        return;
      }

      // Find matches
      const matches = this.findMatches(queuedPlayers, requiredPlayers, matchType);
      
      // Create game sessions for matches
      for (const match of matches) {
        await this.createMatch(match, gameType, matchType);
      }

    } catch (error) {
      console.error('Error processing queue:', error);
    }
  }

  // Get queued players
  private static async getQueuedPlayers(gameType: string, matchType: string): Promise<QueueEntry[]> {
    const query = `
      SELECT mq.*, u.username 
      FROM matchmaking_queue mq
      JOIN users u ON mq.user_id = u.id
      WHERE mq.game_type = $1 AND mq.match_type = $2
      ORDER BY mq.joined_at ASC
    `;
    
    const result = await pool.query(query, [gameType, matchType]);
    return result.rows;
  }

  // Find suitable matches using ELO-based algorithm
  private static findMatches(players: QueueEntry[], requiredPlayers: number, matchType: string): QueueEntry[][] {
    const matches: QueueEntry[][] = [];
    const usedPlayers = new Set<string>();

    // Sort by wait time (older players get priority)
    const sortedPlayers = players.sort((a, b) => 
      new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    );

    for (const player of sortedPlayers) {
      if (usedPlayers.has(player.user_id)) continue;

      const match = [player];
      usedPlayers.add(player.user_id);

      // Find suitable opponents
      for (const opponent of sortedPlayers) {
        if (usedPlayers.has(opponent.user_id) || match.length >= requiredPlayers) break;

        if (this.isGoodMatch(player, opponent, matchType)) {
          match.push(opponent);
          usedPlayers.add(opponent.user_id);
        }
      }

      // If we have enough players, create a match
      if (match.length >= requiredPlayers) {
        matches.push(match.slice(0, requiredPlayers));
      } else {
        // Return players to available pool
        match.forEach(p => usedPlayers.delete(p.user_id));
      }
    }

    return matches;
  }

  // Check if two players are a good match
  private static isGoodMatch(player1: QueueEntry, player2: QueueEntry, matchType: string): boolean {
    if (matchType === 'casual') return true;

    // For ranked matches, check ELO difference
    const eloDiff = Math.abs(player1.elo_rating - player2.elo_rating);
    const waitTime = Date.now() - new Date(player1.joined_at).getTime();
    
    // Expand ELO threshold based on wait time
    const expandedThreshold = this.ELO_THRESHOLD + Math.floor(waitTime / this.EXPANSION_INTERVAL) * 50;
    
    return eloDiff <= expandedThreshold;
  }

  // Create a match from queue entries
  private static async createMatch(players: QueueEntry[], gameType: string, matchType: string): Promise<MatchResult> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create game session
      const sessionQuery = `
        INSERT INTO game_sessions (game_type, status, max_players, match_type, average_elo, created_by)
        VALUES ($1, 'starting', $2, $3, $4, $5)
        RETURNING id, room_code
      `;
      
      const averageElo = Math.round(players.reduce((sum, p) => sum + p.elo_rating, 0) / players.length);
      const sessionResult = await client.query(sessionQuery, [
        gameType, 
        players.length, 
        matchType, 
        averageElo,
        players[0].user_id
      ]);
      
      const session = sessionResult.rows[0];

      // Add players to session
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        await client.query(
          `INSERT INTO game_participants (session_id, user_id, player_order, elo_before)
           VALUES ($1, $2, $3, $4)`,
          [session.id, player.user_id, i + 1, player.elo_rating]
        );

        // Remove from queue
        await client.query(
          'DELETE FROM matchmaking_queue WHERE user_id = $1 AND game_type = $2',
          [player.user_id, gameType]
        );
      }

      await client.query('COMMIT');

      console.log(`Match created: ${session.room_code} for ${gameType} ${matchType} with ${players.length} players`);

      return {
        session_id: session.id,
        players,
        room_code: session.room_code
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get user statistics
  private static async getUserStats(userId: string): Promise<any> {
    const query = 'SELECT * FROM user_statistics WHERE user_id = $1';
    const result = await pool.query(query, [userId]);
    return result.rows[0] || { 
      user_id: userId, 
      elo_rating: 1000, 
      total_games: 0, 
      total_wins: 0 
    };
  }

  // Get game configuration
  private static async getGameConfig(gameType: string): Promise<any> {
    const query = 'SELECT * FROM game_types WHERE id = $1';
    const result = await pool.query(query, [gameType]);
    return result.rows[0];
  }

  // Get queue status
  static async getQueueStatus(gameType: string, matchType: 'casual' | 'ranked' = 'casual'): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as players_in_queue,
        AVG(elo_rating)::INTEGER as average_elo,
        MIN(joined_at) as oldest_wait,
        AVG(EXTRACT(EPOCH FROM (NOW() - joined_at))) as average_wait_seconds
      FROM matchmaking_queue 
      WHERE game_type = $1 AND match_type = $2
    `;
    
    const result = await pool.query(query, [gameType, matchType]);
    const row = result.rows[0];
    
    return {
      gameType,
      matchType,
      playersInQueue: parseInt(row.players_in_queue) || 0,
      averageElo: parseInt(row.average_elo) || 1000,
      estimatedWaitTime: Math.ceil((parseFloat(row.average_wait_seconds) || 30) + 30), // Add 30 seconds buffer
      isInQueue: true
    };
  }

  // Cleanup old queue entries
  static async cleanupQueue(): Promise<void> {
    const query = `
      DELETE FROM matchmaking_queue 
      WHERE joined_at < NOW() - INTERVAL '${this.QUEUE_TIMEOUT / 1000} seconds'
    `;
    
    const result = await pool.query(query);
    if (result.rowCount && result.rowCount > 0) {
      console.log(`Cleaned up ${result.rowCount} old queue entries`);
    }
  }
}
