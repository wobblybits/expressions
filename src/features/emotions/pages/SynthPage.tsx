import type { Component } from 'solid-js';
import ExpressionModel from '../lib/ExpressionModel';
import EmotionModel from '../lib/EmotionModel';
import Controls from '../../../components/ui/Controls';
import ClientOnly from '~/lib/ClientOnly';

const SynthPage: Component = () => {
  const emotionModel = new EmotionModel();
  const expressionModel = new ExpressionModel(emotionModel);
  return (
    <div class='max-h-[80vh] p-4'>
        <h1>Synthesizing Facial Expressions</h1>
    <div class="flex flex-col items-center justify-center h-full gap-4">
      
      <div class="flex flex-row items-center justify-center h-full gap-4">
      <div class="explainer">
        <p>The underlying model for the <a href="./">various experiments</a> in this project was created in Python using emotion-tagged face-image datasets from <a href="https://www.kaggle.com/">Kaggle</a>.</p>
        <h2>First Pass</h2>
        <p>At first, a straight-forward <code>eigenface</code> approach was taken, using principal component analysis (<code>PCA</code>) to identify the "average" grayscale pixel-representations for each of the tagged emotions. Combining these through weighted addition creates composite images that in some sense correlate to more complex emotional expressions.</p>
        <img src="./artifacts/eigenfaces.gif" alt="Pixel-based eigenface approach" />
        <p>While simple, a pixel-based approach unfortunately has several drawbacks: 
        </p>
        <ul>
            <li>Many of the most significant PCA components are not expression-related, but rather represent variations in lighting, pose, skin color(!), and other factors. The input faces need to be as uniformly normalized as possible to limit these effects. (Spoiler Alert: This is never perfectly possible.)</li>
            <li>The very nature of facial expression is about spatial distortion of features, not pixel-value changes at specific image coordinates, which is inherently contradictory to the above needs.</li>
            <li>The PCA components need to be able to "cancel" each other out in superposition, which means many components are in an inverted grayscale. Humans are decidedly not unperturbed by such inversion.</li>
        </ul>
        <h2>Face Detection</h2>
        <p>In addition to grayscale-value adjustments like gamma correction, an attempt at improving this naive pixel-based approach was made using the <code>dlib</code> face detection library to better normalize the images through rotation, centering, scaling, and masking. Despite noticeable improvements, the fundamental issues with this approach were due to remain. While continuing to try to fine-tune and find workarounds like using <code>sobel</code> filters to detect edges, an epiphany came to use the <code>landmark point</code> coordinates from the face detection library as the data source itself. Instead of pixel-vector components, PCA could now produce coordinate-displacement vectors representing the emotions. This quickly solved almost every issue:</p>
        <ul>
            <li>Coordinates could easily be normalized through <code>affine transformations</code></li>
            <li>"Superficial" properties (lighting, skin-tone, etc.) now only effected the model in so much that they effected correct detection of faces (and could easily be skipped if problematic)</li>
            <li>The polarity of the displacement values had a clear interpretation in terms of direction of movement of individual landmarks</li>
            <li>Decisions on how to visualize the resulting expressions could now be made at will</li>
        </ul>
        <img src="./artifacts/synth.gif" alt="An early prototype interface using the 68-point dlib model" />
        <h2>Micro-Expressions</h2>
        <p>The <code>dlib</code> model used was comprised of 68 landmark points representing the key features of the eyes, nose, mouth, and outer boundaries of the face. The resulting emotional expression model appeared to successfully cover a wide range of composite emotions, but seemed limited in representing a few of the key primary emotions tagged in the dataset. Surprise and happiness, for example, were easily recognizable, due to the major changes in the size and shape of the eyes and mouth. But disgust was not. The model was unable to capture (or visualize) the "scrunching" of the face that occurs separate from the displacement of major features. More points were needed.</p>
        <h2>3D Rendering</h2>
        <p><code>MediaPipe</code>'s face detection model provides a 478-point landmark set, and so a new expression model was built using the same PCA process as before. Initially, additional landmarks were chosen to draw "wrinkles" on the two-dimensional visualization, but the "drawn-on" nature of this approach looked rather unnatural. Another aha moment came in realizing that MediaPipe's three-dimensional output could be rendered in the browser using <code>Three.js</code>. By switching to 3D rendering, light and shadow could naturally indicate more of the changes outside of major feature displacement. A <code>cel-shader</code> was used to give the model a simplified but "friendly" appearance, avoiding possible <code>uncanny valley</code> effects. These aesthetic choices could easily be changed in the rendering pipeline. And more excitingly, the underlying expression model could still be visualized in entirely different ways (cf. the <a href="./pareidolia">pareidolia</a> experiment).</p>
        <div class="image-row">
            <div>
                <img src="./artifacts/wrinkles.gif"></img>
            </div>
            <div>
                <img src="./artifacts/lineface.gif"></img>
            </div>
            <div>
                <img src="./artifacts/mask.gif"></img>
            </div>
        </div>
        <a class='footer-link' href="./arithmetic">Continue to the next experiment</a>
    </div>
        <ClientOnly>
            <Controls title="Demo" emotionModel={emotionModel} callback={() => {}}></Controls>
        </ClientOnly>
    </div>
    </div>
    </div>
  );
};

export default SynthPage;
