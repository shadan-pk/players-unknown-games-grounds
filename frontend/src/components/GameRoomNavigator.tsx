import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';

const GameRoomNavigator = () => {
  const { currentRoom } = useGameStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentRoom && (currentRoom.status === 'waiting' || currentRoom.status === 'playing')) {
      navigate('/game', { replace: true });
    }
  }, [currentRoom, navigate]);

  return null;
};

export default GameRoomNavigator; 