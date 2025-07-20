import { create } from 'zustand';
import { GameRoom, GameState, Player } from '../types';
import { io, Socket } from 'socket.io-client';

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
}

interface GameStoreState {
  socket: Socket | null;
  isConnected: boolean;
  currentRoom: GameRoom | null;
  gameState: GameState | null;
  isMyTurn: boolean;
  gameTypes: GameType[];
  isLoadingGameTypes: boolean;
  
  // Actions
  connect: (token: string) => void;
  disconnect: () => void;
  fetchGameTypes: () => Promise<void>;
  createRoom: (gameType: string) => void;
  joinRoom: (roomCode: string) => void;
  makeMove: (move: any) => void;
  leaveRoom: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  socket: null,
  isConnected: false,
  currentRoom: null,
  gameState: null,
  isMyTurn: false,
  gameTypes: [],
  isLoadingGameTypes: false,

  fetchGameTypes: async () => {
    set({ isLoadingGameTypes: true });
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/games/types`);
      const data = await response.json();
      
      if (data.success) {
        set({ gameTypes: data.data });
      } else {
        console.error('Failed to fetch game types:', data.error);
      }
    } catch (error) {
      console.error('Error fetching game types:', error);
    } finally {
      set({ isLoadingGameTypes: false });
    }
  },

  connect: (token) => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001');
    
    socket.on('connect', () => {
      console.log('Connected to server');
      socket.emit('authenticate', token);
      set({ socket, isConnected: true });
    });

    socket.on('authenticated', (data) => {
      console.log('Authenticated:', data.user);
      // Fetch game types when connected
      get().fetchGameTypes();
    });

    socket.on('room-created', (data) => {
      set({
        currentRoom: {
          id: data.roomId,
          code: data.roomCode,
          gameType: data.gameType,
          players: data.players,
          status: 'waiting'
        }
      });
    });

    socket.on('player-joined', (data) => {
      set((state) => ({
        currentRoom: state.currentRoom ? {
          ...state.currentRoom,
          players: data.players
        } : null
      }));
    });

    socket.on('game-started', (gameState) => {
      set((state) => ({
        currentRoom: state.currentRoom ? {
          ...state.currentRoom,
          status: 'playing'
        } : null,
        gameState,
        isMyTurn: gameState.currentPlayer?.id === get().currentRoom?.players.find(p => p.socketId === socket.id)?.id
      }));
    });

    socket.on('move-made', (result) => {
      set({
        gameState: result.gameState,
        isMyTurn: result.nextPlayer?.id === get().currentRoom?.players.find(p => p.socketId === socket.id)?.id
      });
    });

    socket.on('game-ended', () => {
      set((state) => ({
        currentRoom: state.currentRoom ? {
          ...state.currentRoom,
          status: 'finished'
        } : null
      }));
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    socket.on('disconnect', () => {
      set({ isConnected: false });
    });
  },

  createRoom: async (gameType) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/games/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ gameType })
      });

      const data = await response.json();
      
      if (data.success) {
        // Socket will handle room creation events
        console.log('Room created:', data.data);
      } else {
        console.error('Failed to create room:', data.error);
      }
    } catch (error) {
      console.error('Error creating room:', error);
    }
  },
  
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
    }
    set({ socket: null, isConnected: false, currentRoom: null, gameState: null });
  },

  createRoom: (gameType) => {
    const { socket } = get();
    if (socket) {
      socket.emit('create-room', { gameType });
    }
  },

  joinRoom: (roomCode) => {
    const { socket } = get();
    if (socket) {
      socket.emit('join-room', { roomCode });
    }
  },

  makeMove: (move) => {
    const { socket } = get();
    if (socket) {
      socket.emit('make-move', { move });
    }
  },

  leaveRoom: () => {
    set({ currentRoom: null, gameState: null, isMyTurn: false });
  },
}));
