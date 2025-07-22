import { v4 as uuidv4 } from 'uuid';
import { BaseGame, Player } from '../games/BaseGame';
import { TicTacToeGame } from '../games/tictactoe/TicTacToeGame';

export class GameRoom {
  public id: string;
  public code: string;
  public gameType: string;
  public players: Map<string, Player> = new Map();
  public maxPlayers: number;
  public status: 'waiting' | 'playing' | 'finished' = 'waiting';
  public game: BaseGame | null = null;
  public createdAt: Date;

  constructor(gameType: string, creatorId: string, creatorUsername: string) {
    this.id = uuidv4();
    this.code = this.generateRoomCode();
    this.gameType = gameType;
    this.maxPlayers = this.getMaxPlayersForGame(gameType);
    this.createdAt = new Date();

    // Add creator as first player
    this.players.set(creatorId, {
      id: creatorId,
      username: creatorUsername
    });
  }

  addPlayer(userId: string, username: string, socketId: string): boolean {
    if (this.players.size >= this.maxPlayers || this.status !== 'waiting') {
      return false;
    }

    if (this.players.has(userId)) {
      // Update socket ID if player reconnects
      const player = this.players.get(userId)!;
      player.socketId = socketId;
      return true;
    }

    this.players.set(userId, {
      id: userId,
      username,
      socketId
    });

    return true;
  }

  removePlayer(userId: string): void {
    this.players.delete(userId);
    
    if (this.players.size === 0) {
      this.status = 'finished';
    }
  }

  canStart(): boolean {
    return this.players.size === this.maxPlayers && this.status === 'waiting';
  }

  startGame(): void {
    if (!this.canStart()) return;

    const playersArray = Array.from(this.players.values());
    
    switch (this.gameType) {
      case 'tictactoe':
        this.game = new TicTacToeGame(this.gameType, playersArray);
        break;
      default:
        throw new Error(`Unsupported game type: ${this.gameType}`);
    }

    this.status = 'playing';
  }

  isValidMove(userId: string, move: any): boolean {
    if (!this.game || this.status !== 'playing') return false;
    return this.game.isValidMove(userId, move);
  }

  processMove(userId: string, move: any): any {
    if (!this.game) throw new Error('Game not started');
    
    const result = this.game.makeMove(userId, move);
    
    if (result.gameEnd?.isFinished) {
      this.status = 'finished';
    }

    return result;
  }

  getGameState(): any {
    if (!this.game) return null;
    return this.game.getGameState();
  }

  private generateRoomCode(): string {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
  }

  private getMaxPlayersForGame(gameType: string): number {
    switch (gameType) {
      case 'tictactoe':
      case 'checkers':
      case 'chess':
        return 2;
      default:
        return 2;
    }
  }
}
