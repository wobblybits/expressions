import type { Component } from 'solid-js';
import ExpressionModel from '../lib/threejs/ExpressionModel';
import EmotionModel from '../lib/EmotionModel';
import Game from '../components/threejs/Game';

const GamePage: Component = () => {
  const emotionModel = new EmotionModel();
  const expressionModel = new ExpressionModel(emotionModel);
  let size = 140;
  let gridSize = 16;
  return (
    <div class="flex flex-col items-center justify-center h-full gap-4 max-w-[95vw] text-center m-auto">
      <Game id="game" width={Math.min(size*gridSize, window.innerWidth * .95, window.innerHeight * .95)} height={Math.min(size*gridSize, window.innerWidth * .95, window.innerHeight * .95)} expressionModel={expressionModel} gridSize={gridSize}/>
      <div id="explainer">
        <p>This is a simple game.</p>
      </div>
    </div>
  );
};

export default GamePage;
