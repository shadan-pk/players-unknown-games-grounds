import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    Trophy, Target, Clock, TrendingUp, Award, 
    BarChart3, Activity 
  } from 'lucide-react';
import type { UserStatistics, MatchHistory, RatingHistory, Achievement } from '../types/game';
import { useAuthStore } from '../stores/authStore';

const StatsDashboard: React.FC = () => {
  const [stats, setStats] = useState<UserStatistics | null>(null);
  const [matchHistory, setMatchHistory] = useState<MatchHistory[]>([]);
  const [ratingHistory, setRatingHistory] = useState<RatingHistory[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month' | 'all'>('week');
  const [selectedGameType, setSelectedGameType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      fetchUserStatistics();
      fetchMatchHistory();
      fetchRatingHistory();
      fetchAchievements();
    }
  }, [user, selectedTimeframe, selectedGameType]);

  const fetchUserStatistics = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/stats/user/${user?.id}?timeframe=${selectedTimeframe}&gameType=${selectedGameType}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching user statistics:', error);
    }
  };

  const fetchMatchHistory = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/matches/history/${user?.id}?limit=20&gameType=${selectedGameType}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMatchHistory(data.matches || []);
      }
    } catch (error) {
      console.error('Error fetching match history:', error);
    }
  };

  const fetchRatingHistory = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/stats/rating-history/${user?.id}?timeframe=${selectedTimeframe}&gameType=${selectedGameType}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setRatingHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching rating history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAchievements = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/achievements/user/${user?.id}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAchievements(data.achievements || []);
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-white text-xl">No statistics available</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-4">Player Statistics</h1>
          
          {/* Filters */}
          <div className="flex gap-4">
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as 'week' | 'month' | 'all')}
              className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="all">All Time</option>
            </select>
            
            <select
              value={selectedGameType}
              onChange={(e) => setSelectedGameType(e.target.value)}
              className="bg-slate-700 text-white rounded px-3 py-2 border border-slate-600"
            >
              <option value="all">All Games</option>
              <option value="tictactoe">Tic Tac Toe</option>
              <option value="checkers">Checkers</option>
              <option value="chess">Chess</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Main Stats */}
          <div className="lg:col-span-8 space-y-8">
            {/* Overview Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Total Games"
                value={stats.totalGames}
                icon={<Target className="w-6 h-6" />}
                color="bg-blue-500"
              />
              <StatsCard
                title="Win Rate"
                value={`${stats.winRate}%`}
                icon={<Trophy className="w-6 h-6" />}
                color="bg-green-500"
              />
              <StatsCard
                title="Current Streak"
                value={stats.currentStreak}
                icon={<Activity className="w-6 h-6" />}
                color="bg-purple-500"
              />
              <StatsCard
                title="ELO Rating"
                value={stats.eloRating}
                icon={<TrendingUp className="w-6 h-6" />}
                color="bg-orange-500"
                subtitle={`Peak: ${stats.peakRating}`}
              />
            </div>

            {/* Rating Chart */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800 rounded-lg p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Rating Progress
                </h2>
                <div className="text-sm text-gray-400">
                  {ratingHistory.length} games tracked
                </div>
              </div>
              
              {ratingHistory.length > 0 ? (
                <RatingChart history={ratingHistory} />
              ) : (
                <div className="text-center text-gray-400 py-8">
                  No rating history available for selected timeframe
                </div>
              )}
            </motion.div>

            {/* Match History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-800 rounded-lg p-6"
            >
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Matches
              </h2>
              
              <div className="space-y-3">
                {matchHistory.slice(0, 10).map((match) => (
                  <MatchHistoryItem key={match.sessionId} match={match} />
                ))}
                
                {matchHistory.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    No match history available
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            {/* Player Rank */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-slate-800 rounded-lg p-6 text-center"
            >
              <div className="text-6xl mb-4">🏆</div>
              <h3 className="text-xl font-bold text-white mb-2">Global Rank</h3>
              <div className="text-3xl font-bold text-blue-400 mb-2">#{stats.rank}</div>
              <div className="text-gray-400 text-sm">out of all players</div>
              
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="text-sm text-gray-400">This {selectedTimeframe}</div>
                <div className="text-white font-medium">{stats.gamesThisWeek} games played</div>
              </div>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-slate-800 rounded-lg p-6"
            >
              <h3 className="text-lg font-bold text-white mb-4">Quick Stats</h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Wins</span>
                  <span className="text-green-400 font-bold">{stats.totalWins}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Losses</span>
                  <span className="text-red-400 font-bold">{stats.totalLosses}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Draws</span>
                  <span className="text-yellow-400 font-bold">{stats.totalDraws}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Best Streak</span>
                  <span className="text-purple-400 font-bold">{stats.bestStreak}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Hours Played</span>
                  <span className="text-blue-400 font-bold">{Math.round(stats.hoursPlayed * 10) / 10}h</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Favorite Game</span>
                  <span className="text-white font-bold">{stats.favoriteGame}</span>
                </div>
              </div>
            </motion.div>

            {/* Recent Achievements */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-slate-800 rounded-lg p-6"
            >
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Award className="w-5 h-5" />
                Recent Achievements
              </h3>
              
              <div className="space-y-3">
                {achievements.slice(0, 5).map((achievement) => (
                  <div key={achievement.id} className="flex items-center gap-3">
                    <div className="text-2xl">{achievement.icon}</div>
                    <div className="flex-1">
                      <div className="text-white font-medium">{achievement.name}</div>
                      <div className="text-xs text-gray-400">{achievement.description}</div>
                    </div>
                    {achievement.isNew && (
                      <div className="text-xs bg-yellow-500 text-black px-2 py-1 rounded">
                        NEW
                      </div>
                    )}
                  </div>
                ))}
                
                {achievements.length === 0 && (
                  <div className="text-center text-gray-400 py-4">
                    No achievements yet!<br />
                    <span className="text-sm">Play games to earn your first achievement</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper Components
const StatsCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}> = ({ title, value, icon, color, subtitle }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-slate-800 rounded-lg p-6"
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 rounded-lg ${color}`}>
        {icon}
      </div>
    </div>
    <div className="text-2xl font-bold text-white mb-1">{value}</div>
    <div className="text-gray-400 text-sm">{title}</div>
    {subtitle && (
      <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
    )}
  </motion.div>
);

const RatingChart: React.FC<{ history: RatingHistory[] }> = ({ history }) => {
  const maxRating = Math.max(...history.map(h => h.rating));
  const minRating = Math.min(...history.map(h => h.rating));
  const range = maxRating - minRating || 100;

  return (
    <div className="h-64 relative">
      <svg className="w-full h-full">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((percent) => (
          <line
            key={percent}
            x1="0"
            y1={`${percent * 100}%`}
            x2="100%"
            y2={`${percent * 100}%`}
            stroke="rgb(71 85 105)"
            strokeWidth="1"
            opacity="0.3"
          />
        ))}
        
        {/* Rating line */}
        <polyline
          points={history.map((point, index) => {
            const x = (index / (history.length - 1)) * 100;
            const y = ((maxRating - point.rating) / range) * 100;
            return `${x},${y}`;
          }).join(' ')}
          fill="none"
          stroke="rgb(59 130 246)"
          strokeWidth="2"
        />
        
        {/* Data points */}
        {history.map((point, index) => {
          const x = (index / (history.length - 1)) * 100;
          const y = ((maxRating - point.rating) / range) * 100;
          return (
            <circle
              key={index}
              cx={`${x}%`}
              cy={`${y}%`}
              r="3"
              fill={point.change > 0 ? 'rgb(34 197 94)' : point.change < 0 ? 'rgb(239 68 68)' : 'rgb(156 163 175)'}
            />
          );
        })}
      </svg>
      
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-400 -ml-12">
        <span>{maxRating}</span>
        <span>{Math.round(minRating + range * 0.75)}</span>
        <span>{Math.round(minRating + range * 0.5)}</span>
        <span>{Math.round(minRating + range * 0.25)}</span>
        <span>{minRating}</span>
      </div>
    </div>
  );
};

const MatchHistoryItem: React.FC<{ match: MatchHistory }> = ({ match }) => {
  const getResultColor = () => {
    switch (match.result) {
      case 'win': return 'text-green-400 bg-green-500/20 border-green-400/30';
      case 'loss': return 'text-red-400 bg-red-500/20 border-red-400/30';
      case 'draw': return 'text-yellow-400 bg-yellow-500/20 border-yellow-400/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-400/30';
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
      <div className="flex items-center gap-4">
        <div className={`px-3 py-1 rounded-full border text-xs font-bold uppercase ${getResultColor()}`}>
          {match.result}
        </div>
        
        <div>
          <div className="text-white font-medium capitalize">{match.gameType}</div>
          <div className="text-sm text-gray-400">
            vs {match.opponent} • {formatDuration(match.duration)}
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <div className={`font-bold ${match.eloChange > 0 ? 'text-green-400' : match.eloChange < 0 ? 'text-red-400' : 'text-gray-400'}`}>
          {match.eloChange > 0 ? '+' : ''}{match.eloChange}
        </div>
        <div className="text-xs text-gray-400">
          {new Date(match.createdAt).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};

export default StatsDashboard;
