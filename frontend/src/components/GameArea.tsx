import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import GameBoard from './GameBoard';

const GameArea: React.FC = () => {
  const { currentRoom, gameState, leaveRoom } = useGameStore();
  const { user } = useAuthStore();

  const myPlayerIndex = useMemo(() => {
    if (!currentRoom || !user) return -1;
    return currentRoom.players.findIndex(p => p.id === user.id);
  }, [currentRoom, user]);

  const mySymbol = useMemo(() => {
    return myPlayerIndex === 0 ? 'X' : 'O';
  }, [myPlayerIndex]);

  const isMyTurn = useMemo(() => {
    if (!gameState || !user) return false;
    return gameState.currentPlayer?.id === user.id;
  }, [gameState, user]);

  const handleLeaveRoom = () => {
    leaveRoom();
  };

  if (!currentRoom || !gameState) {
    return <div>Loading game...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-700 px-4 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {currentRoom.gameType.charAt(0).toUpperCase() + currentRoom.gameType.slice(1)}
            </h1>
            <p className="text-gray-400">Room: {currentRoom.code}</p>
          </div>
          <button 
            onClick={handleLeaveRoom}
            className="btn btn-outline btn-sm"
          >
            Leave Game
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Players Panel */}
          <div className="lg:col-span-1">
            <div className="card">
              <h3 className="text-xl font-bold text-white mb-4">Players</h3>
              <div className="space-y-3">
                {currentRoom.players.map((player, index) => (
                  <div
                    key={player.id}
                    className={`
                      p-3 rounded-lg border-2 transition-colors
                      ${gameState.currentPlayer?.id === player.id && !gameState.isFinished
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-600 bg-slate-700'
                      }
                    `}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-white">
                          {player.username}
                          {player.id === user?.id && ' (You)'}
                        </div>
                        <div className="text-sm text-gray-400">
                          Playing as: <span className={`font-bold ${index === 0 ? 'text-blue-400' : 'text-red-400'}`}>
                            {index === 0 ? 'X' : 'O'}
                          </span>
                        </div>
                      </div>
                      {gameState.currentPlayer?.id === player.id && !gameState.isFinished && (
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {gameState.isFinished && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 bg-slate-700 rounded-lg text-center"
                >
                  <div className="text-lg font-bold text-white mb-2">
                    Game Over!
                  </div>
                  {gameState.winner ? (
                    <div className="text-green-400">
                      🎉 {gameState.winner.username} wins!
                    </div>
                  ) : (
                    <div className="text-yellow-400">
                      🤝 It's a draw!
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          {/* Game Board */}
          <div className="lg:col-span-2">
            <div className="card">
              <GameBoard
                gameType={currentRoom.gameType}
                gameState={gameState}
                isMyTurn={isMyTurn}
                mySymbol={mySymbol}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameArea;
