import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type { 
  GameResult, GameStats, PlayerGameStats, 
  MatchHistory, UserStatistics, Achievement, RatingHistory 
} from '../types/game';
import type { GameRoom, GameState } from '../types';
import { playSound } from '../utils/sounds';

export interface GameType {
  id: string;
  name: string;
  description: string;
  min_players: number;
  max_players: number;
  estimated_duration: string;
  difficulty_level: 'easy' | 'medium' | 'hard';
  icon?: string;
  rules?: string;
  tags?: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface QueueStatus {
  gameType: string;
  matchType: 'casual' | 'ranked';
  playersInQueue: number;
  averageElo: number;
  estimatedWaitTime: number; // in seconds
  isInQueue: boolean;
}

interface GameStoreState {
  // Connection
  socket: Socket | null;
  isConnected: boolean;
  
  // Game Types
  gameTypes: GameType[];
  isLoadingGameTypes: boolean;
  
  // Current Game Session
  currentRoom: GameRoom | null;
  gameState: GameState | null;
  isMyTurn: boolean;
  currentUserId: string | null;
  
  // Matchmaking
  isInQueue: boolean;
  queueStatus: QueueStatus | null;
  currentMatchType: 'casual' | 'ranked';
  searchingForMatch: boolean;
  estimatedWaitTime: number;
  
  // Game Results & Statistics
  gameResult: GameResult | null;
  gameStats: GameStats | null;
  showResultScreen: boolean;
  userStatistics: UserStatistics | null;
  matchHistory: MatchHistory[];
  ratingHistory: RatingHistory[];
  achievements: Achievement[];
  
  // UI State
  isLoading: boolean;
  error: string | null;
  notifications: string[];
  
  // Actions - Connection
  connect: (token: string, userId: string) => void;
  disconnect: () => void;
  
  // Actions - Game Types
  fetchGameTypes: () => Promise<void>;
  
  // Actions - Matchmaking
  joinMatchmakingQueue: (gameType: string, matchType: 'casual' | 'ranked') => Promise<void>;
  leaveMatchmakingQueue: () => void;
  acceptMatch: () => void;
  declineMatch: () => void;
  
  // Actions - Game Room
  createRoom: (gameType: string, matchType: 'casual' | 'ranked') => void;
  joinRoom: (roomCode: string) => void;
  leaveRoom: () => void;
  
  // Actions - Gameplay
  makeMove: (move: Record<string, unknown>) => void;
  forfeitGame: () => void;
  requestRematch: () => void;
  
  // Actions - Results & Stats
  setGameResult: (result: GameResult, stats: GameStats) => void;
  hideResultScreen: () => void;
  playAgain: () => void;
  fetchUserStatistics: (timeframe?: 'week' | 'month' | 'all', gameType?: string) => Promise<void>;
  fetchMatchHistory: (limit?: number, gameType?: string) => Promise<void>;
  fetchRatingHistory: (timeframe?: 'week' | 'month' | 'all', gameType?: string) => Promise<void>;
  fetchAchievements: () => Promise<void>;
  
  // Actions - UI
  setError: (error: string | null) => void;
  addNotification: (message: string) => void;
  clearNotifications: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  // Initial State
  socket: null,
  isConnected: false,
  gameTypes: [],
  isLoadingGameTypes: false,
  currentRoom: null,
  gameState: null,
  isMyTurn: false,
  currentUserId: null,
  isInQueue: false,
  queueStatus: null,
  currentMatchType: 'casual',
  searchingForMatch: false,
  estimatedWaitTime: 0,
  gameResult: null,
  gameStats: null,
  showResultScreen: false,
  userStatistics: null,
  matchHistory: [],
  ratingHistory: [],
  achievements: [],
  isLoading: false,
  error: null,
  notifications: [],

  // Connection Actions
  connect: (token, userId) => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    set({ currentUserId: userId });

