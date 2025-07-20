import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Zap, X } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';

const MatchmakingQueue: React.FC = () => {
  const { 
    queueStatus, 
    estimatedWaitTime, 
    leaveMatchmakingQueue,
    searchingForMatch 
  } = useGameStore();
  
  const [waitTime, setWaitTime] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWaitTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
        className="bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-slate-700 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {searchingForMatch ? 'Match Found!' : 'Finding Match...'}
          </h2>
          <button
            onClick={leaveMatchmakingQueue}
            className="p-2 text-gray-400 hover:text-red-400 transition-colors"
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
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
            />
          )}
          
          <p className="text-gray-300">
            {searchingForMatch 
              ? 'Preparing your match...' 
              : `Searching for ${queueStatus?.gameType} opponents...`
            }
          </p>
        </div>

        {/* Queue Info */}
        {queueStatus && !searchingForMatch && (
          <div className="space-y-4 mb-6">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Users className="w-4 h-4" />
                <span>Players in queue</span>
              </div>
              <span className="text-white font-medium">{queueStatus.playersInQueue}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Clock className="w-4 h-4" />
                <span>Wait time</span>
              </div>
              <span className="text-white font-medium">{formatTime(waitTime)}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Zap className="w-4 h-4" />
                <span>Estimated</span>
              </div>
              <span className="text-blue-400 font-medium">
                ~{Math.ceil(estimatedWaitTime / 60)}m
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={leaveMatchmakingQueue}
            className="flex-1 btn btn-secondary"
          >
            Cancel Search
          </button>
          {searchingForMatch && (
            <button className="flex-1 btn btn-primary">
              Join Match
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MatchmakingQueue;
