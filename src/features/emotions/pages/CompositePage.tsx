import type { Component } from 'solid-js';
import ExpressionModel from '../lib/ExpressionModel';
import EmotionModel, { NoEmotion } from '../lib/EmotionModel';
import { For, createSignal, createEffect, onMount } from 'solid-js';
import Face from '../../../components/ui/face/Face';
import ClientOnly from '../../../lib/ClientOnly';
import Scene from '../../../lib/Scene';

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
  const scene = new Scene(140, 140); // Keep at 140x140
  
  // Track which faces are currently rendering
  const [renderingFaces, setRenderingFaces] = createSignal<Set<string>>(new Set());
  const [completedFaces, setCompletedFaces] = createSignal<Set<string>>(new Set());
  
  // Start with just the first face
  onMount(() => {
    setRenderingFaces(new Set(['face0-0']));
  });
  
  // Watch for completed faces and start the next one
  createEffect(() => {
    console.log('effect');
    const completed = completedFaces();
    const rendering = renderingFaces();
    
    // Find the next face to render
    for (let rowIndex = 0; rowIndex < Object.keys(NoEmotion).length; rowIndex++) {
      for (let columnIndex = 0; columnIndex < Object.keys(NoEmotion).length; columnIndex++) {
        const faceId = `face${rowIndex}-${columnIndex}`;
        
        if (!completed.has(faceId) && !rendering.has(faceId)) {
          // This face hasn't been started yet, start it
          setRenderingFaces(prev => new Set([...prev, faceId]));
          break;
        }
      }
    }
  });
  
  // Function to mark a face as completed (called via mutation observer)
  const markFaceComplete = (faceId: string) => {
    setCompletedFaces(prev => new Set([...prev, faceId]));
    setRenderingFaces(prev => {
      const newSet = new Set(prev);
      newSet.delete(faceId);
      return newSet;
    });
  };
  
  // Set up mutation observer to detect when faces finish rendering
  onMount(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (element.tagName === 'IMG' && (element as HTMLImageElement).src && (element as HTMLImageElement).src.startsWith('data:')) {
                // An image was added with a data URL, meaning a face finished rendering
                const faceContainer = element.closest('.face');
                if (faceContainer && faceContainer.id) {
                  markFaceComplete(faceContainer.id);
                }
              }
            }
          });
        }
      });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => observer.disconnect();
  });
  
  return (
    <div style={{
      width: '90vw',
      height: '95vh',
      display: 'flex',
      'align-items': 'center',
      'justify-content': 'center',
      'padding': '2em',
      'box-sizing': 'border-box'
    }}>
      <ClientOnly fallback={<div id='loading'></div>}>
        <div style={{
          'max-width': '100%',
          'max-height': '100%',
          'aspect-ratio': '1 / 1',
          'object-fit': 'contain',
          'margin-top': '2em'
        }}>
          <div id='composite-grid' style={{
            display: 'grid',
            'grid-template-columns': 'auto repeat(8, 1fr)',
            'grid-template-rows': 'auto repeat(8, 1fr)',
            gap: '2px',
            'align-items': 'center',
            'justify-items': 'center',
            'object-fit': 'contain'
          }}>
            {/* Header row */}
            <div class='grid-label'></div>
            <For each={Object.keys(NoEmotion)}>
              { (column, columnIndex) => 
                <div class='grid-label'>
                  <h4>{column}</h4>
                </div> }
            </For>
            
            {/* Data rows */}
            <For each={Object.keys(NoEmotion)}>
              { (row, rowIndex) => (
                <>
                  <div class='grid-label'>
                    <h4>{row}</h4>
                  </div>
                  <For each={Object.keys(NoEmotion)}>
                    { (column, columnIndex) => 
                      <div style={{
                        'background': 'white', 
                        'border': '1px solid black',
                        'min-width': '4em',
                        'min-height': '4em',
                        width: 'auto',
                        height: 'auto',
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        'object-fit': 'contain',
                        overflow: 'hidden',
                        'aspect-ratio': '1 / 1'
                      }}>
                        {renderingFaces().has(`face${rowIndex()}-${columnIndex()}`) ? (
                          <Face 
                            id={`face${rowIndex()}-${columnIndex()}`} 
                            width={140}
                            height={140}
                            expressionModel={expressionModel} 
                            emotionLevels={{[row]: emotions[row], [column]: emotions[column]}} 
                            scene={scene}
                          />
                        ) : (
                          <div style={{ 
                            width: '100%', 
                            height: '100%', 
                            background: '#333' 
                          }}></div>
                        )}
                      </div> }
                  </For>
                </>
              ) }
            </For>
          </div>
        </div>
      </ClientOnly>
    </div>
  );
};

export default CompositePage;
