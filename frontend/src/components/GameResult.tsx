import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import type { GameResult as GameResultType, GameStats, PlayerGameStats, Achievement } from '../types/game';
import { Trophy, Target, Clock, Zap, Award, TrendingUp, Users } from 'lucide-react';

interface GameResultProps {
  result: GameResultType;
  stats: GameStats;
  onContinue: () => void;
  onPlayAgain: () => void;
}

const GameResult: React.FC<GameResultProps> = ({ result, stats, onContinue, onPlayAgain }) => {
  const [showStats, setShowStats] = useState(false);
  const [currentTab, setCurrentTab] = useState<'overview' | 'performance' | 'analysis'>('overview');
  const { user } = useAuthStore();
  const [achievementsEarned, setAchievementsEarned] = useState<Achievement[]>([]);
  const [eloChange, setEloChange] = useState(0);
  const [newRank, setNewRank] = useState<number | null>(null);

  const isWinner = result.winner?.id === user?.id;
  const isDraw = result.result === 'draw';
  const userStats = stats.playerStats.find(p => p.playerId === user?.id);

  useEffect(() => {
    // Animate stats reveal after 2 seconds
    const timer = setTimeout(() => setShowStats(true), 2000);
    
    // Fetch achievements and ELO changes
    fetchPostGameData();
    
    return () => clearTimeout(timer);
  }, []);

  const fetchPostGameData = async () => {
    try {
      // Fetch any new achievements earned
      const achievementsResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/api/achievements/recent/${user?.id}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      if (achievementsResponse.ok) {
        const data = await achievementsResponse.json();
        setAchievementsEarned(data.achievements || []);
      }

      // Fetch ELO change for this match
      const eloResponse = await fetch(
        `${import.meta.env.VITE_API_URL}/api/matches/${stats.gameId}/elo`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      if (eloResponse.ok) {
        const data = await eloResponse.json();
        setEloChange(data.eloChange || 0);
        setNewRank(data.newRank || null);
      }
    } catch (error) {
      console.error('Error fetching post-game data:', error);
    }
  };

  const getResultColor = () => {
    if (isDraw) return 'text-yellow-400 border-yellow-400';
    return isWinner ? 'text-green-400 border-green-400' : 'text-red-400 border-red-400';
  };

  const getResultIcon = () => {
    if (isDraw) return '🤝';
    return isWinner ? '🏆' : '💔';
  };

  const getResultText = () => {
    if (isDraw) return 'DRAW';
    if (result.result === 'forfeit') return isWinner ? 'VICTORY' : 'FORFEIT';
    if (result.result === 'disconnect') return isWinner ? 'VICTORY' : 'DISCONNECTED';
    if (result.result === 'timeout') return isWinner ? 'VICTORY' : 'TIMEOUT';
    return isWinner ? 'VICTORY!' : 'DEFEAT';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="w-full max-w-6xl mx-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden"
      >
        {/* Header Section */}
        <div className="relative bg-gradient-to-r from-slate-800 to-slate-700 p-8 text-center">
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <div className={`text-6xl mb-4 ${getResultColor()}`}>
              {getResultIcon()}
            </div>
            <h1 className={`text-4xl font-bold mb-2 ${getResultColor()} border-2 px-8 py-3 rounded-lg inline-block`}>
              {getResultText()}
            </h1>
            <p className="text-gray-300 text-lg">
              {result.endReason}
            </p>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex justify-center items-center gap-8 text-sm text-gray-300"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{formatDuration(result.duration)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span>{result.totalMoves} moves</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{stats.playerStats.length} players</span>
            </div>
          </motion.div>

          {/* ELO Change */}
          <AnimatePresence>
            {showStats && eloChange !== 0 && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mt-6 inline-block"
              >
                <div className={`px-6 py-3 rounded-lg border-2 ${
                  eloChange > 0 ? 'bg-green-500/20 border-green-400 text-green-400' :
                  'bg-red-500/20 border-red-400 text-red-400'
                }`}>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="font-bold">
                      {eloChange > 0 ? '+' : ''}{eloChange} ELO
                    </span>
                    {newRank && (
                      <span className="text-sm opacity-75">
                        (Rank #{newRank})
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-800 border-b border-slate-700">
          <div className="flex">
            {[
              { key: 'overview', label: 'Overview', icon: Trophy },
              { key: 'performance', label: 'Performance', icon: Target },
              { key: 'analysis', label: 'Analysis', icon: Zap }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setCurrentTab(key as typeof currentTab)}
                className={`flex-1 px-6 py-4 text-center border-b-2 transition-colors ${
                  currentTab === key
                    ? 'border-blue-400 text-blue-400 bg-blue-500/10'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Content Section */}
        <div className="p-8 max-h-96 overflow-y-auto">
          <AnimatePresence mode="wait">
            {currentTab === 'overview' && (
              <OverviewTab
                result={result}
                stats={stats}
                achievements={achievementsEarned}
                userStats={userStats}
              />
            )}
            {currentTab === 'performance' && (
              <PerformanceTab stats={stats} userId={user?.id} />
            )}
            {currentTab === 'analysis' && (
              <AnalysisTab result={result} stats={stats} />
            )}
          </AnimatePresence>
        </div>

        {/* Action Buttons */}
        <div className="bg-slate-800 p-6 flex justify-center gap-4">
          <button
            onClick={onPlayAgain}
            className="btn btn-primary px-8 py-3 text-lg font-medium"
          >
            Play Again
          </button>
          <button
            onClick={onContinue}
            className="btn btn-secondary px-8 py-3 text-lg font-medium"
          >
            Continue
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{
  result: GameResultType;
  stats: GameStats;
  achievements: Achievement[];
  userStats?: PlayerGameStats;
}> = ({ result, stats, achievements }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Players Performance */}
      <div className="grid md:grid-cols-2 gap-6">
        {stats.playerStats.map((player, index) => (
          <motion.div
            key={player.playerId}
            initial={{ opacity: 0, x: index === 0 ? -50 : 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 * index }}
            className={`bg-slate-700 rounded-lg p-6 border-2 ${
              result.winner?.id === player.playerId
                ? 'border-green-400'
                : result.result === 'draw'
                ? 'border-yellow-400'
                : 'border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white">{player.username}</h3>
                <p className="text-gray-400">{player.symbol || `Player ${index + 1}`}</p>
              </div>
              <div className="text-right">
                {result.winner?.id === player.playerId && (
                  <Trophy className="w-6 h-6 text-yellow-400 mb-1" />
                )}
                <div className="text-2xl font-bold text-white">
                  {Math.round((result.scores[player.playerId] || 0) * 100)}%
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Moves Played:</span>
                <span className="text-white font-medium">{player.movesPlayed}</span>
              </div>
              {player.averageMoveTime && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Avg. Move Time:</span>
                  <span className="text-white font-medium">{player.averageMoveTime}s</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Connection:</span>
                <span className={`font-medium ${
                  player.isConnected ? 'text-green-400' : 'text-red-400'
                }`}>
                  {player.isConnected ? 'Stable' : 'Lost'}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Achievements Earned */}
      {achievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg p-6 border border-yellow-400/30"
        >
          <div className="flex items-center gap-3 mb-4">
            <Award className="w-6 h-6 text-yellow-400" />
            <h3 className="text-xl font-bold text-yellow-400">Achievements Unlocked!</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {achievements.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.8 + index * 0.2, type: 'spring' }}
                className="bg-slate-800/50 rounded-lg p-4 flex items-center gap-3"
              >
                <div className="text-2xl">{achievement.icon}</div>
                <div>
                  <h4 className="font-bold text-white">{achievement.name}</h4>
                  <p className="text-sm text-gray-300">{achievement.description}</p>
                  <div className="text-xs text-yellow-400 font-medium">
                    +{achievement.points} points
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Game Summary */}
      <div className="bg-slate-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Game Summary</h3>
        <div className="grid sm:grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-400">{result.duration}s</div>
            <div className="text-sm text-gray-400">Game Duration</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">{result.totalMoves}</div>
            <div className="text-sm text-gray-400">Total Moves</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">
              {Math.round(stats.averageMovesPerMinute)}
            </div>
            <div className="text-sm text-gray-400">Moves/Min</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Performance Tab Component
const PerformanceTab: React.FC<{
  stats: GameStats;
  userId?: string;
}> = ({ stats, userId }) => {
  const userPerformance = stats.playerStats.find(p => p.playerId === userId);
  const opponentPerformance = stats.playerStats.find(p => p.playerId !== userId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Performance Comparison */}
      <div className="bg-slate-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-6">Performance Comparison</h3>
        
        <div className="space-y-4">
          <PerformanceBar
            label="Moves Played"
            userValue={userPerformance?.movesPlayed || 0}
            opponentValue={opponentPerformance?.movesPlayed || 0}
            maxValue={stats.totalMoves}
            userLabel="You"
            opponentLabel={opponentPerformance?.username || 'Opponent'}
          />
          
          {userPerformance?.averageMoveTime && opponentPerformance?.averageMoveTime && (
            <PerformanceBar
              label="Avg Move Time (s)"
              userValue={userPerformance.averageMoveTime}
              opponentValue={opponentPerformance.averageMoveTime}
              maxValue={Math.max(userPerformance.averageMoveTime, opponentPerformance.averageMoveTime)}
              userLabel="You"
              opponentLabel={opponentPerformance.username}
              lowerIsBetter
            />
          )}
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-700 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-4">Your Performance</h3>
          <div className="space-y-3">
            <StatItem label="Moves Played" value={userPerformance?.movesPlayed || 0} />
            <StatItem 
              label="Move Frequency" 
              value={`${Math.round(((userPerformance?.movesPlayed || 0) / stats.duration) * 60)}/min`} 
            />
            {userPerformance?.averageMoveTime && (
              <StatItem label="Avg. Think Time" value={`${userPerformance.averageMoveTime}s`} />
            )}
            <StatItem 
              label="Game Engagement" 
              value={`${Math.round(((userPerformance?.movesPlayed || 0) / stats.totalMoves) * 100)}%`} 
            />
          </div>
        </div>

        {opponentPerformance && (
          <div className="bg-slate-700 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-4">Opponent Performance</h3>
            <div className="space-y-3">
              <StatItem label="Moves Played" value={opponentPerformance.movesPlayed} />
              <StatItem 
                label="Move Frequency" 
                value={`${Math.round((opponentPerformance.movesPlayed / stats.duration) * 60)}/min`} 
              />
              {opponentPerformance.averageMoveTime && (
                <StatItem label="Avg. Think Time" value={`${opponentPerformance.averageMoveTime}s`} />
              )}
              <StatItem 
                label="Game Engagement" 
                value={`${Math.round((opponentPerformance.movesPlayed / stats.totalMoves) * 100)}%`} 
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Analysis Tab Component
const AnalysisTab: React.FC<{
  result: GameResultType;
  stats: GameStats;
}> = ({ result, stats }) => {
  const gameComplexity = stats.totalMoves > 20 ? 'Complex' : 
                        stats.totalMoves > 10 ? 'Moderate' : 'Simple';
  
  const gamePhases = [
    { name: 'Opening', moves: Math.min(stats.totalMoves, 3), percentage: 30 },
    { name: 'Mid-game', moves: Math.max(0, Math.min(stats.totalMoves - 3, 4)), percentage: 50 },
    { name: 'End-game', moves: Math.max(0, stats.totalMoves - 7), percentage: 20 }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Game Analysis */}
      <div className="bg-slate-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Game Analysis</h3>
        
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">{gameComplexity}</div>
            <div className="text-sm text-gray-400">Game Complexity</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              {Math.round(stats.averageMovesPerMinute)}
            </div>
            <div className="text-sm text-gray-400">Pace (moves/min)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-400">
              {result.result === 'win' ? 'Decisive' : 
               result.result === 'draw' ? 'Balanced' : 'Inconclusive'}
            </div>
            <div className="text-sm text-gray-400">Game Outcome</div>
          </div>
        </div>

        {/* Game Flow */}
        <div>
          <h4 className="text-lg font-medium text-white mb-3">Game Flow</h4>
          <div className="space-y-3">
            {gamePhases.map((phase) => (
              <div key={phase.name} className="flex items-center gap-4">
                <div className="w-20 text-sm text-gray-400">{phase.name}</div>
                <div className="flex-1 bg-slate-600 rounded-full h-2">
                  <div 
                    className="bg-blue-400 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${(phase.moves / stats.totalMoves) * 100}%` }}
                  />
                </div>
                <div className="text-sm text-white w-16 text-right">
                  {phase.moves} moves
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Match Insights */}
      <div className="bg-slate-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Match Insights</h3>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0" />
            <div>
              <div className="text-white font-medium">Game Duration</div>
              <div className="text-gray-400 text-sm">
                The game lasted {result.duration} seconds, which is {
                  result.duration > 300 ? 'longer than average' :
                  result.duration > 120 ? 'about average' : 'shorter than average'
                } for this game type.
              </div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0" />
            <div>
              <div className="text-white font-medium">Move Efficiency</div>
              <div className="text-gray-400 text-sm">
                {stats.totalMoves} total moves were made with an average of {Math.round(stats.averageMovesPerMinute)} moves per minute.
              </div>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
            <div>
              <div className="text-white font-medium">Game Outcome</div>
              <div className="text-gray-400 text-sm">
                {result.endReason}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Helper Components
const PerformanceBar: React.FC<{
  label: string;
  userValue: number;
  opponentValue: number;
  maxValue: number;
  userLabel: string;
  opponentLabel: string;
  lowerIsBetter?: boolean;
}> = ({ label, userValue, opponentValue, maxValue, userLabel, opponentLabel, lowerIsBetter = false }) => {
  const userPercentage = (userValue / maxValue) * 100;
  const opponentPercentage = (opponentValue / maxValue) * 100;
  
  const userIsBetter = lowerIsBetter ? userValue < opponentValue : userValue > opponentValue;

  return (
    <div>
      <div className="flex justify-between text-sm text-gray-400 mb-2">
        <span>{label}</span>
        <span>{userValue} vs {opponentValue}</span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-16 text-xs text-gray-400">{userLabel}</div>
          <div className="flex-1 bg-slate-600 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-1000 ${
                userIsBetter ? 'bg-green-400' : 'bg-blue-400'
              }`}
              style={{ width: `${userPercentage}%` }}
            />
          </div>
          <div className="text-xs text-white w-8 text-right">{userValue}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-16 text-xs text-gray-400">{opponentLabel}</div>
          <div className="flex-1 bg-slate-600 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-1000 ${
                !userIsBetter ? 'bg-green-400' : 'bg-red-400'
              }`}
              style={{ width: `${opponentPercentage}%` }}
            />
          </div>
          <div className="text-xs text-white w-8 text-right">{opponentValue}</div>
        </div>
      </div>
    </div>
  );
};

const StatItem: React.FC<{
  label: string;
  value: string | number;
}> = ({ label, value }) => (
  <div className="flex justify-between items-center">
    <span className="text-gray-400">{label}:</span>
    <span className="text-white font-medium">{value}</span>
  </div>
);

export default GameResult;
