import { Component } from 'solid-js';
import PageLayout from '../components/ui/PageLayout';

const About: Component = () => {
  return (
    <PageLayout 
      title="About" 
      description=""
    >
      <div class='flex flex-col items-center justify-center w-full h-full max-w-[90vw] p-12'>
        <h1>Feelings and Faces</h1>
        <p>This site represents a collection of related (and ongoing) projects that originated while in batch at the <a href="https://www.recurse.com/" target="_blank">Recurse Center</a>.
        <br/><br/>The impetus was to explore a domain where lay intuition is quite strong but where exact modeling is quite slippery -- like natural language -- but not so vast. The question of how to define emotions happened to stumble into the crosshairs. 
        <br/><br/>The theory of emotions is a topic I had enjoyed reading about in the past, especially since it sits at the intersection of many different disciplines including cultural anthropology, evolutionary biology, linguistics, health, and philosophy. A few impromptu conversations with fellow recurser <a href="https://www.gagekrause.com/" target="_blank">Gage Krause</a> (who is an awesome coder with an academic background in the philosophy of psychology) helped to germinate the ideas.
        <br/><br/>The following is a roughly chronological ordering of various implementations and experiments that have grown out of the initial idea.
        </p>
      </div>
      <div class='max-w-[90vw] m-auto grid grid-cols-3 gap-4 '>
        <div class='card'>
          <h2><a href="/synth">Expression Synthesizer</a></h2>
          <div class='content flex flex-col gap-0'>
          <div class="image"><img src="/preview/synth.gif" alt="Expression Synthesizer" /></div>
          <p>A simple interface for controlling the expression of a 3d facemesh. Built using a vector displacement model trained on a a handful of tagged image datasets from <a href="https://www.kaggle.com/" target="_blank">Kaggle</a>. Early attempts used a pixel-based "eigenface" approach, then the dlib face detection model, and finally the 3d facemesh model from <a href="https://github.com/google/mediapipe" target="_blank">MediaPipe</a>. The displacement vectors were generated using principal component analysis.</p>
          </div>
        </div>
        <div class='card'>
          <h2><a href="/table">Emotional Arithmetic Tables</a></h2>
          <div class='content flex flex-col gap-0'>
          <div class="image"><img src="/preview/table.png" alt="Emotional Arithmetic Tables" /></div>
          <p>Using the model created for the expression synthesizer, I was interested in visualizing the combinations of the 8 "primary" emotions and matching them to emotional vocabulary using analogous superposition of word vectors in a semantic embedding space.</p>
          </div>
        </div>
        <div class='card'>
          <h2><a href="/transference">Emotional Transference</a></h2>
          <div class='content flex flex-col gap-0'>
          <div class="image"><img src="/preview/transference.gif" alt="Emotional Transference" /></div>
          <p>A grid-based time-step simulation that allows for simplified interactions between cells. Each cell comprises an internal emotional state visualized as a face, as well as a single "neuron" (weight matrix and bias vector) that "learns" to move towards a user-controlled "homeostasis" state (using gradient descent) while "training" on the emotional states of its neighbors.</p>
          </div>
        </div>
        <div class='card'>
          <h2><a href="/pareidolia">Pareidolia</a></h2>
          <p>A whimsical experiment in which the emotional expression model is applied to "face-like" static images using the same basic interface as the expression synthesizer. The image deformations are obtained using thin-plate spline calculations based on the same underlying vector displacement model.</p>
        </div>
        <div class='card'>
          <h2><a href="/camera">Pareidolia Webcam Filter</a></h2>
          <div class='content flex flex-col gap-0'>
          <div class="image"><img src="/preview/peach.gif" alt="Pareidolia Webcam Filter" /></div>
          <p>An extension of the pareidolia experiment that is untethered from the emotional expression model. Instead it uses facemesh displacement data directly from a user's webcam. The thin-plate spline calculations were optimized to run in real-time using a GPU.</p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default About;