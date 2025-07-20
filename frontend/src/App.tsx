import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from './stores/authStore';
import { useGameStore } from './stores/gameStore';
import AuthForm from './components/AuthForm';
import GameLobby from './components/GameLobby';
import GameArea from './components/GameArea';

function App() {
  const { isAuthenticated, token, setAuth } = useAuthStore();
  const { connect, currentRoom, isConnected } = useGameStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on app start
    const savedToken = localStorage.getItem('token');
    if (savedToken && !isAuthenticated) {
      // You might want to verify the token with the server here
      // For now, we'll assume it's valid if it exists
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, setAuth]);

  useEffect(() => {
    // Connect to socket when authenticated
    if (isAuthenticated && token && !isConnected) {
      connect(token);
    }
  }, [isAuthenticated, token, isConnected, connect]);

  const handleAuthSuccess = () => {
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthForm onSuccess={handleAuthSuccess} />;
  }

  if (currentRoom?.status === 'playing') {
    return <GameArea />;
  }

  return <GameLobby />;
}

export default App;
