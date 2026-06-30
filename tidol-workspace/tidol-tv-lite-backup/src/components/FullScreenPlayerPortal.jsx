import React from 'react';
import ReactDOM from 'react-dom';
import { usePlayer } from '../context/PlayerContext';
import FullScreenPlayer from './FullScreenPlayer';

const FullScreenPlayerPortal = () => {
  const { isFullScreenOpen } = usePlayer();

  if (!isFullScreenOpen) return null;

  // Renderizar fuera del DOM tree principal
  return ReactDOM.createPortal(
    <FullScreenPlayer />,
    document.body
  );
};

export default FullScreenPlayerPortal;
