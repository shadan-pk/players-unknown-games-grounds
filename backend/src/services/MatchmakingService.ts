import { pool, redis } from '../config/database';
import { Server } from 'socket.io';

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
  socket_id?: string;
}

export interface MatchResult {
  session_id: string;
  players: QueueEntry[];
  room_code: string;
}

export class MatchmakingService {
  private static io: Server | null = null; // To hold the io instance
  private static readonly ELO_THRESHOLD = 100;
  private static readonly QUEUE_TIMEOUT = 300000; // 5 minutes
  private static readonly EXPANSION_INTERVAL = 30000; // 30s
  private static activeMatches = new Map<string, any>();
  private static queueIntervals = new Map<string, NodeJS.Timeout>();

  // Initialize the service with the Socket.IO server instance
  static init(ioInstance: Server): void {
    this.io = ioInstance;
    console.log('[MATCHMAKING] Service initialized.');
  }

  // Add player to matchmaking queue
  static async addToQueue(
    userId: string,
    gameType: string,
    matchType: 'casual' | 'ranked' = 'casual',
    socketId: string,
    preferences: any = {}
  ): Promise<void> {
    try {
      console.log(`[QUEUE] Adding player ${userId} to ${gameType} ${matchType} queue`);
      
      const userStats = await this.getUserStats(userId);
      const eloRating = matchType === 'ranked' ? (userStats?.elo_rating || 1000) : 1000;

      await this.removeFromAllQueues(userId);

      const query = `
        INSERT INTO matchmaking_queue (user_id, game_type, match_type, elo_rating, preferences, region)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      await pool.query(query, [userId, gameType, matchType, eloRating, JSON.stringify(preferences), 'global']);
      await redis.setEx(`socket:${userId}`, 300, socketId);
      
      console.log(`[QUEUE] Successfully added player ${userId} with ELO ${eloRating}`);

      const queueKey = `${gameType}:${matchType}`;
      if (!this.queueIntervals.has(queueKey)) {
        const interval = setInterval(() => {
          // No longer need to pass 'io', it's accessed via this.io
          this.processQueue(gameType, matchType); 
        }, 5000); 
        this.queueIntervals.set(queueKey, interval);
        console.log(`[QUEUE] Started matchmaking interval for ${queueKey}`);
      }
      
    } catch (error) {
      console.error('[QUEUE] Error adding to queue:', error);
      throw error;
    }
  }

  // Remove player from all queues
  static async removeFromAllQueues(userId: string): Promise<void> {
    try {
      const result = await pool.query('DELETE FROM matchmaking_queue WHERE user_id = $1', [userId]);
      if ((result.rowCount ?? 0) > 0) {
        console.log(`[QUEUE] Removed player ${userId} from all queues`);
      }
    } catch (error) {
      console.error('[QUEUE] Error removing from all queues:', error);
    }
  }

  // Get queued players with verification
  private static async getQueuedPlayers(gameType: string, matchType: string): Promise<QueueEntry[]> {
    try {
      const query = `
        SELECT mq.*, u.username 
        FROM matchmaking_queue mq
        JOIN users u ON mq.user_id = u.id
        WHERE mq.game_type = $1 AND mq.match_type = $2
        ORDER BY mq.joined_at ASC
      `;
      const result = await pool.query(query, [gameType, matchType]);
      const players = result.rows;
      
      const verifiedPlayers = [];
      for (const player of players) {
        if (await redis.get(`socket:${player.user_id}`)) {
          verifiedPlayers.push(player);
        } else {
          console.log(`[QUEUE] Player ${player.username} has no active socket, removing.`);
          await this.removeFromAllQueues(player.user_id);
        }
      }
      return verifiedPlayers;
    } catch (error) {
      console.error('[QUEUE] Error getting queued players:', error);
      return [];
    }
  }

  // Process queue to create matches
  static async processQueue(gameType: string, matchType: 'casual' | 'ranked'): Promise<void> {
    if (!this.io) {
      console.error('[MATCHMAKING] Service not initialized. Cannot send notifications.');
      return;
    }
    
    try {
      const gameConfig = await this.getGameConfig(gameType);
      if (!gameConfig) return;

      const requiredPlayers = gameConfig.max_players || 2;
      const queuedPlayers = await this.getQueuedPlayers(gameType, matchType);
      
      if (queuedPlayers.length < requiredPlayers) return;

      const matches = this.findMatches(queuedPlayers, requiredPlayers, matchType);
      if (matches.length === 0) return;

      for (const match of matches) {
        // Step 1: Create the match session object
        const matchResult = await this.createMatch(match);
        console.log(`[MATCHMAKING] Match created successfully: ${matchResult.room_code}`);

        // Step 2: Notify players via sockets
        for (const player of match) {
          const socketId = await redis.get(`socket:${player.user_id}`);
          if (socketId && this.io) {
            const payload = {
              sessionId: matchResult.session_id,
              roomCode: matchResult.room_code,
              gameType,
              matchType,
              players: match.map(p => ({ id: p.user_id, username: p.username, elo: p.elo_rating })),
            };
            this.io.to(socketId).emit('match-found', payload);
            this.io.to(socketId).emit('match-accepted', payload);
          }
        }
        
        // Step 3 (THE FIX): After all notifications, remove players from the queue
        console.log(`[MATCHMAKING] Removing matched players from queue for match ${matchResult.room_code}`);
        for (const player of match) {
          await this.removeFromAllQueues(player.user_id);
        }
      }

      const remainingPlayers = await this.getQueuedPlayers(gameType, matchType);
      if (remainingPlayers.length < requiredPlayers) {
        const queueKey = `${gameType}:${matchType}`;
        const interval = this.queueIntervals.get(queueKey);
        if (interval) {
          clearInterval(interval);
          this.queueIntervals.delete(queueKey);
          console.log(`[MATCHMAKING] Stopped interval for ${queueKey}`);
        }
      }
    } catch (error) {
      console.error('[MATCHMAKING] Error processing queue:', error);
    }
  }

  // Find suitable matches
  private static findMatches(players: QueueEntry[], requiredPlayers: number, matchType: string): QueueEntry[][] {
    const matches: QueueEntry[][] = [];
    const usedPlayers = new Set<string>();
    const sortedPlayers = players.sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

    for (const player of sortedPlayers) {
      if (usedPlayers.has(player.user_id)) continue;

      const match = [player];
      usedPlayers.add(player.user_id);

      for (const opponent of sortedPlayers) {
        if (usedPlayers.has(opponent.user_id) || match.length >= requiredPlayers) break;
        if (this.isGoodMatch(player, opponent, matchType)) {
          match.push(opponent);
          usedPlayers.add(opponent.user_id);
        }
      }

      if (match.length === requiredPlayers) {
        matches.push(match);
        console.log(`[MATCHMAKING] Found match: ${match.map(p => p.username).join(' vs ')}`);
      } else {
        match.forEach(p => usedPlayers.delete(p.user_id));
      }
    }
    return matches;
  }

  // Check if two players are a good match
  private static isGoodMatch(player1: QueueEntry, player2: QueueEntry, matchType: string): boolean {
    if (matchType === 'casual') return true;
    const eloDiff = Math.abs(player1.elo_rating - player2.elo_rating);
    const waitTime = Date.now() - new Date(player1.joined_at).getTime();
    const expandedThreshold = this.ELO_THRESHOLD + Math.floor(waitTime / this.EXPANSION_INTERVAL) * 50;
    return eloDiff <= expandedThreshold;
  }

  // Get queue status
  static async getQueueStatus(gameType: string, matchType: 'casual' | 'ranked' = 'casual'): Promise<any> {
    const query = `
      SELECT COUNT(*) as players_in_queue, AVG(elo_rating)::INTEGER as average_elo
      FROM matchmaking_queue WHERE game_type = $1 AND match_type = $2
    `;
    const result = await pool.query(query, [gameType, matchType]);
    const row = result.rows[0];
    return {
      gameType,
      matchType,
      playersInQueue: parseInt(row.players_in_queue) || 0,
      averageElo: parseInt(row.average_elo) || 1000,
    };
  }

  // Create match object (does not modify queue)
  private static async createMatch(players: QueueEntry[]): Promise<MatchResult> {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    return {
      session_id: `session_${Date.now()}`,
      players,
      room_code: roomCode,
    };
  }

  // Get user stats
  private static async getUserStats(userId: string): Promise<any> {
    try {
      const result = await pool.query('SELECT * FROM user_statistics WHERE user_id = $1', [userId]);
      return result.rows[0];
    } catch (error) {
      console.error('[QUEUE] Error getting user stats:', error);
      return null;
    }
  }

  // Get game config
  private static async getGameConfig(gameType: string): Promise<any> {
    try {
      const result = await pool.query('SELECT * FROM game_types WHERE id = $1', [gameType]);
      return result.rows[0];
    } catch (error) {
      console.error(`[QUEUE] Error getting game config for ${gameType}:`, error);
      if (gameType === 'tictactoe' || gameType === 'checkers') {
        return { id: gameType, max_players: 2, min_players: 2 };
      }
      return null;
    }
  }

  // Cleanup old entries and intervals
  static cleanup(): void {
    for (const [key, interval] of this.queueIntervals.entries()) {
      clearInterval(interval);
      console.log(`[CLEANUP] Cleared matchmaking interval for ${key}`);
    }
    this.queueIntervals.clear();
  }
}