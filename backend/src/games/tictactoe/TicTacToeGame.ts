import { BaseGame, Player, GameResult } from '../BaseGame';

interface TicTacToeState {
  board: (string | null)[];
  symbols: Map<string, string>; // playerId -> symbol (X or O)
}

interface TicTacToeMove {
  position: number; // 0-8
}

export class TicTacToeGame extends BaseGame {
  createInitialState(config?: any): TicTacToeState {
    const symbols = new Map<string, string>();
    symbols.set(this.players[0].id, 'X');
    symbols.set(this.players[1].id, 'O');

    return {
      board: Array(9).fill(null),
      symbols
    };
  }

  isValidMove(playerId: string, moveData: TicTacToeMove): boolean {
    const { position } = moveData;
    
    // Check if it's the player's turn
    if (this.getCurrentPlayer().id !== playerId) return false;
    
    // Check if position is valid
    if (position < 0 || position > 8) return false;
    
    // Check if position is empty
    return this.gameData.board[position] === null;
  }

  applyMove(playerId: string, moveData: TicTacToeMove): boolean {
    const { position } = moveData;
    const symbol = this.gameData.symbols.get(playerId);
    
    if (!symbol) return false;
    
    this.gameData.board[position] = symbol;
    return true;
  }

  checkGameEnd(): GameResult | null {
    const { board } = this.gameData;
    
    // Check for wins
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6] // diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        // Find winner by symbol
        const winningSymbol = board[a];
        const winner = this.players.find(p => 
          this.gameData.symbols.get(p.id) === winningSymbol
        );
        
        return {
          isFinished: true,
          result: 'win',
          winner: winner!,
          scores: this.getScores(),
          duration: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
          totalMoves: this.moves.length,
          endReason: `${winner!.username} wins with three in a row!`
        };
      }
    }

    // Check for draw
    if (board.every((cell: string | null) => cell !== null)) {
      return {
        isFinished: true,
        result: 'draw',
        winner: null,
        scores: this.getScores(),
        duration: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
        totalMoves: this.moves.length,
        endReason: 'Game ended in a draw!'
      };
    }

    return null; // Game continues
  }

  getDisplayState(): any {
    return {
      board: this.gameData.board,
      symbols: Object.fromEntries(this.gameData.symbols),
      currentPlayer: this.getCurrentPlayer().id
    };
  }

  getScores(): Map<string, number> {
    const scores = new Map<string, number>();
    
    if (this.result) {
      if (this.result.result === 'win' && this.result.winner) {
        scores.set(this.result.winner.id, 1);
        this.players.forEach(player => {
          if (player.id !== this.result!.winner!.id) {
            scores.set(player.id, 0);
          }
        });
      } else if (this.result.result === 'draw') {
        this.players.forEach(player => {
          scores.set(player.id, 0.5);
        });
      } else {
        // Forfeit or disconnect
        this.players.forEach(player => {
          scores.set(player.id, player.id === this.result!.winner?.id ? 1 : 0);
        });
      }
    } else {
      // Game in progress
      this.players.forEach(player => {
        scores.set(player.id, 0);
      });
    }
    
    return scores;
  }

  // Get specific game analysis
  getGameAnalysis(): any {
    const analysis = {
      winningPattern: null as number[] | null,
      gameComplexity: 'simple',
      criticalMoves: [] as number[],
      playerPerformance: this.players.map(player => ({
        playerId: player.id,
        username: player.username,
        symbol: this.gameData.symbols.get(player.id),
        movesPlayed: this.moves.filter(m => m.playerId === player.id).length,
        averageMoveTime: this.getAverageMoveTime(player.id)
      }))
    };

    // Find winning pattern if game is won
    if (this.result?.result === 'win') {
      const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
      ];

      for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        const { board } = this.gameData;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
          analysis.winningPattern = pattern;
          break;
        }
      }
    }

    return analysis;
  }

  private getAverageMoveTime(playerId: string): number {
    const playerMoves = this.moves.filter(m => m.playerId === playerId);
    if (playerMoves.length === 0) return 0;

    let totalTime = 0;
    for (let i = 0; i < playerMoves.length; i++) {
      const currentMove = playerMoves[i];
      const previousMove = i > 0 ? playerMoves[i - 1] : { timestamp: this.startTime };
      totalTime += currentMove.timestamp.getTime() - previousMove.timestamp.getTime();
    }

    return Math.round(totalTime / playerMoves.length / 1000); // seconds
  }
}