    socket.on('connect', () => {
      console.log('Connected to server');
      set({ socket, isConnected: true, error: null });
      
      // Fetch initial data
      get().fetchGameTypes();
      get().fetchUserStatistics();
      get().fetchAchievements();
    });

    socket.on('authenticated', (data) => {
      console.log('Authenticated:', data.user);
      get().addNotification(`Welcome back, ${data.user.username}!`);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      set({ isConnected: false });
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        socket.connect();
      }
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      set({ error: error.message });
    });

    // Matchmaking Events
    socket.on('queue-joined', (data) => {
      set({ 
        isInQueue: true, 
        queueStatus: data.status,
        searchingForMatch: true,
        estimatedWaitTime: data.estimatedWaitTime
      });
      get().addNotification(`Joined ${data.gameType} ${data.matchType} queue`);
    });

    socket.on('queue-left', () => {
      set({ 
        isInQueue: false, 
        queueStatus: null,
        searchingForMatch: false,
        estimatedWaitTime: 0
      });
      get().addNotification('Left matchmaking queue');
    });

    socket.on('queue-status-update', (status) => {
      set({ queueStatus: status, estimatedWaitTime: status.estimatedWaitTime });
    });

    socket.on('match-found', () => {
      set({ searchingForMatch: false });
      get().addNotification(`Match found! Joining game...`);
      playSound('matchFound');
      
      // Auto-accept after 3 seconds if no response
      setTimeout(() => {
        if (get().isInQueue) {
          get().acceptMatch();
        }
      }, 3000);
    });

    socket.on('match-accepted', (data) => {
      set({ 
        isInQueue: false, 
        queueStatus: null,
        currentRoom: {
          id: data.sessionId,
          code: data.roomCode,
          gameType: data.gameType,
          players: data.players,
          status: 'starting',
          matchType: data.matchType
        }
      });
    });

    // Game Room Events
    socket.on('room-created', (data) => {
      set({
        currentRoom: {
          id: data.sessionId,
          code: data.roomCode,
          gameType: data.gameType,
          players: data.players,
          status: 'waiting',
          matchType: data.matchType || 'casual'
        }
      });
      get().addNotification(`Room created: ${data.roomCode}`);
    });

    socket.on('room-joined', (data) => {
      set({
        currentRoom: {
          id: data.sessionId,
          code: data.roomCode,
          gameType: data.gameType,
          players: data.players,
          status: 'waiting',
          matchType: data.matchType || 'casual'
        }
      });
      get().addNotification(`Joined room: ${data.roomCode}`);
    });

    socket.on('player-joined', (data) => {
      set((state) => ({
        currentRoom: state.currentRoom ? {
          ...state.currentRoom,
          players: data.players
        } : null
      }));
      
      const newPlayer = data.players[data.players.length - 1];
      get().addNotification(`${newPlayer.username} joined the room`);
      playSound('playerJoined');
    });

    socket.on('player-left', (data) => {
      set((state) => ({
        currentRoom: state.currentRoom ? {
          ...state.currentRoom,
          players: data.players
        } : null
      }));
      get().addNotification(`${data.playerName} left the room`);
    });

    socket.on('game-starting', () => {
      set((state) => ({
        currentRoom: state.currentRoom ? {
          ...state.currentRoom,
          status: 'starting'
        } : null
      }));
      get().addNotification('Game starting in 3 seconds...');
      playSound('gameStarting');
    });

    socket.on('game-started', (data) => {
      const { gameState } = data;
      
      set((state) => ({
        currentRoom: state.currentRoom ? {
          ...state.currentRoom,
          status: 'playing'
        } : null,
        gameState,
        isMyTurn: gameState.currentPlayerIndex !== undefined && 
                  gameState.players[gameState.currentPlayerIndex]?.id === userId
      }));
      
      get().addNotification('Game started! Good luck!');
      playSound('gameStart');
    });

