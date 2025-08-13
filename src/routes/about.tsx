import { Component } from 'solid-js';
import PageLayout from '../components/PageLayout';

const About: Component = () => {
  return (
    <PageLayout 
      title="About" 
      description="Learn about this interactive emotion and expression application"
    >
      <div class="p-8">
        <div class="max-w-4xl mx-auto">
          <section class="mb-8">
            <h2 class="text-xl font-semibold mb-4">Features</h2>
            <div class="grid md:grid-cols-2 gap-6">
              <div class="bg-gray-800 p-6 rounded-lg">
                <h3 class="text-lg font-medium mb-2">Real-time Camera Detection</h3>
                <p class="text-gray-300">
                  Advanced emotion recognition using your device's camera with real-time feedback and analysis.
                </p>
              </div>
              <div class="bg-gray-800 p-6 rounded-lg">
                <h3 class="text-lg font-medium mb-2">Interactive Games</h3>
                <p class="text-gray-300">
                  Challenge yourself with emotion-based games and improve your emotional expression skills.
                </p>
              </div>
              <div class="bg-gray-800 p-6 rounded-lg">
                <h3 class="text-lg font-medium mb-2">Pareidolia Visualization</h3>
                <p class="text-gray-300">
                  Explore the fascinating phenomenon of seeing faces in abstract patterns and emotional representations.
                </p>
              </div>
              <div class="bg-gray-800 p-6 rounded-lg">
                <h3 class="text-lg font-medium mb-2">Composite Emotion Matrices</h3>
                <p class="text-gray-300">
                  Visualize complex emotion combinations and understand how different feelings interact and blend.
                </p>
              </div>
            </div>
          </section>
          
          <section class="mb-8">
            <h2 class="text-xl font-semibold mb-4">Technology</h2>
            <div class="bg-gray-800 p-6 rounded-lg">
              <p class="text-gray-300 mb-4">
                This application uses cutting-edge web technologies including:
              </p>
              <ul class="list-disc list-inside space-y-2 text-gray-300">
                <li>MediaPipe for facial landmark detection</li>
                <li>Machine learning models for emotion classification</li>
                <li>WebGL and Three.js for 3D visualizations</li>
                <li>Real-time video processing and analysis</li>
                <li>Advanced mathematical transformations (TPS)</li>
              </ul>
            </div>
          </section>
          
          <section>
            <h2 class="text-xl font-semibold mb-4">Privacy</h2>
            <div class="bg-gray-800 p-6 rounded-lg">
              <p class="text-gray-300">
                All processing happens locally in your browser. No video data or images are transmitted to external servers. 
                Your camera feed is processed entirely on your device for maximum privacy and security.
              </p>
            </div>
          </section>
        </div>
      </div>
    </PageLayout>
  );
};

export default About;