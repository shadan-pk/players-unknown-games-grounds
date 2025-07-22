import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useGameStore } from './stores/gameStore';
import AuthForm from './components/AuthForm';
import GameLobby from './components/GameLobby';
import GameArea from './components/GameArea';
import GameResult from './components/GameResult';
import StatsDashboard from './components/StatsDashboard';
import MatchmakingQueue from './components/MatchmakingQueue';
import NotificationSystem from './components/NotificationSystem';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import { Toaster } from 'react-hot-toast';
import GameRoomNavigator from './components/GameRoomNavigator';

function App() {
  const { isAuthenticated, token, user, setAuth } = useAuthStore();
  const { 
    connect, 
    disconnect,
    currentRoom, 
    isConnected,
    showResultScreen,
    gameResult,
    gameStats,
    hideResultScreen,
    playAgain,
    isInQueue,
    searchingForMatch,
    notifications,
    error,
    setError
  } = useGameStore();
  
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing token on app start
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser && !isAuthenticated) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setAuth(parsedUser, savedToken);
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, [isAuthenticated, setAuth]);

  useEffect(() => {
    // Connect to socket when authenticated
    if (isAuthenticated && token && user && !isConnected) {
      try {
        connect(token, user.id);
      } catch (error) {
        console.error('Connection error:', error);
        setAppError('Failed to connect to game server');
      }
    }
  }, [isAuthenticated, token, user, isConnected, connect]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (isConnected) {
        disconnect();
      }
    };
  }, [isConnected, disconnect]);

  useEffect(() => {
    // Handle global errors
    if (error) {
      setAppError(error);
      // Clear error after showing it
      setTimeout(() => {
        setError(null);
        setAppError(null);
      }, 5000);
    }
  }, [error, setError]);

  const handleAuthSuccess = () => {
    setLoading(false);
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <h2 className="text-xl text-white font-medium">Loading PUGG...</h2>
          <p className="text-gray-400 mt-2">Player's Unknown Games Grounds</p>
        </motion.div>
      </div>
    );
  }

  // Authentication required
  if (!isAuthenticated) {
    return (
      <ErrorBoundary>
        <AuthForm onSuccess={handleAuthSuccess} />
        <Toaster 
          position="top-right"
          toastOptions={{
            className: 'bg-slate-800 text-white border border-slate-700',
          }}
        />
      </ErrorBoundary>
    );
  }

  // Main App Content
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
          {/* Global Header */}
          <Header />
          
          {/* Main Content */}
          <main className="relative">
            <GameRoomNavigator />
            <Routes>
              {/* Dashboard/Lobby Route */}
              <Route 
                path="/" 
                element={
                  currentRoom?.status === 'playing' ? (
                    <Navigate to="/game" replace />
                  ) : (
                    <GameLobby />
                  )
                } 
              />
              
              {/* Game Area Route */}
              <Route 
                path="/game" 
                element={
                  currentRoom && (currentRoom.status === 'waiting' || currentRoom.status === 'playing')
                    ? <GameArea />
                    : <Navigate to="/" replace />
                } 
              />
              
              {/* Statistics Dashboard Route */}
              <Route path="/stats" element={<StatsDashboard />} />
              
              {/* Redirect unknown routes to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* Overlays */}
            <AnimatePresence>
              {/* Matchmaking Queue Overlay */}
              {(isInQueue || searchingForMatch) && (
                <MatchmakingQueue />
              )}

              {/* Game Result Screen Overlay */}
              {showResultScreen && gameResult && gameStats && (
                <GameResult
                  result={gameResult}
                  stats={gameStats}
                  onContinue={hideResultScreen}
                  onPlayAgain={playAgain}
                />
              )}

              {/* Error Overlay */}
              {appError && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
                >
                  <motion.div
                    initial={{ scale: 0.8, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.8, y: 20 }}
                    className="bg-red-500/20 border border-red-500 rounded-lg p-6 max-w-md mx-4"
                  >
                    <div className="text-center">
                      <div className="text-4xl mb-4">⚠️</div>
                      <h3 className="text-xl font-bold text-red-400 mb-2">Connection Error</h3>
                      <p className="text-gray-300 mb-4">{appError}</p>
                      <button
                        onClick={() => {
                          setAppError(null);
                          if (!isConnected && token && user) {
                            connect(token, user.id);
                          }
                        }}
                        className="btn btn-primary"
                      >
                        Retry Connection
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Connection Status Indicator */}
            <AnimatePresence>
              {!isConnected && isAuthenticated && (
                <motion.div
                  initial={{ y: -100 }}
                  animate={{ y: 0 }}
                  exit={{ y: -100 }}
                  className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-2 z-40"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-pulse w-2 h-2 bg-white rounded-full"></div>
                    <span>Reconnecting to server...</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Notification System */}
          <NotificationSystem notifications={notifications} />
          
          {/* Toast Notifications */}
          <Toaster 
            position="top-right"
            toastOptions={{
              className: 'bg-slate-800 text-white border border-slate-700',
              duration: 4000,
            }}
          />
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