    socket.on('move-made', (data) => {
      const { gameState, move, nextPlayer } = data;
      
      set({
        gameState,
        isMyTurn: nextPlayer?.id === userId
      });

      if (move.playerId !== userId) {
        get().addNotification(`${move.playerName} made a move`);
        playSound('opponentMove');
      }
    });

    socket.on('game-ended', (data) => {
      const { result, stats, achievements } = data;
      
      set((state) => ({
        currentRoom: state.currentRoom ? {
          ...state.currentRoom,
          status: 'finished'
        } : null,
        gameState: data.gameState
      }));

      // Update achievements if any were earned
      if (achievements && achievements.length > 0) {
        set((state) => ({
          achievements: [...state.achievements, ...achievements]
        }));
      }

      // Show result screen
      get().setGameResult(result, stats);
      
      // Update user statistics
      get().fetchUserStatistics();
      get().fetchMatchHistory(10);
    });

    socket.on('player-disconnected', (data) => {
      get().addNotification(`${data.playerName} disconnected`);
      
      if (data.gameWillEnd) {
        get().addNotification('You win by default due to opponent disconnection');
      }
    });

    socket.on('player-reconnected', (data) => {
      get().addNotification(`${data.playerName} reconnected`);
    });

    socket.on('rematch-requested', (data) => {
      get().addNotification(`${data.playerName} wants a rematch`);
      playSound('rematchRequest');
    });

    socket.on('rematch-accepted', () => {
      // Reset game state for new match
      set({
        gameState: null,
        gameResult: null,
        gameStats: null,
        showResultScreen: false
      });
      get().addNotification('Rematch starting...');
    });

