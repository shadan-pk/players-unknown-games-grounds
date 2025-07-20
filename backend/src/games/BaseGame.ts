import { EventEmitter } from 'events';

export interface Player {
  id: string;
  username: string;
  socketId?: string;
  elo: number;
  isConnected: boolean;
}

export interface Move {
  playerId: string;
  moveData: any;
  timestamp: Date;
  moveNumber: number;
}

export interface GameResult {
  isFinished: boolean;
  result: 'win' | 'draw' | 'forfeit' | 'timeout' | 'disconnect';
  winner?: Player | null;
  scores: Map<string, number>;
  duration: number; // in seconds
  totalMoves: number;
  endReason: string;
}

export interface GameState {
  gameId: string;
  gameType: string;
  players: Player[];
  currentPlayerIndex: number;
  gameData: any; // Game-specific state
  moves: Move[];
  startTime: Date;
  status: 'waiting' | 'playing' | 'paused' | 'finished';
  result?: GameResult;
}

export abstract class BaseGame extends EventEmitter {
  protected gameId: string;
  protected gameType: string;
  protected players: Player[];
  protected currentPlayerIndex: number = 0;
  protected gameData: any;
  protected moves: Move[] = [];
  protected startTime: Date;
  protected status: 'waiting' | 'playing' | 'paused' | 'finished' = 'waiting';
  protected result?: GameResult;
  protected moveTimeLimit?: number; // seconds per move
  protected gameTimeLimit?: number; // total game time
  private moveTimer?: NodeJS.Timeout;
  private gameTimer?: NodeJS.Timeout;

  constructor(gameId: string, gameType: string, players: Player[], config?: any) {
    super();
    this.gameId = gameId;
    this.gameType = gameType;
    this.players = players.map(p => ({ ...p, isConnected: true }));
    this.gameData = this.createInitialState(config);
    this.startTime = new Date();
    this.moveTimeLimit = config?.moveTimeLimit;
    this.gameTimeLimit = config?.gameTimeLimit;
  }

  // Abstract methods that must be implemented by each game
  abstract createInitialState(config?: any): any;
  abstract isValidMove(playerId: string, moveData: any): boolean;
  abstract applyMove(playerId: string, moveData: any): boolean;
  abstract checkGameEnd(): GameResult | null;
  abstract getDisplayState(): any;
  abstract getScores(): Map<string, number>;

  // Start the game
  start(): void {
    if (this.status !== 'waiting') return;
    
    this.status = 'playing';
    this.startTime = new Date();
    
    if (this.gameTimeLimit) {
      this.gameTimer = setTimeout(() => {
        this.endGame('timeout', 'Game time limit reached');
      }, this.gameTimeLimit * 1000);
    }
    
    this.startMoveTimer();
    this.emit('gameStarted', this.getGameState());
  }

  // Make a move
  makeMove(playerId: string, moveData: any): boolean {
    if (this.status !== 'playing') return false;
    if (this.getCurrentPlayer().id !== playerId) return false;
    if (!this.isValidMove(playerId, moveData)) return false;

    // Clear move timer
    if (this.moveTimer) {
      clearTimeout(this.moveTimer);
    }

    // Apply the move
    const success = this.applyMove(playerId, moveData);
    if (!success) return false;

    // Record the move
    const move: Move = {
      playerId,
      moveData,
      timestamp: new Date(),
      moveNumber: this.moves.length + 1
    };
    this.moves.push(move);

    // Check for game end
    const endResult = this.checkGameEnd();
    if (endResult) {
      this.endGame(endResult.result, endResult.endReason, endResult.winner || undefined);
    } else {
      this.nextPlayer();
      this.startMoveTimer();
    }

    this.emit('moveMade', {
      move,
      gameState: this.getGameState()
    });

    return true;
  }

  // Player disconnection
  playerDisconnected(playerId: string): void {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    player.isConnected = false;
    
    if (this.status === 'playing') {
      // Give some time for reconnection
      setTimeout(() => {
        if (!player.isConnected && this.status === 'playing') {
          const remainingPlayers = this.players.filter(p => p.isConnected);
          if (remainingPlayers.length === 1) {
            this.endGame('disconnect', `${player.username} disconnected`, remainingPlayers[0]);
          }
        }
      }, 30000); // 30 seconds to reconnect
    }

    this.emit('playerDisconnected', { playerId, gameState: this.getGameState() });
  }

  // Player reconnection
  playerReconnected(playerId: string, socketId: string): void {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    player.isConnected = true;
    player.socketId = socketId;
    
    this.emit('playerReconnected', { playerId, gameState: this.getGameState() });
  }

  // Player forfeit
  playerForfeit(playerId: string): void {
    if (this.status !== 'playing') return;

    const forfeiter = this.players.find(p => p.id === playerId);
    if (!forfeiter) return;

    const winner = this.players.find(p => p.id !== playerId);
    this.endGame('forfeit', `${forfeiter.username} forfeited`, winner);
  }

  // Get current player
  getCurrentPlayer(): Player {
    return this.players[this.currentPlayerIndex];
  }

  // Move to next player
  private nextPlayer(): void {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
  }

  // Start move timer
  private startMoveTimer(): void {
    if (!this.moveTimeLimit) return;

    this.moveTimer = setTimeout(() => {
      // Auto-forfeit on timeout
      const currentPlayer = this.getCurrentPlayer();
      this.playerForfeit(currentPlayer.id);
    }, this.moveTimeLimit * 1000);
  }

  // End the game
  private endGame(result: GameResult['result'], reason: string, winner?: Player | null): void {
    if (this.status === 'finished') return;

    // Clear timers
    if (this.moveTimer) clearTimeout(this.moveTimer);
    if (this.gameTimer) clearTimeout(this.gameTimer);

    this.status = 'finished';
    
    this.result = {
      isFinished: true,
      result,
      winner: winner || null,
      scores: this.getScores(),
      duration: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      totalMoves: this.moves.length,
      endReason: reason
    };

    this.emit('gameEnded', {
      result: this.result,
      gameState: this.getGameState()
    });
  }

  // Get complete game state
  getGameState(): GameState {
    return {
      gameId: this.gameId,
      gameType: this.gameType,
      players: this.players,
      currentPlayerIndex: this.currentPlayerIndex,
      gameData: this.getDisplayState(),
      moves: this.moves,
      startTime: this.startTime,
      status: this.status,
      result: this.result
    };
  }

  // Get game statistics
  getGameStats(): any {
    const duration = this.status === 'finished' 
      ? this.result!.duration 
      : Math.floor((Date.now() - this.startTime.getTime()) / 1000);

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      duration,
      totalMoves: this.moves.length,
      averageMovesPerMinute: duration > 0 ? Math.round((this.moves.length / duration) * 60) : 0,
      playerStats: this.players.map(player => ({
        playerId: player.id,
        username: player.username,
        movesPlayed: this.moves.filter(m => m.playerId === player.id).length,
        isConnected: player.isConnected
      }))
    };
  }
}
