import { pool } from '../config/database';

export interface GameResult {
  userId: string;
  result: 'win' | 'loss' | 'draw' | 'forfeit' | 'disconnect';
  eloBefore: number;
}

export class EloRatingService {
  private static readonly K_FACTOR = 32; // ELO K-factor
  private static readonly BASE_RATING = 1000;

  // Calculate new ELO ratings for match participants
  static calculateNewRatings(results: GameResult[]): Map<string, number> {
    const newRatings = new Map<string, number>();
    
    if (results.length === 2) {
      // 1v1 match
      const [player1, player2] = results;
      const expectedScore1 = this.getExpectedScore(player1.eloBefore, player2.eloBefore);
      const expectedScore2 = this.getExpectedScore(player2.eloBefore, player1.eloBefore);
      
      const actualScore1 = this.getActualScore(player1.result, player2.result);
      const actualScore2 = this.getActualScore(player2.result, player1.result);
      
      const newRating1 = Math.round(player1.eloBefore + this.K_FACTOR * (actualScore1 - expectedScore1));
      const newRating2 = Math.round(player2.eloBefore + this.K_FACTOR * (actualScore2 - expectedScore2));
      
      newRatings.set(player1.userId, Math.max(500, newRating1)); // Minimum rating of 500
      newRatings.set(player2.userId, Math.max(500, newRating2));
    } else {
      // Multi-player (future expansion)
      // For now, implement basic rating changes
      const winners = results.filter(r => r.result === 'win');
      const losers = results.filter(r => r.result === 'loss' || r.result === 'forfeit' || r.result === 'disconnect');
      
      winners.forEach(winner => {
        const change = Math.round(this.K_FACTOR * 0.6); // Reduced gain for multiplayer
        newRatings.set(winner.userId, Math.max(500, winner.eloBefore + change));
      });
      
      losers.forEach(loser => {
        const change = Math.round(this.K_FACTOR * 0.4); // Reduced loss for multiplayer
        newRatings.set(loser.userId, Math.max(500, loser.eloBefore - change));
      });
    }
    
    return newRatings;
  }

  // Get expected score using ELO formula
  private static getExpectedScore(playerRating: number, opponentRating: number): number {
    return 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  }

  // Convert game result to score
  private static getActualScore(playerResult: string, opponentResult: string): number {
    if (playerResult === 'win') return 1;
    if (playerResult === 'loss' || playerResult === 'forfeit' || playerResult === 'disconnect') return 0;
    if (playerResult === 'draw') return 0.5;
    return 0;
  }

  // Update player ratings in database
  static async updatePlayerRatings(sessionId: string, newRatings: Map<string, number>): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const [userId, newRating] of newRatings) {
        // Get current stats
        const currentStats = await client.query(
          'SELECT * FROM user_statistics WHERE user_id = $1',
          [userId]
        );
        
        if (currentStats.rows.length === 0) {
          // Create initial stats
          await client.query(
            `INSERT INTO user_statistics (user_id, elo_rating, peak_rating) 
             VALUES ($1, $2, $2)`,
            [userId, newRating]
          );
        } else {
          const stats = currentStats.rows[0];
          const peakRating = Math.max(stats.peak_rating, newRating);
          
          await client.query(
            `UPDATE user_statistics 
             SET elo_rating = $1, peak_rating = $2, updated_at = NOW()
             WHERE user_id = $3`,
            [newRating, peakRating, userId]
          );
        }
        
        // Update game participant record
        const eloBefore = await client.query(
          'SELECT elo_before FROM game_participants WHERE session_id = $1 AND user_id = $2',
          [sessionId, userId]
        );
        
        if (eloBefore.rows.length > 0) {
          const eloChange = newRating - eloBefore.rows[0].elo_before;
          
          await client.query(
            `UPDATE game_participants 
             SET elo_after = $1, elo_change = $2 
             WHERE session_id = $3 AND user_id = $4`,
            [newRating, eloChange, sessionId, userId]
          );
        }
      }
      
      await client.query('COMMIT');
      console.log('Player ratings updated successfully');
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating player ratings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get player's rating history
  static async getRatingHistory(userId: string, gameType?: string, limit: number = 20): Promise<any[]> {
    let query = `
      SELECT 
        mh.created_at,
        mh.game_type,
        mh.elo_before,
        mh.elo_after,
        mh.elo_change,
        mh.result,
        gs.room_code
      FROM match_history mh
      JOIN game_sessions gs ON mh.session_id = gs.id
      WHERE mh.user_id = $1
    `;
    
    const params: any[] = [userId];
    
    if (gameType) {
      query += ' AND mh.game_type = $2';
      params.push(gameType);
    }
    
    query += ' ORDER BY mh.created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get leaderboard
  static async getLeaderboard(gameType?: string, limit: number = 100): Promise<any[]> {
    let query = `
      SELECT 
        u.username,
        us.elo_rating,
        us.peak_rating,
        us.total_wins,
        us.total_losses,
        us.total_games,
        us.current_streak,
        us.best_streak,
        RANK() OVER (ORDER BY us.elo_rating DESC) as rank
      FROM user_statistics us
      JOIN users u ON us.user_id = u.id
      WHERE u.is_active = true AND us.total_games > 0
    `;
    
    if (gameType) {
      query = `
        SELECT 
          u.username,
          gts.wins,
          gts.losses,
          gts.games_played,
          (gts.wins::float / GREATEST(gts.games_played, 1) * 100)::integer as win_rate,
          us.elo_rating,
          RANK() OVER (ORDER BY us.elo_rating DESC) as rank
        FROM game_type_stats gts
        JOIN users u ON gts.user_id = u.id
        JOIN user_statistics us ON gts.user_id = us.user_id
        WHERE u.is_active = true AND gts.game_type = $1 AND gts.games_played > 0
      `;
    }
    
    query += ` ORDER BY elo_rating DESC LIMIT $${gameType ? '2' : '1'}`;
    const params = gameType ? [gameType, limit] : [limit];
    
    const result = await pool.query(query, params);
    return result.rows;
  }
}
