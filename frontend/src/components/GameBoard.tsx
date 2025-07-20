import React from 'react';
import TicTacToeBoard from './TicTacToeBoard';
import type { GameState } from '../types';

interface GameBoardProps {
  gameType: string;
  gameState: GameState;
  isMyTurn: boolean;
  mySymbol?: string;
}

const GameBoard: React.FC<GameBoardProps> = ({ 
  gameType, 
  gameState, 
  isMyTurn, 
  mySymbol 
}) => {
  switch (gameType) {
    case 'tictactoe':
      return (
        <TicTacToeBoard
          gameState={gameState as any}
          isMyTurn={isMyTurn}
          mySymbol={mySymbol as 'X' | 'O'}
        />
      );
    default:
      return (
        <div className="text-center text-gray-400">
          Game type "{gameType}" not implemented yet
        </div>
      );
  }
};

export default GameBoard; 