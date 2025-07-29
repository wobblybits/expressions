import type { Component } from 'solid-js';
import ExpressionModel from './lib/ExpressionModel';
import EmotionModel, { randomExpression, NoEmotion } from './lib/EmotionModel';
import Actor from './emotions/Actor';
import Face from './emotions/Face';
import Game from './emotions/Game';
import { For } from 'solid-js';

const App: Component = () => {
  const emotionModel = new EmotionModel();
  const expressionModel = new ExpressionModel(emotionModel);
  const emotions = {
    angry: 80,
    contempt: 120,
    disgust: 80,
    fear: 150,
    happy: 80,
    neutral: 80,
    sad: 50,
    surprise: 80,
  }
  let size = 140;
  let gridSize = 100;
  return (
    <div>
      {/* <table>
        <thead>
        <tr>
          <th></th>
          <For each={Object.keys(NoEmotion)}>
            { (column, columnIndex) => 
              <th>
                {column}
              </th> }
          </For>
        </tr>
        </thead>
        <tbody>
          <For each={Object.keys(NoEmotion)}>
            { (row, rowIndex) => <tr><td>{row}</td>
              <For each={Object.keys(NoEmotion)}>
                { (column, columnIndex) => 
                  <td>
                    <Face id={`face${rowIndex()}-${columnIndex()}`} width={size} height={size} expressionModel={expressionModel} emotionLevels={{[row]: emotions[row], [column]: emotions[column]}}/> 
                  </td> }
              </For>
            </tr> }
          </For>
        </tbody>
      </table>
      <div id="grid">
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>   
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
        <Actor id="actor" width={size} height={size} expressionModel={expressionModel} emotionLevels={randomExpression()}/>
      </div> */}
      <Game id="game" width={Math.min(size*gridSize, window.innerWidth, window.innerHeight)} height={Math.min(size*gridSize, window.innerWidth, window.innerHeight)} expressionModel={expressionModel} gridSize={gridSize}/>
    </div>
  );
};

export default App;
