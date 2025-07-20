import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Trophy, BarChart3, LogOut } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';

const Header: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { userStatistics, isConnected } = useGameStore();
  
  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-slate-800/95 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="text-2xl">🎮</div>
            <div>
              <h1 className="text-xl font-bold text-white">PUGG</h1>
              <p className="text-xs text-gray-400 -mt-1">Player's Unknown Games Grounds</p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isActive('/') 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Games</span>
            </Link>
            
            <Link
              to="/stats"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                isActive('/stats') 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Statistics</span>
            </Link>
          </nav>

          {/* User Info */}
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} 
                 title={isConnected ? 'Connected' : 'Disconnected'} 
            />
            
            {/* User Stats */}
            {userStatistics && (
              <div className="hidden sm:flex items-center gap-4 text-sm">
                <div className="text-center">
                  <div className="text-blue-400 font-bold">{userStatistics.eloRating}</div>
                  <div className="text-gray-400">ELO</div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 font-bold">{userStatistics.winRate}%</div>
                  <div className="text-gray-400">WR</div>
                </div>
              </div>
            )}

            {/* User Menu */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-white font-medium">{user?.username}</div>
                <div className="text-xs text-gray-400">#{userStatistics?.rank || '---'}</div>
              </div>
              
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
