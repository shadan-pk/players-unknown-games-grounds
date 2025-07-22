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
  private static readonly ELO_THRESHOLD = 100;
  private static readonly QUEUE_TIMEOUT = 300000; // 5 minutes
  private static readonly EXPANSION_INTERVAL = 30000; // 30s
  private static activeMatches = new Map<string, any>();
  private static queueIntervals = new Map<string, NodeJS.Timeout>();

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
      
      // Get user's current ELO from database
      const userStats = await this.getUserStats(userId);
      const eloRating = matchType === 'ranked' ? (userStats?.elo_rating || 1000) : 1000;

      // Remove from existing queues first to prevent duplicates
      await this.removeFromAllQueues(userId);

      // Add to database queue
      const query = `
        INSERT INTO matchmaking_queue (user_id, game_type, match_type, elo_rating, preferences, region)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await pool.query(query, [
        userId, 
        gameType, 
        matchType, 
        eloRating, 
        JSON.stringify(preferences),
        'global'
      ]);

      // Store socket ID in Redis with expiration
      await redis.setEx(`socket:${userId}`, 300, socketId);
      console.log(`[SOCKET DEBUG] Set socket:${userId} = ${socketId}`);
      
      console.log(`[QUEUE] Successfully added player ${userId} with ELO ${eloRating}`);
      
      // Verify the addition by checking current queue
      const currentQueue = await this.getQueuedPlayers(gameType, matchType);
      console.log(`[QUEUE] Current ${gameType} ${matchType} queue has ${currentQueue.length} players:`, 
        currentQueue.map(p => `${p.username}(${p.user_id})`));

      // Start or continue matchmaking process for this game type and match type
      const queueKey = `${gameType}:${matchType}`;
      if (!this.queueIntervals.has(queueKey)) {
        const interval = setInterval(() => {
      this.processQueue(null, gameType, matchType); // Pass null for io as it's not static
        }, 5000); // Check every 5 seconds
        this.queueIntervals.set(queueKey, interval);
        console.log(`[QUEUE] Started matchmaking interval for ${queueKey}`);
      }
      
    } catch (error) {
      console.error('[QUEUE] Error adding to queue:', error);
      throw error;
    }
  }

  // Remove player from specific queue
  static async removeFromQueue(userId: string, gameType: string): Promise<void> {
    try {
      console.log(`[QUEUE] Removing player ${userId} from ${gameType} queue`);
      
      const result = await pool.query(
        'DELETE FROM matchmaking_queue WHERE user_id = $1 AND game_type = $2', 
        [userId, gameType]
      );
      
      // Do NOT delete the socket key here
      console.log(`[QUEUE] Removed ${result.rowCount || 0} entries for player ${userId}`);
    } catch (error) {
      console.error('[QUEUE] Error removing from queue:', error);
    }
  }

  // Remove from all queues
  static async removeFromAllQueues(userId: string): Promise<void> {
    try {
      console.log(`[QUEUE] Removing player ${userId} from all queues`);
      
      const result = await pool.query(
        'DELETE FROM matchmaking_queue WHERE user_id = $1', 
        [userId]
      );
      
      // Do NOT delete the socket key here
      console.log(`[QUEUE] Removed ${result.rowCount || 0} total queue entries for player ${userId}`);
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
      
      console.log(`[QUEUE] Raw database query returned ${players.length} players for ${gameType} ${matchType}`);
      
      // Verify each player still has an active socket connection
      const verifiedPlayers = [];
      for (const player of players) {
        const socketId = await redis.get(`socket:${player.user_id}`);
        if (socketId) {
          player.socket_id = socketId;
          verifiedPlayers.push(player);
          console.log(`[QUEUE] Verified player ${player.username} (${player.user_id}) with socket ${socketId}`);
        } else {
          console.log(`[QUEUE] Player ${player.username} (${player.user_id}) has no active socket, removing from queue`);
          // Remove disconnected player from queue
          await this.removeFromAllQueues(player.user_id);
        }
      }
      
      console.log(`[QUEUE] Final verified players: ${verifiedPlayers.length}`);
      return verifiedPlayers;
      
    } catch (error) {
      console.error('[QUEUE] Error getting queued players:', error);
      return [];
    }
  }

  // Process queue only when enough players
  static async processQueue(io: Server | null, gameType: string, matchType: 'casual' | 'ranked'): Promise<void> {
    try {
      console.log(`[MATCHMAKING] Processing queue for ${gameType} ${matchType}`);
      
      const gameConfig = await this.getGameConfig(gameType);
      if (!gameConfig) {
        console.error(`[MATCHMAKING] Game config not found for ${gameType}`);
        return;
      }

      const requiredPlayers = gameConfig.max_players || 2;
      const queuedPlayers = await this.getQueuedPlayers(gameType, matchType);
      
      console.log(`[MATCHMAKING] Need ${requiredPlayers} players, have ${queuedPlayers.length}`);
      
      if (queuedPlayers.length < requiredPlayers) {
        console.log(`[MATCHMAKING] Not enough players for match`);
        return;
      }

      // Find matches - only create match if we have exactly the required number of players
      const matches = this.findMatches(queuedPlayers, requiredPlayers, matchType);
      
      if (matches.length === 0) {
        console.log(`[MATCHMAKING] No suitable matches found`);
        return;
      }

      // Create matches
      for (const match of matches) {
        const matchResult = await this.createMatch(match, gameType, matchType);
        console.log(`[MATCHMAKING] Match created successfully: ${matchResult.room_code}`);

        // Log socket IDs and usernames for all players in the match
        for (const player of match) {
          const socketId = await redis.get(`socket:${player.user_id}`);
          console.log(`[SOCKET DEBUG] Player: ${player.username}, UserID: ${player.user_id}, SocketID: ${socketId}`);
        }

        for (const player of match) {
          const socketId = await redis.get(`socket:${player.user_id}`);
          if (socketId && io) {
            // Emit match-found
            io.to(socketId).emit('match-found', {
              sessionId: matchResult.session_id,
              roomCode: matchResult.room_code,
              gameType,
              matchType,
              players: match.map(p => ({ id: p.user_id, username: p.username, elo: p.elo_rating })),
            });
            // Immediately emit match-accepted (auto-accept)
            console.log(`[SOCKET EMIT] Emitting match-accepted to ${player.username} on socket ${socketId}`);
            io.to(socketId).emit('match-accepted', {
              sessionId: matchResult.session_id,
              roomCode: matchResult.room_code,
              gameType,
              matchType,
              players: match.map(p => ({ id: p.user_id, username: p.username, elo: p.elo_rating })),
            });
          }
        }
      }

      // If queue is now empty, stop the interval
      const remainingPlayers = await this.getQueuedPlayers(gameType, matchType);
      if (remainingPlayers.length < requiredPlayers) {
        const queueKey = `${gameType}:${matchType}`;
        const interval = this.queueIntervals.get(queueKey);
        if (interval) {
          clearInterval(interval);
          this.queueIntervals.delete(queueKey);
          console.log(`[MATCHMAKING] Stopped interval for ${queueKey} - insufficient players`);
        }
      }
      
    } catch (error) {
      console.error('[MATCHMAKING] Error processing queue:', error);
    }
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

      // Only create match if we have EXACTLY the required number of players
      if (match.length === requiredPlayers) {
        matches.push(match);
        console.log(`[MATCHMAKING] Found match for ${match.map(p => p.username).join(' vs ')}`);
      } else {
        // Return players to available pool
        match.forEach(p => usedPlayers.delete(p.user_id));
      }
    }

    return matches;
  }

  // Check if two players are a good match
  private static isGoodMatch(player1: QueueEntry, player2: QueueEntry, matchType: string): boolean {
    // Always allow casual matches
    if (matchType === 'casual') return true;

    // For ranked matches, check ELO difference
    const eloDiff = Math.abs(player1.elo_rating - player2.elo_rating);
    const waitTime = Date.now() - new Date(player1.joined_at).getTime();
    
    // Expand ELO threshold based on wait time
    const expandedThreshold = this.ELO_THRESHOLD + Math.floor(waitTime / this.EXPANSION_INTERVAL) * 50;
    
    return eloDiff <= expandedThreshold;
  }

  // Get queue status with real data
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
      estimatedWaitTime: Math.max(30, Math.ceil((parseFloat(row.average_wait_seconds) || 0) * 1.5)),
      isInQueue: true
    };
  }

  // Create match
  private static async createMatch(players: QueueEntry[], gameType: string, matchType: string): Promise<MatchResult> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Generate room code
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // For now, just remove players from queue since we don't have full game_sessions table
      for (const player of players) {
        await this.removeFromAllQueues(player.user_id);
      }

      await client.query('COMMIT');

      return {
        session_id: `session_${Date.now()}`,
        players,
        room_code: roomCode
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get user stats
  private static async getUserStats(userId: string): Promise<any> {
    try {
    const query = 'SELECT * FROM user_statistics WHERE user_id = $1';
    const result = await pool.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      console.error('[QUEUE] Error getting user stats:', error);
      return null;
    }
  }

  // Get game config
  private static async getGameConfig(gameType: string): Promise<any> {
    try {
    const query = 'SELECT * FROM game_types WHERE id = $1';
    const result = await pool.query(query, [gameType]);
    return result.rows[0];
    } catch (error) {
      console.error('[QUEUE] Error getting game config:', error);
      // Return fallback config for known games
      if (gameType === 'tictactoe' || gameType === 'checkers') {
        return { id: gameType, max_players: 2, min_players: 2 };
      }
      return null;
    }
  }

  // Clean up old entries
  static async cleanupQueue(): Promise<void> {
    try {
      const result = await pool.query(`
      DELETE FROM matchmaking_queue 
      WHERE joined_at < NOW() - INTERVAL '${this.QUEUE_TIMEOUT / 1000} seconds'
      `);
    
    if (result.rowCount && result.rowCount > 0) {
        console.log(`[CLEANUP] Removed ${result.rowCount} old queue entries`);
      }
    } catch (error) {
      console.error('[CLEANUP] Error during cleanup:', error);
    }
  }

  // Cleanup intervals on shutdown
  static cleanup(): void {
    for (const [key, interval] of this.queueIntervals.entries()) {
      clearInterval(interval);
      console.log(`[CLEANUP] Cleared matchmaking interval for ${key}`);
    }
    this.queueIntervals.clear();
  }

  // Get active matches
  static getActiveMatch(sessionId: string): any {
    return this.activeMatches.get(sessionId);
  }

  // Remove active match
  static removeActiveMatch(sessionId: string): void {
    this.activeMatches.delete(sessionId);
  }
}
