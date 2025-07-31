import type { Component } from 'solid-js';
import ExpressionModel from '../lib/ExpressionModel';
import EmotionModel from '../lib/EmotionModel';
import Game from '../emotions/Game';

const GamePage: Component = () => {
  const emotionModel = new EmotionModel();
  const expressionModel = new ExpressionModel(emotionModel);
  let size = 140;
  let gridSize = 24;
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
    }}>
      <Game id="game" width={Math.min(size*gridSize, window.innerWidth * .95, window.innerHeight * .95)} height={Math.min(size*gridSize, window.innerWidth * .95, window.innerHeight * .95)} expressionModel={expressionModel} gridSize={gridSize}/>
    </div>
  );
};

export default GamePage;
