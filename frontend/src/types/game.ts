import type { Player } from './index';

export interface GameResult {
    isFinished: boolean;
    result: 'win' | 'draw' | 'forfeit' | 'timeout' | 'disconnect';
    winner?: Player | null;
    scores: Record<string, number>;
    duration: number;
    totalMoves: number;
    endReason: string;
  }
  
  export interface GameStats {
    gameId: string;
    gameType: string;
    duration: number;
    totalMoves: number;
    averageMovesPerMinute: number;
    playerStats: PlayerGameStats[];
  }
  
  export interface PlayerGameStats {
    playerId: string;
    username: string;
    movesPlayed: number;
    isConnected: boolean;
    averageMoveTime?: number;
    accuracy?: number;
    symbol?: string;
  }
  
  export interface MatchHistory {
    sessionId: string;
    gameType: string;
    matchType: 'casual' | 'ranked';
    result: 'win' | 'loss' | 'draw' | 'disconnect' | 'forfeit';
    eloBefore: number;
    eloAfter: number;
    eloChange: number;
    duration: number;
    opponent: string;
    createdAt: Date;
  }
  
  export interface UserStatistics {
    userId: string;
    username: string;
    totalGames: number;
    totalWins: number;
    totalLosses: number;
    totalDraws: number;
    winRate: number;
    currentStreak: number;
    bestStreak: number;
    eloRating: number;
    peakRating: number;
    rank: number;
    gamesThisWeek: number;
    hoursPlayed: number;
    favoriteGame: string;
    achievements: Achievement[];
  }
  
  export interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
    points: number;
    earnedAt?: Date;
    progress?: number;
    isNew?: boolean;
  }
  
  export interface RatingHistory {
    date: Date;
    rating: number;
    change: number;
    gameType: string;
    result: string;
  }
  