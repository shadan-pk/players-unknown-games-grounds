import { BaseGame, Player, MoveResult, GameEndResult } from './BaseGame';

export interface TicTacToeMove {
  position: number; // 0-8
}

export class TicTacToeGame extends BaseGame {
  createInitialState() {
    return {
      board: Array(9).fill(null),
      moveCount: 0,
      lastMove: null
    };
  }

  isValidMove(playerId: string, move: TicTacToeMove): boolean {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player !== this.getCurrentPlayer()) {
      return false;
    }

    const { position } = move;
    if (position < 0 || position > 8) {
      return false;
    }

    return this.gameState.board[position] === null;
  }

  applyMove(playerId: string, move: TicTacToeMove): MoveResult {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    const symbol = playerIndex === 0 ? 'X' : 'O';

    this.gameState.board[move.position] = symbol;
    this.gameState.moveCount++;
    this.gameState.lastMove = {
      player: this.players[playerIndex],
      position: move.position,
      symbol
    };

    return { success: true };
  }

  checkGameEnd(): GameEndResult {
    const { board } = this.gameState;
    
    // Check for wins
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6] // diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        const winnerSymbol = board[a];
        const winner = this.players[winnerSymbol === 'X' ? 0 : 1];
        return {
          isFinished: true,
          winner,
          type: 'win',
          reason: `${winner.username} wins with three in a row!`
        };
      }
    }

    // Check for draw
    if (this.gameState.moveCount === 9) {
      return {
        isFinished: true,
        winner: null,
        type: 'draw',
        reason: 'Game ended in a draw!'
      };
    }

    return { isFinished: false };
  }

  getDisplayState() {
    return {
      board: this.gameState.board,
      moveCount: this.gameState.moveCount,
      lastMove: this.gameState.lastMove,
      gameType: this.gameType
    };
  }
}
