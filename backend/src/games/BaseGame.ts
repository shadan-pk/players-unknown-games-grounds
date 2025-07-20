export interface Player {
    id: string;
    username: string;
    socketId?: string;
  }
  
  export interface MoveResult {
    success: boolean;
    error?: string;
    gameState?: any;
    gameEnd?: GameEndResult;
    nextPlayer?: Player;
  }
  
  export interface GameEndResult {
    isFinished: boolean;
    winner?: Player | null;
    type?: 'win' | 'draw' | 'forfeit';
    reason?: string;
  }
  
  export abstract class BaseGame {
    protected gameType: string;
    protected players: Player[];
    protected currentPlayerIndex: number = 0;
    protected gameState: any;
    protected isFinished: boolean = false;
    protected winner: Player | null = null;
    protected startTime: Date;
  
    constructor(gameType: string, players: Player[]) {
      this.gameType = gameType;
      this.players = players;
      this.gameState = this.createInitialState();
      this.startTime = new Date();
    }
  
    abstract createInitialState(): any;
    abstract isValidMove(playerId: string, move: any): boolean;
    abstract applyMove(playerId: string, move: any): MoveResult;
    abstract checkGameEnd(): GameEndResult;
    abstract getDisplayState(): any;
  
    public makeMove(playerId: string, move: any): MoveResult {
      if (this.isFinished) {
        return { success: false, error: 'Game has ended' };
      }
  
      if (!this.isValidMove(playerId, move)) {
        return { success: false, error: 'Invalid move' };
      }
  
      const result = this.applyMove(playerId, move);
      const endResult = this.checkGameEnd();
  
      if (endResult.isFinished) {
        this.isFinished = true;
        this.winner = endResult.winner || null;
      } else {
        this.switchPlayer();
      }
  
      return {
        success: true,
        gameState: this.getDisplayState(),
        gameEnd: endResult,
        nextPlayer: this.getCurrentPlayer()
      };
    }
  
    protected switchPlayer(): void {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    }
  
    public getCurrentPlayer(): Player {
      return this.players[this.currentPlayerIndex];
    }
  
    public getGameState(): any {
      return {
        ...this.getDisplayState(),
        currentPlayer: this.getCurrentPlayer(),
        isFinished: this.isFinished,
        winner: this.winner,
        players: this.players
      };
    }
  
    public forfeit(playerId: string): GameEndResult {
      const player = this.players.find(p => p.id === playerId);
      if (!player) {
        throw new Error('Player not found');
      }
  
      this.isFinished = true;
      this.winner = this.players.find(p => p.id !== playerId) || null;
  
      return {
        isFinished: true,
        winner: this.winner,
        type: 'forfeit',
        reason: `${player.username} forfeited`
      };
    }
  }
  