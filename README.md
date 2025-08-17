# Facial Expressions

[![deploy](https://github.com/wobblybits/pareidolia/actions/workflows/deploy.yml/badge.svg)](https://github.com/wobblybits/pareidolia/actions/workflows/deploy.yml) [![The Recurse Center](https://img.shields.io/badge/created%20at-recurse%20center-white)](https://www.recurse.com/)

## Demonstrations

### [Expression Synthesizer](/synth)

![Expression Synthesizer](/preview/synth.gif)

A simple interface for controlling the expression of a 3d facemesh. Built using a vector displacement model trained on a a handful of tagged image datasets from [Kaggle](https://www.kaggle.com/). Early attempts used a pixel-based "eigenface" approach, then the dlib face detection model, and finally the 3d facemesh model from [MediaPipe](https://github.com/google/mediapipe). The displacement vectors were generated using principal component analysis.

### [Emotional Arithmetic Tables](/arithmetic)

![Emotional Arithmetic Tables](/preview/table.png)

Using the model created for the expression synthesizer, I was interested in visualizing the combinations of the 8 "primary" emotions and matching them to emotional vocabulary using analogous superposition of word vectors in a semantic embedding space.

### [Emotional Transference](/transference)

![Emotional Transference](/preview/transference.gif)

A grid-based time-step simulation that allows for simplified interactions between cells. Each cell comprises an internal emotional state visualized as a face, as well as a single "neuron" (weight matrix and bias vector) that "learns" to move towards a user-controlled "homeostasis" state (using gradient descent) while "training" on the emotional states of its neighbors.

### [Emotional Pareidolia](/pareidolia)

![Emotional Pareidolia](/preview/tree.gif)

A whimsical experiment in which the emotional expression model is applied to "face-like" static images using the same basic interface as the expression synthesizer. The image deformations are obtained using thin-plate spline calculations based on the same underlying vector displacement model.

### [Pareidolia Webcam Filter](/camera)

![Pareidolia Webcam Filter](/preview/peach.gif)

An extension of the pareidolia experiment that is untethered from the emotional expression model. Instead it uses facemesh displacement data directly from a user's webcam. The thin-plate spline calculations were optimized to run in real-time using a GPU. 