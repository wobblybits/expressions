import type { Component } from 'solid-js';
import ExpressionModel from '../lib/ExpressionModel';
import EmotionModel, { NoEmotion } from '../lib/EmotionModel';
import { For } from 'solid-js';
import Face from '../../../components/ui/face/Face';
import ClientOnly from '../../../lib/ClientOnly';

const CompositePage: Component = () => {
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
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
    }}>
      <ClientOnly fallback={<div>Loading emotion matrix...</div>}>
        <table>
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
      </ClientOnly>
    </div>
  );
};

export default CompositePage;
