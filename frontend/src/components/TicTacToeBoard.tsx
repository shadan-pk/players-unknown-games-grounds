import React from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
// import type { GameState } from '../types';
import type { Player } from '../types';
// import type { TicTacToeGameState } from '../types/game';

interface TicTacToeGameState {
  board: (string | null)[];
  currentPlayer?: Player;
  isFinished?: boolean;
  winner?: Player | null;
  players?: Player[];
  gameType?: string;
  moveCount?: number;
  lastMove?: {
    player: Player;
    symbol: string;
    position: number;
  };
}

interface TicTacToeBoardProps {
  gameState: TicTacToeGameState;
  isMyTurn: boolean;
  mySymbol: 'X' | 'O';
}

const TicTacToeBoard: React.FC<TicTacToeBoardProps> = ({ 
  gameState, 
  isMyTurn, 
  mySymbol 
}) => {
  const { makeMove } = useGameStore();

  const handleCellClick = (position: number) => {
    if (!isMyTurn || gameState.board[position] !== null || gameState.isFinished) {
      return;
    }
    
    makeMove({ position });
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Game Info */}
      <div className="text-center mb-6">
        <div className="text-lg text-gray-400 mb-2">
          {gameState.isFinished 
            ? (gameState.winner 
                ? `${gameState.winner.username} wins!` 
                : "It's a draw!")
            : isMyTurn 
              ? "Your turn" 
              : `${gameState.players?.find(p => typeof gameState.currentPlayer === 'string' && p.id === gameState.currentPlayer)?.username || 'Unknown'}'s turn`}
        </div>
        <div className="text-sm text-gray-500">
          You are playing as: <span className={`font-bold ${mySymbol === 'X' ? 'text-blue-400' : 'text-red-400'}`}>{mySymbol}</span>
        </div>
      </div>

      {/* Game Board */}
      <div className="grid grid-cols-3 gap-2 aspect-square">
        {gameState.board.map((cell: string | null, index: number) => (
          <motion.button
            key={index}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={!cell && isMyTurn && !gameState.isFinished ? { scale: 1.05 } : {}}
            whileTap={!cell && isMyTurn && !gameState.isFinished ? { scale: 0.95 } : {}}
            onClick={() => handleCellClick(index)}
            disabled={!!cell || !isMyTurn || gameState.isFinished}
            className={`
              aspect-square bg-slate-700 rounded-lg text-4xl font-bold
              border-2 transition-all duration-200
              ${!cell && isMyTurn && !gameState.isFinished 
                ? 'hover:bg-slate-600 border-slate-600 hover:border-blue-500 cursor-pointer' 
                : 'border-slate-600'
              }
              ${cell === 'X' ? 'text-blue-400' : cell === 'O' ? 'text-red-400' : 'text-gray-500'}
              ${!cell && !isMyTurn && !gameState.isFinished ? 'cursor-not-allowed' : ''}
            `}
          >
            {cell && (
              <motion.span
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {cell}
              </motion.span>
            )}
          </motion.button>
        ))}
      </div>

      {/* Move History */}
      {gameState.lastMove && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 text-center text-sm text-gray-400"
        >
          Last move: {gameState.lastMove.player.username} played {gameState.lastMove.symbol} at position {gameState.lastMove.position + 1}
        </motion.div>
      )}
    </div>
  );
};

export default TicTacToeBoard;
