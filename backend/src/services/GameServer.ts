import { Server, Socket } from 'socket.io';
import { GameRoom } from './GameRoom';
import { AuthService } from './AuthService';

export class GameServer {
  private io: Server;
  private gameRooms: Map<string, GameRoom> = new Map();
  private playerRooms: Map<string, string> = new Map(); // userId -> roomId

  constructor(server: any) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL,
        methods: ['GET', 'POST']
      }
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Socket connected: ${socket.id}`);

      socket.on('authenticate', async (token: string) => {
        try {
          const decoded = AuthService.verifyToken(token);
          socket.data.user = decoded;
          socket.emit('authenticated', { success: true, user: decoded });
        } catch (error) {
          socket.emit('auth-error', { message: 'Invalid token' });
        }
      });

      socket.on('create-room', async (data: { gameType: string }) => {
        if (!socket.data.user) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const { gameType } = data;
        const user = socket.data.user;
        
        const room = new GameRoom(gameType, user.userId, user.username);
        this.gameRooms.set(room.id, room);
        this.playerRooms.set(user.userId, room.id);

        socket.join(room.id);
        
        socket.emit('room-created', {
          roomId: room.id,
          roomCode: room.code,
          gameType: room.gameType,
          players: Array.from(room.players.values())
        });

        console.log(`Room created: ${room.code} by ${user.username}`);
      });

      socket.on('join-room', async (data: { roomCode: string }) => {
        if (!socket.data.user) {
          socket.emit('error', { message: 'Not authenticated' });
          return;
        }

        const room = this.findRoomByCode(data.roomCode);
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        const user = socket.data.user;
        const success = room.addPlayer(user.userId, user.username, socket.id);
        
        if (!success) {
          socket.emit('error', { message: 'Cannot join room' });
          return;
        }

        this.playerRooms.set(user.userId, room.id);
        socket.join(room.id);

        this.io.to(room.id).emit('player-joined', {
          players: Array.from(room.players.values()),
          canStart: room.canStart()
        });

        if (room.canStart()) {
          room.startGame();
          this.io.to(room.id).emit('game-started', room.getGameState());
        }

        console.log(`${user.username} joined room ${room.code}`);
      });

      socket.on('make-move', async (data: { move: any }) => {
        if (!socket.data.user) return;

        const roomId = this.playerRooms.get(socket.data.user.userId);
        if (!roomId) return;

        const room = this.gameRooms.get(roomId);
        if (!room) return;

        if (room.isValidMove(socket.data.user.userId, data.move)) {
          const result = room.processMove(socket.data.user.userId, data.move);
          
          this.io.to(room.id).emit('move-made', result);

          if (result.gameEnd?.isFinished) {
            this.handleGameEnd(room, result);
          }
        } else {
          socket.emit('invalid-move', { message: 'Invalid move' });
        }
      });

      socket.on('disconnect', () => {
        if (socket.data.user) {
          this.handlePlayerDisconnect(socket.data.user.userId, socket.id);
        }
        console.log(`Socket disconnected: ${socket.id}`);
      });
    });
  }

  private findRoomByCode(code: string): GameRoom | undefined {
    return Array.from(this.gameRooms.values()).find(room => room.code === code);
  }

  private async handleGameEnd(room: GameRoom, result: any) {
    setTimeout(() => {
      this.io.to(room.id).emit('game-ended', {
        winner: result.gameEnd.winner,
        type: result.gameEnd.type,
        reason: result.gameEnd.reason
      });
    }, 1000);

    // Clean up room after 30 seconds
    setTimeout(() => {
      this.gameRooms.delete(room.id);
      for (const [userId, roomId] of this.playerRooms) {
        if (roomId === room.id) {
          this.playerRooms.delete(userId);
        }
      }
    }, 30000);
  }

  private handlePlayerDisconnect(userId: string, socketId: string) {
    const roomId = this.playerRooms.get(userId);
    if (!roomId) return;

    const room = this.gameRooms.get(roomId);
    if (!room) return;

    // In a real implementation, you might want to pause the game
    // or give the player time to reconnect
    console.log(`Player ${userId} disconnected from room ${room.code}`);
  }
}
