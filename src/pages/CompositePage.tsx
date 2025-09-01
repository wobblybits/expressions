import type { Component } from 'solid-js';
import ExpressionModel from '../lib/threejs/ExpressionModel';
import EmotionModel, { EmotionLevels, NoEmotion } from '../lib/EmotionModel';
import { For, createSignal, createEffect, onMount } from 'solid-js';
import Face from '../components/threejs/Face';
import ClientOnly from '../components/ui/ClientOnly';
import Scene from '../lib/threejs/Scene';
import { Embedding } from '../lib/Embedding';
import Controls from '../components/ui/Controls';

const CompositePage: Component = () => {
  const emotionModel = new EmotionModel();
  const expressionModel = new ExpressionModel(emotionModel);
  const [emotionLevels, setEmotionLevels] = createSignal<EmotionLevels>(NoEmotion);
  const embedding = new Embedding();
  let labelRef : HTMLSpanElement | undefined;
  const emotions = {
    // angry: 80,
    // contempt: 120,
    // disgust: 80,
    // fear: 150,
    // happy: 80,
    // neutral: 80,
    // sad: 50,
    // surprise: 80,
    angry: 100,
    contempt: 100,
    disgust: 100,
    fear: 100,
    happy: 100,
    neutral: 100,
    sad: 100,
    surprise: 100,
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
    labelRef = document.querySelector("#expression-label");
    labelRef.innerHTML = embedding.getClosestWord(NoEmotion) || "(no expression)";
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
    <div class='max-w-full p-4'>
        {/* <h1>Faces & Feelings ~ Emotional Arithmetic Tables</h1> */}

      <div class="flex flex-row items-center justify-center h-full gap-4">
        <div class='max-h-[95vh] overflow-y-auto'>
      <div class='max-w-[80vh] max-h-[100vh] aspect-square object-contain'>
        <ClientOnly>
          <div id='composite-grid' style={{
            display: 'grid',
            'grid-template-columns': 'auto repeat(8, 1fr)',
            'grid-template-rows': 'auto repeat(8, 1fr)',
            gap: '2px',
            'align-items': 'center',
            'justify-items': 'center',
            'object-fit': 'contain',
            margin: 'auto',

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
                      <div class='grid-face-wrapper'style={{
                        'background': 'white', 
                        'border': '1px solid black',
                        'min-width': '6.2em',
                        'min-height': '6.3em',
                        width: 'auto',
                        height: 'auto',
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'center',
                        'object-fit': 'contain',
                        overflow: 'hidden',
                        // 'aspect-ratio': '1 / 1',
                        'position': 'relative'
                      }}
                      onMouseEnter={() => {
                        labelRef.innerHTML = embedding.getClosestWord({[row]: emotions[row], [column]: emotions[column]});
                        setEmotionLevels({[row]: emotions[row], [column]: emotions[column]});
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
                            background: '#333',
                          }}></div>
                        )}
                        <span style={{
                          position: 'absolute', 
                          bottom: 0,
                          'font-size': '10px'
                        }}>{embedding.getClosestWord({[row]: emotions[row], [column]: emotions[column]})}</span>
                      </div> }
                  </For>
                </>
              ) }
            </For>
          </div>
      </ClientOnly>
      </div>
      <br></br>
        <div class='explainer' style={{ height: 'auto', 'max-height': 'none', 'overflow-y': 'auto' }}>
          <p>
            So the base model for <a href="./synth">synthesizing facial expressions</a> uses the eight "primary emotions" that were tagged in the original image datasets. For each of these emotions, the model provides a vector of three-dimensional landmark displacements. Any weighted combination of these eight vectors gives us a new vector that can also be visually rendered as a face. There is not a objective way to verify that the result is "correct". In the vocabulary of statistics, we have "reliable" results but we can't say much about their conceptual "validity". At the same time, as humans we might feel that there is a lot of intuitive machinery that gets activated to reason about what a combination of basic emotions "should" look like. How can we try to capture that intuition to better understand the validity of the compositional results of this model?
          </p>
          <p>
            Facial expressions are only one way to approach the modeling of emotions. Language is another. When we try to use human intuition to understand how complex emotions might arise from the combination of primary emotions, we might already be trying to reason about them linguistically. What would it mean for someone to feel happy and surprised at the same time? It is unlikely that we directly calculate how each of these emotions is enacted by the musculature of the face. Instead we might try to leverage our linguistic faculties and first try to guess what that combination would be called. If we can arrive at a guess, let's say "delight", we might then be able to reason about what a delighted face should look like. So how can we bring this alternative knowledge to bear on our displacement vectors? Word vectors!
          </p>
          <p> 
            The desire to be able to "do math" on natural language is not new. It immediately arises once text data is stored on computers, even if it's not clear what it would mean to "do math" on natural language. You probably need to test if two pieces of text are equivalent, sure. You probably also want to be able to tell if one piece of text contains another. Then you might want to know how similar two pieces of text are to each other. And then can you use that sense of similarity to search a set of documents for terms or phrases and return the "best" results? It is no surprise that search became one of the most important and competitive areas of the early internet era. At it's core, it is a way to give numerical answers to textual input where the numbers capture something "meaningful". And it is no surprise that a new way of "doing math" on natural language (LLMs) has now threatened the primacy of search. It is also now surprise that the real advancement of LLMs came by completing the other side of circuit -- turning numbers back into language in a way that captures something meaningful. Anyways, one of the fundamental concepts that has developed along the way is the notion of "semantic embedding," where words are represented as high-dimensional vectors.
          </p>
          <p>
            In the same way that we turned facial expressions into vectors added them together and then turned them back into facial expressions, words can be turned into vectors added together and then turned back into words. So one possible answer to the question of whether or not there is alignment between visual reasoning and linguistic reasoning about emotions immediately presents itself. Since our facial expressions are just composites of eight primary emotions, what happens if we just do the same thing with the word vectors for those very same primary emotions? 
          </p>
      </div>
      </div>
      

      <ClientOnly>
        <Controls title="Demo" emotionModel={emotionModel} emotionLevelsSignal={[emotionLevels, setEmotionLevels]} callback={(emotionLevels: EmotionLevels) => {
          labelRef.innerHTML = embedding.getClosestWord(emotionLevels) || "(no expression)";
        }}>
        </Controls>
      </ClientOnly>

      </div>
    </div>
  );
};

export default CompositePage;
