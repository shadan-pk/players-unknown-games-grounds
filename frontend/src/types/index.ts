export interface User {
    id: string;
    username: string;
    email: string;
  }
  
  export interface Player {
    id: string;
    username: string;
    socketId?: string;
  }
  
  export interface GameState {
    board?: unknown;
    currentPlayer?: Player;
    isFinished?: boolean;
    winner?: Player | null;
    players?: Player[];
    gameType?: string;
    moveCount?: number;
    lastMove?: unknown;
  }
  
  export interface GameRoom {
    id: string;
    code: string;
    gameType: string;
    players: Player[];
    status: 'waiting' | 'playing' | 'finished';
  }
  