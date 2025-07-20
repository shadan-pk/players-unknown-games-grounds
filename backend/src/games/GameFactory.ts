import { BaseGame } from './BaseGame';
import { Player } from './types';
import { TicTacToeGame } from './tictactoe';
import { CheckersGame } from './checkers';
import { ChessGame } from './chess';
import { Connect4Game } from './connect4';

export class GameFactory {
  static createGame(gameType: string, players: Player[], configurations?: Record<string, any>): BaseGame {
    switch (gameType) {
      case 'tictactoe':
        return new TicTacToeGame(players, configurations);
      
      case 'checkers':
        return new CheckersGame(players, configurations);
      
      case 'chess':
        return new ChessGame(players, configurations);
      
      case 'connect4':
        return new Connect4Game(players, configurations);
      
      default:
        throw new Error(`Unsupported game type: ${gameType}`);
    }
  }

  static getSupportedGames(): string[] {
    return ['tictactoe', 'checkers', 'chess', 'connect4'];
  }

  static isGameSupported(gameType: string): boolean {
    return this.getSupportedGames().includes(gameType);
  }
}
