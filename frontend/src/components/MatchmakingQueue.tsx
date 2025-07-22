import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Zap, X, Target, TrendingUp } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';

const MatchmakingQueue: React.FC = () => {
  const {
    queueStatus,
    estimatedWaitTime,
    leaveMatchmakingQueue,
    searchingForMatch,
    isInQueue,
    currentMatchType,
    userStatistics,
    addNotification,
  } = useGameStore();

  const [waitTime, setWaitTime] = useState(0);
  const [queueAnimation, setQueueAnimation] = useState(0);

  useEffect(() => {
    // Reset wait time when joining queue
    if (isInQueue) {
      setWaitTime(0);
    }
  }, [isInQueue]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isInQueue && !searchingForMatch) {
      interval = setInterval(() => {
        setWaitTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isInQueue, searchingForMatch]);

  useEffect(() => {
    // Animate queue count changes
    let animationInterval: NodeJS.Timeout;
    if (typeof queueStatus?.playersInQueue === 'number' && queueStatus.playersInQueue > 0) {
      animationInterval = setInterval(() => {
        setQueueAnimation(prev => (prev + 1) % 3);
      }, 500);
    }
    return () => {
      if (animationInterval) clearInterval(animationInterval);
    };
  }, [queueStatus?.playersInQueue]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatEstimatedTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.ceil(seconds / 60);
    return `~${mins}m`;
  };

  const getQueueStatusText = () => {
    if (searchingForMatch) {
      return 'Match found! Preparing game...';
    }
    if (!queueStatus) {
      return 'Connecting to matchmaking...';
    }
    const { playersInQueue } = queueStatus;
    if (playersInQueue === 0) {
      return 'Waiting for players to join...';
    } else if (playersInQueue === 1) {
      return 'You are first in queue, waiting for opponent...';
    } else if (playersInQueue >= 2) {
      return 'Match will be created shortly...';
    }
    return `Searching for ${queueStatus.gameType} opponents...`;
  };

  const getQueuePriority = () => {
    if (!queueStatus || !waitTime) return 'Standard';
    if (waitTime > 120) return 'High Priority'; // 2+ minutes
    if (waitTime > 60) return 'Medium Priority'; // 1+ minute
    return 'Standard';
  };

  const getMatchmakingRange = () => {
    if (currentMatchType === 'casual') {
      return 'Any skill level';
    }
    const userElo = userStatistics?.eloRating || 1000;
    const expansion = Math.floor(waitTime / 30) * 50; // Expand by 50 every 30s
    const range = 100 + expansion;
    return `${Math.max(500, userElo - range)} - ${userElo + range} ELO`;
  };

  if (!isInQueue && !searchingForMatch) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 50 }}
        className="bg-slate-800 rounded-2xl p-8 max-w-lg w-full mx-4 border border-slate-700 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {searchingForMatch ? 'Match Found!' : 'Matchmaking'}
            </h2>
            <p className="text-sm text-gray-400 capitalize">
              {queueStatus?.gameType} • {currentMatchType} mode
            </p>
          </div>
          <button
            onClick={() => {
              leaveMatchmakingQueue();
              addNotification('Left matchmaking queue');
            }}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
            disabled={searchingForMatch}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Animation */}
        <div className="text-center mb-8">
          {searchingForMatch ? (
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="text-6xl mb-4"
            >
              ⚡
            </motion.div>
          ) : (
            <div className="relative mb-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"
              />
              {typeof queueStatus?.playersInQueue === 'number' && queueStatus.playersInQueue > 0 && (
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-8 h-8 flex items-center justify-center font-bold"
                >
                  {queueStatus.playersInQueue}
                </motion.div>
              )}
            </div>
          )}

          <p className="text-gray-300 mb-2">{getQueueStatusText()}</p>

          {waitTime > 30 && !searchingForMatch && (
            <p className="text-yellow-400 text-sm">
              Still searching... Expanding skill range for faster matching
            </p>
          )}
        </div>

        {/* Queue Info */}
        {queueStatus && !searchingForMatch && (
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-gray-400">Players in Queue</span>
                </div>
                <div className="text-xl font-bold text-white">
                  {queueStatus.playersInQueue}
                  {queueAnimation > 0 && (
                    <motion.span
                      animate={{ opacity: [1, 0.5, 1] }}
                      className="ml-1 text-blue-400"
                    >
                      {'•'.repeat(queueAnimation)}
                    </motion.span>
                  )}
                </div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-gray-400">Your Wait Time</span>
                </div>
                <div className="text-xl font-bold text-white">{formatTime(waitTime)}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Zap className="w-4 h-4" />
                  <span>Estimated Wait</span>
                </div>
                <span className="text-blue-400 font-medium">
                  {formatEstimatedTime(estimatedWaitTime)}
                </span>
              </div>

              {currentMatchType === 'ranked' && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <TrendingUp className="w-4 h-4" />
                    <span>Skill Range</span>
                  </div>
                  <span className="text-purple-400 font-medium text-xs">
                    {getMatchmakingRange()}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Target className="w-4 h-4" />
                  <span>Queue Priority</span>
                </div>
                <span
                  className={`font-medium text-xs ${
                    getQueuePriority() === 'High Priority'
                      ? 'text-orange-400'
                      : getQueuePriority() === 'Medium Priority'
                      ? 'text-yellow-400'
                      : 'text-gray-400'
                  }`}
                >
                  {getQueuePriority()}
                </span>
              </div>
            </div>

            {queueStatus.averageElo && currentMatchType === 'ranked' && (
              <div className="border-t border-slate-600 pt-3">
                <div className="text-xs text-gray-500 text-center">
                  Queue average ELO: {queueStatus.averageElo}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Match Found Actions */}
        {searchingForMatch && (
          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4 mb-6">
            <div className="text-center">
              <h3 className="text-green-400 font-bold mb-2">Match found!</h3>
              <p className="text-green-300 text-sm">Preparing your game, please wait...</p>
            </div>
          </div>
        )}

        {/* --- FIX: Remove accept/decline actions, just show loading spinner if searchingForMatch --- */}
        {searchingForMatch ? (
          <div className="flex justify-center items-center py-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full"
            />
            <span className="ml-4 text-green-300 font-medium">Joining game...</span>
          </div>
        ) : (
          <button
            onClick={() => {
              leaveMatchmakingQueue();
              addNotification('Left matchmaking queue');
            }}
            className="w-full flex items-center justify-center btn btn-secondary"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel Search
          </button>
        )}

        {/* Debug Info (Development Only) */}
        {process.env.NODE_ENV === 'development' && queueStatus && (
          <div className="mt-4 p-3 bg-slate-900 rounded text-xs text-gray-500">
            <details>
              <summary className="cursor-pointer mb-2">Debug Info</summary>
              <pre className="whitespace-pre-wrap">{JSON.stringify(queueStatus, null, 2)}</pre>
            </details>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default MatchmakingQueue;