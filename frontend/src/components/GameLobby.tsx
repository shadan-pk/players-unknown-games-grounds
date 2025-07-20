import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';

const GameLobby: React.FC = () => {
  const [roomCode, setRoomCode] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const { 
    currentRoom, 
    gameTypes, 
    isLoadingGameTypes, 
    createRoom, 
    joinRoom, 
    fetchGameTypes,
    joinMatchmakingQueue
  } = useGameStore();

  useEffect(() => {
    if (gameTypes.length === 0) {
      fetchGameTypes();
    }
  }, [gameTypes.length, fetchGameTypes]);

  const handleCreateRoom = (gameType: string) => {
    createRoom(gameType, 'casual');
  };

  const handleJoinRoom = () => {
    if (roomCode.trim()) {
      joinRoom(roomCode.trim().toUpperCase());
    }
  };

  const handleQuickMatch = (gameType: string) => {
    joinMatchmakingQueue(gameType, 'casual');
  };

  // Filter games based on selected filters
  const filteredGameTypes = gameTypes.filter(game => {
    if (selectedDifficulty !== 'all' && game.difficulty_level !== selectedDifficulty) {
      return false;
    }
    
    if (selectedTags.length > 0) {
      const hasMatchingTag = selectedTags.some(tag => 
        game.tags?.includes(tag)
      );
      if (!hasMatchingTag) return false;
    }
    
    return true;
  });

  // Get all unique tags for filter
  const allTags = [...new Set(gameTypes.flatMap(game => game.tags || []))];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/20 text-green-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'hard': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      {/* <header className="border-b border-slate-700 px-4 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">PUGG</h1>
            <p className="text-gray-400">Player's Unknown Games Grounds</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-300">Welcome, {user?.username}!</span>
            <button onClick={logout} className="btn btn-outline btn-sm">
              Logout
            </button>
          </div>
        </div>
      </header> */}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {!currentRoom ? (
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <h2 className="text-5xl font-bold text-white mb-4">
                Enter the Arena
              </h2>
              <p className="text-xl text-gray-300">
                Choose your battleground and prove your skills
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-4 gap-8">
              {/* Join Room */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="lg:col-span-1"
              >
                <div className="card">
                  <h3 className="text-2xl font-bold text-white mb-4">Join Game</h3>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Enter room code"
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:outline-none text-center font-mono text-lg"
                      maxLength={6}
                    />
                    <button
                      onClick={handleJoinRoom}
                      disabled={!roomCode.trim()}
                      className="w-full btn btn-primary py-3 disabled:opacity-50"
                    >
                      Join Room
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <div className="card mt-6">
                  <h3 className="text-lg font-bold text-white mb-4">Filters</h3>
                  
                  {/* Difficulty Filter */}
                  <div className="mb-4">
                    <label className="block text-sm text-gray-300 mb-2">Difficulty</label>
                    <select
                      value={selectedDifficulty}
                      onChange={(e) => setSelectedDifficulty(e.target.value)}
                      className="w-full bg-slate-700 text-white rounded px-3 py-2"
                    >
                      <option value="all">All Difficulties</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>

                  {/* Tags Filter */}
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Tags</label>
                    <div className="space-y-1">
                      {allTags.map(tag => (
                        <label key={tag} className="flex items-center text-sm text-gray-300">
                          <input
                            type="checkbox"
                            checked={selectedTags.includes(tag)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTags([...selectedTags, tag]);
                              } else {
                                setSelectedTags(selectedTags.filter(t => t !== tag));
                              }
                            }}
                            className="mr-2"
                          />
                          {tag}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Create Room */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="lg:col-span-3"
              >
                <div className="card">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-white">Create New Game</h3>
                    <div className="text-sm text-gray-400">
                      {filteredGameTypes.length} of {gameTypes.length} games
                    </div>
                  </div>

                  {isLoadingGameTypes ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="text-gray-400 mt-2">Loading games...</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredGameTypes.map((game) => (
                        <motion.div
                          key={game.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="p-4 bg-slate-700 hover:bg-slate-600 rounded-lg border border-slate-600 hover:border-blue-500 transition-all group"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              {game.icon && (
                                <span className="text-2xl">{game.icon}</span>
                              )}
                              <h4 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                                {game.name}
                              </h4>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${getDifficultyColor(game.difficulty_level)}`}>
                              {game.difficulty_level}
                            </span>
                          </div>
                          
                          <p className="text-gray-400 text-sm mb-3">
                            {game.description}
                          </p>
                          
                          <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                            <span>{game.min_players}-{game.max_players} players</span>
                            <span>{game.estimated_duration}</span>
                          </div>
                          
                          {game.tags && game.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-4">
                              {game.tags.slice(0, 3).map(tag => (
                                <span
                                  key={tag}
                                  className="text-xs px-2 py-1 bg-slate-600 text-gray-300 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                              {game.tags.length > 3 && (
                                <span className="text-xs px-2 py-1 bg-slate-600 text-gray-300 rounded">
                                  +{game.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleQuickMatch(game.id)}
                              className="flex-1 btn btn-primary py-2 text-sm"
                            >
                              Quick Match
                            </button>
                            <button
                              onClick={() => handleCreateRoom(game.id)}
                              className="flex-1 btn btn-secondary py-2 text-sm"
                            >
                              Create Room
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {!isLoadingGameTypes && filteredGameTypes.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-400">No games match your current filters</p>
                      <button
                        onClick={() => {
                          setSelectedDifficulty('all');
                          setSelectedTags([]);
                        }}
                        className="text-blue-400 hover:text-blue-300 mt-2"
                      >
                        Clear filters
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        ) : (
          <GameWaitingRoom />
        )}
      </div>
    </div>
  );
};

// GameWaitingRoom component remains the same...
const GameWaitingRoom: React.FC = () => {
  const { currentRoom } = useGameStore();
  
  if (!currentRoom) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="card text-center">
        <h2 className="text-3xl font-bold text-white mb-4">
          {currentRoom.gameType.charAt(0).toUpperCase() + currentRoom.gameType.slice(1)} Room
        </h2>
        
        <div className="mb-6">
          <p className="text-gray-400 mb-2">Room Code</p>
          <div className="text-4xl font-mono font-bold text-blue-400 bg-slate-700 py-4 px-6 rounded-lg inline-block">
            {currentRoom.code}
          </div>
        </div>

        <div className="mb-8">
          <p className="text-gray-400 mb-4">Players ({currentRoom.players.length}/2)</p>
          <div className="grid grid-cols-2 gap-4">
            {currentRoom.players.map((player, index) => (
              <div key={player.id} className="bg-slate-700 rounded-lg p-3">
                <div className="text-white font-medium">{player.username}</div>
                <div className="text-sm text-gray-400">Player {index + 1}</div>
              </div>
            ))}
            {Array.from({ length: 2 - currentRoom.players.length }, (_, i) => (
              <div key={`empty-${i}`} className="bg-slate-800 rounded-lg p-3 border-2 border-dashed border-slate-600">
                <div className="text-gray-500">Waiting for player...</div>
              </div>
            ))}
          </div>
        </div>

        {currentRoom.status === 'waiting' && currentRoom.players.length < 2 && (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-400">Waiting for opponent...</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default GameLobby;