    socket.on('notification', (data) => {
      get().addNotification(data.message);
      if (data.sound) {
        playSound(data.sound);
      }
    });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
    }
    set({ 
      socket: null, 
      isConnected: false, 
      currentRoom: null, 
      gameState: null,
      isInQueue: false,
      queueStatus: null,
      searchingForMatch: false
    });
  },

  // Game Types Actions
  fetchGameTypes: async () => {
    set({ isLoadingGameTypes: true, error: null });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/games/types`);
      const data = await response.json();
      
      if (data.success) {
        set({ gameTypes: data.data, isLoadingGameTypes: false });
      } else {
        set({ error: data.error || 'Failed to fetch game types', isLoadingGameTypes: false });
      }
    } catch (error) {
      console.error('Error fetching game types:', error);
      set({ error: 'Network error while fetching games', isLoadingGameTypes: false });
    }
  },

  // Matchmaking Actions
  joinMatchmakingQueue: async (gameType, matchType) => {
    const { socket } = get();
    if (!socket) return;

    set({ currentMatchType: matchType, isLoading: true });
    
    try {
      socket.emit('join-queue', { gameType, matchType });
    } catch (error) {
      console.error('Error joining queue:', error);
      set({ error: 'Failed to join matchmaking queue', isLoading: false });
    }
  },

  leaveMatchmakingQueue: () => {
    const { socket } = get();
    if (socket && get().isInQueue) {
      socket.emit('leave-queue');
    }
  },

  acceptMatch: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('accept-match');
    }
  },

  declineMatch: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('decline-match');
    }
  },

  // Game Room Actions
  createRoom: async (gameType, matchType = 'casual') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/games/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ gameType, matchType })
      });

      const data = await response.json();
      
      if (!data.success) {
        set({ error: data.error || 'Failed to create room' });
      }
    } catch (error) {
      console.error('Error creating room:', error);
      set({ error: 'Network error while creating room' });
    }
  },

  joinRoom: async (roomCode) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/games/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roomCode })
      });

      const data = await response.json();
      
      if (!data.success) {
        set({ error: data.error || 'Failed to join room' });
      }
    } catch (error) {
      console.error('Error joining room:', error);
      set({ error: 'Network error while joining room' });
    }
  },

  leaveRoom: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('leave-room');
    }
    set({ 
      currentRoom: null, 
      gameState: null, 
      isMyTurn: false,
      gameResult: null,
      gameStats: null,
      showResultScreen: false
    });
  },

  // Gameplay Actions
  makeMove: (move) => {
    const { socket, isMyTurn } = get();
    if (!socket || !isMyTurn) return;

    socket.emit('make-move', move);
    playSound('makeMove');
  },

  forfeitGame: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('forfeit-game');
      get().addNotification('You forfeited the game');
    }
  },

  requestRematch: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('request-rematch');
      get().addNotification('Rematch requested');
    }
  },

  // Results & Stats Actions
  setGameResult: (result, stats) => {
    set({ 
      gameResult: result, 
      gameStats: stats, 
      showResultScreen: true 
    });
    
    const { currentUserId } = get();
    
    // Play appropriate sound
    if (result.result === 'draw') {
      playSound('draw');
    } else if (result.winner?.id === currentUserId) {
      playSound('victory');
    } else {
      playSound('defeat');
    }
  },

  hideResultScreen: () => {
    set({ 
      showResultScreen: false, 
      gameResult: null, 
      gameStats: null 
    });
  },

  playAgain: () => {
    const { currentRoom } = get();
    if (currentRoom) {
      // For matchmaking games, join queue again
      if (currentRoom.matchType === 'ranked') {
        get().joinMatchmakingQueue(currentRoom.gameType, 'ranked');
      } else {
        get().joinMatchmakingQueue(currentRoom.gameType, 'casual');
      }
    }
    get().hideResultScreen();
  },

  fetchUserStatistics: async (timeframe = 'all', gameType = 'all') => {
    try {
      const { currentUserId } = get();
      const token = localStorage.getItem('token');
      
      if (!currentUserId || !token) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/stats/user/${currentUserId}?timeframe=${timeframe}&gameType=${gameType}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        set({ userStatistics: data });
      }
    } catch (error) {
      console.error('Error fetching user statistics:', error);
    }
  },

  fetchMatchHistory: async (limit = 20, gameType = 'all') => {
    try {
      const { currentUserId } = get();
      const token = localStorage.getItem('token');
      
      if (!currentUserId || !token) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/matches/history/${currentUserId}?limit=${limit}&gameType=${gameType}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        set({ matchHistory: data.matches || [] });
      }
    } catch (error) {
      console.error('Error fetching match history:', error);
    }
  },

  fetchRatingHistory: async (timeframe = 'month', gameType = 'all') => {
    try {
      const { currentUserId } = get();
      const token = localStorage.getItem('token');
      
      if (!currentUserId || !token) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/stats/rating-history/${currentUserId}?timeframe=${timeframe}&gameType=${gameType}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        set({ ratingHistory: data.history || [] });
      }
    } catch (error) {
      console.error('Error fetching rating history:', error);
    }
  },

  fetchAchievements: async () => {
    try {
      const { currentUserId } = get();
      const token = localStorage.getItem('token');
      
      if (!currentUserId || !token) return;

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/achievements/user/${currentUserId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        set({ achievements: data.achievements || [] });
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
  },

  // UI Actions
  setError: (error) => {
    set({ error });
    if (error) {
      console.error('Game Store Error:', error);
    }
  },

  addNotification: (message) => {
    set((state) => ({
      notifications: [...state.notifications, message]
    }));
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.slice(1)
      }));
    }, 5000);
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },
}));

// Helper function to get current user from the game store
export const getCurrentUser = () => {
  const { currentRoom, currentUserId } = useGameStore.getState();
  if (!currentRoom || !currentUserId) return null;
  
  return currentRoom.players.find((p: any) => p.id === currentUserId) || null;
};

// Helper function to get opponent
export const getOpponent = () => {
  const { currentRoom, currentUserId } = useGameStore.getState();
  if (!currentRoom || !currentUserId) return null;
  
  return currentRoom.players.find((p: any) => p.id !== currentUserId) || null;
};
