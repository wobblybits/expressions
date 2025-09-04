import type { Component } from "solid-js";
import ExpressionModel from "../lib/threejs/ExpressionModel";
import EmotionModel, { EmotionLevels, NoEmotion } from "../lib/EmotionModel";
import { For, createSignal, createEffect, onMount } from "solid-js";
import Face from "../components/threejs/Face";
import ClientOnly from "../components/ui/ClientOnly";
import Scene from "../lib/threejs/Scene";
import { Embedding } from "../lib/Embedding";
import Controls from "../components/ui/Controls";

const CompositePage: Component = () => {
  const emotionModel = new EmotionModel();
  const expressionModel = new ExpressionModel(emotionModel);
  const [emotionLevels, setEmotionLevels] =
    createSignal<EmotionLevels>(NoEmotion);
  const embedding = new Embedding();
  let labelRef: HTMLSpanElement | undefined;
  const initialEmotions = {
    angry: 100,
    contempt: 80,
    disgust: 80,
    fear: 100,
    happy: 100,
    neutral: 80,
    sad: 70,
    surprise: 90,
    // angry: 100,
    // contempt: 100,
    // disgust: 100,
    // fear: 100,
    // happy: 100,
    // neutral: 100,
    // sad: 100,
    // surprise: 100,
  };
  const scene = new Scene(140, 140); // Keep at 140x140

  const rowEmotions = Object.keys(initialEmotions).reduce((acc, d) => { acc[d] = createSignal(initialEmotions[d]); return acc; }, {});
  const columnEmotions = Object.keys(initialEmotions).reduce((acc, d) => { acc[d] = createSignal(initialEmotions[d]); return acc; }, {});
  


  // Track which faces are currently rendering
  const [renderingFaces, setRenderingFaces] = createSignal<Set<string>>(
    new Set()
  );
  const [completedFaces, setCompletedFaces] = createSignal<Set<string>>(
    new Set()
  );

  // Start with just the first face
  onMount(() => {
    setRenderingFaces(new Set(["face0-0"]));
  });

  // Watch for completed faces and start the next one
  createEffect(() => {
    console.log("effect");
    const completed = completedFaces();
    const rendering = renderingFaces();

    // Find the next face to render
    for (
      let rowIndex = 0;
      rowIndex < Object.keys(NoEmotion).length;
      rowIndex++
    ) {
      for (
        let columnIndex = 0;
        columnIndex < Object.keys(NoEmotion).length;
        columnIndex++
      ) {
        const faceId = `face${rowIndex}-${columnIndex}`;

        if (!completed.has(faceId) && !rendering.has(faceId)) {
          // This face hasn't been started yet, start it
          setRenderingFaces((prev) => new Set([...prev, faceId]));
          break;
        }
      }
    }
  });

  // Function to mark a face as completed (called via mutation observer)
  const markFaceComplete = (faceId: string) => {
    setCompletedFaces((prev) => new Set([...prev, faceId]));
    setRenderingFaces((prev) => {
      const newSet = new Set(prev);
      newSet.delete(faceId);
      return newSet;
    });
  };

  // Set up mutation observer to detect when faces finish rendering
  onMount(() => {
    labelRef = document.querySelector("#expression-label");
    labelRef.innerHTML =
      embedding.getClosestWord(NoEmotion) || "(no expression)";
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              if (
                element.tagName === "IMG" &&
                (element as HTMLImageElement).src &&
                (element as HTMLImageElement).src.startsWith("data:")
              ) {
                // An image was added with a data URL, meaning a face finished rendering
                const faceContainer = element.closest(".face");
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
    <div class="max-w-full p-4">
      {/* <h1>Faces & Feelings ~ Emotional Arithmetic Tables</h1> */}

      <div class="flex flex-row items-center justify-center h-full gap-4">
        <div class="w-[80vw] max-h-[100vh] overflow-y-auto">
          <div class="max-w-[95vh] max-h-[100vh] flex-growaspect-square object-contain m-auto">
            <ClientOnly>
              <div
                id="composite-grid"
                style={{
                  display: "grid",
                  "grid-template-columns": "auto repeat(8, 1fr)",
                  "grid-template-rows": "auto repeat(8, 1fr)",
                  gap: "2px",
                  "align-items": "center",
                  "justify-items": "center",
                  "object-fit": "contain",
                  margin: "auto",
                }}
              >
                {/* Header row */}
                <div class="grid-label"></div>
                <For each={Object.keys(NoEmotion)}>
                  {(column, columnIndex) => (
                    <div class="grid-label">
                      <h4>{column}</h4>
                        <input type="range" min="-100" max="100" value={columnEmotions[column][0]()} oninput={(e) => {
                        columnEmotions[column][1](parseInt(e.target.value));
                      }}/>
                    </div>
                  )}
                </For>

                {/* Data rows */}
                <For each={Object.keys(NoEmotion)}>
                  {(row, rowIndex) => (
                    <>
                      <div class="grid-label">
                        <h4>{row}</h4><br/>
                        <input style={{
                          width: "6.5em",
                          transform: "rotate(-90deg)",
                          "margin-left": "1px",
                          "margin-top": "calc(1em + 5px)",
                        }} type="range" min="-100" max="100" value={rowEmotions[row][0]()} oninput={(e) => {
                        rowEmotions[row][1](parseInt(e.target.value));
                      }}/>
                      </div>
                      <For each={Object.keys(NoEmotion)}>
                        {(column, columnIndex) => (
                          <div
                            class="grid-face-wrapper"
                            style={{
                              background: "white",
                              border: "1px solid black",
                              "min-width": "5.0em",
                              "min-height": "6.5em",
                              width: "auto",
                              height: "auto",
                              display: "flex",
                              "align-items": "center",
                              "justify-content": "center",
                              "object-fit": "contain",
                              overflow: "hidden",
                              // 'aspect-ratio': '1 / 1',
                              position: "relative",
                            }}
                            onClick={() => {
                              labelRef.innerHTML = embedding.getClosestWord({
                                [row]: rowEmotions[row][0](),
                                [column]: columnEmotions[column][0](),
                              });
                              setEmotionLevels({
                                [row]: rowEmotions[row][0](),
                                [column]: columnEmotions[column][0](),
                              });
                            }}
                          >
                            {renderingFaces().has(
                              `face${rowIndex()}-${columnIndex()}`
                            ) ? (
                              <Face
                                id={`face${rowIndex()}-${columnIndex()}`}
                                width={140}
                                height={140}
                                expressionModel={expressionModel}
                                emotionLevels={{
                                  [row]: rowEmotions[row][0](),
                                  [column]: columnEmotions[column][0](),
                                }}
                                scene={scene}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  background: "#333",
                                }}
                              ></div>
                            )}
                            <span
                              style={{
                                position: "absolute",
                                bottom: 0,
                                "font-size": "10px",
                              }}
                            >
                              {embedding.getClosestWord({
                                [row]: rowEmotions[row][0](),
                                [column]: columnEmotions[column][0](),
                              })}
                            </span>
                          </div>
                        )}
                      </For>
                    </>
                  )}
                </For>
              </div>
            </ClientOnly>
          </div>
        </div>

        <ClientOnly>
          <Controls
            title="Demo"
            emotionModel={emotionModel}
            emotionLevelsSignal={[emotionLevels, setEmotionLevels]}
            callback={(emotionLevels: EmotionLevels) => {
              labelRef.innerHTML =
                embedding.getClosestWord(emotionLevels) || "(no expression)";
            }}
          ></Controls>
        </ClientOnly>
      </div>
      <br />
      <div
        class="explainer"
        style={{ height: "auto", "max-height": "none", "overflow-y": "auto" }}
      >
        <p>
          So the base model for{" "}
          <a href="./synth">synthesizing facial expressions</a> uses the eight
          "primary emotions" that were tagged in the original image datasets.
          For each of these emotions, the model provides a vector of
          three-dimensional landmark displacements. Any weighted combination of
          these eight vectors gives us a new vector that can also be visually
          rendered as a face. There is not a objective way to verify that the
          result is "correct". In the vocabulary of statistics, we have
          "reliable" results but we can't say much about their conceptual
          "validity". At the same time, as humans we might feel that there is a
          lot of intuitive machinery that gets activated to reason about what a
          combination of basic emotions "should" look like. How can we try to
          capture that intuition to better understand the validity of the
          compositional results of this model?
        </p>
        <p>
          Facial expressions are only one way to approach the modeling of
          emotions. Language is another. When we try to use human intuition to
          understand how complex emotions might arise from the combination of
          primary emotions, we might already be trying to reason about them
          linguistically. What would it mean for someone to feel happy and
          surprised at the same time? It is unlikely that we directly calculate
          how each of these emotions is enacted by the musculature of the face.
          Instead we might try to leverage our linguistic faculties and first
          try to guess what that combination would be called. If we can arrive
          at a guess, let's say "delight", we might then be able to reason about
          what a delighted face should look like. So how can we bring this
          alternative knowledge to bear on our displacement vectors? Word
          vectors!
        </p>
        <p>
          The desire to be able to "do math" on natural language is not new. It
          immediately arises once text data is stored on computers, even if it's
          not clear what it would mean to "do math" on natural language. You
          probably need to test if two pieces of text are equivalent, sure. You
          probably also want to be able to tell if one piece of text contains
          another. Then you might want to know how similar two pieces of text
          are to each other. And then can you use that sense of similarity to
          search a set of documents for terms or phrases and return the "best"
          results? It is no surprise that search became one of the most
          important and competitive areas of the early internet era. At it's
          core, it is a way to give numerical answers to textual input where the
          numbers capture something "meaningful". And it is no surprise that a
          new way of "doing math" on natural language (LLMs) has now threatened
          the primacy of search. It is also now surprise that the real
          advancement of LLMs came by completing the other side of circuit --
          turning numbers back into language in a way that captures something
          meaningful. Anyways, one of the fundamental concepts that has
          developed along the way is the notion of "semantic embedding," where
          words are represented as high-dimensional vectors.
        </p>
        <p>
          In the same way that we turned facial expressions into vectors, added
          them together, and then turned them back into facial expressions,
          words can also be turned into vectors added together and then turned
          back into words. So one possible answer to the question of whether or
          not we can assess for alignment between visual reasoning and
          linguistic reasoning about emotions immediately presents itself. Since
          our facial expressions are just composites of eight primary emotions,
          what happens if we just do the same thing with the word vectors for
          those very same primary emotions?
        </p>
        <p>
          One issue that is evident from the get-go is that there is clearly a
          deep inconsistency in our linguistic intuition. The "primary emotions"
          that were designated for the image training data (across multiple such
          research publications) do not even agree on part of speech. Some are
          nouns, like "disgust", and some are adjectives like "angry." While it
          might seem like this is something that could be easily remedied, are
          we really sure that a "neutral" emotion is the same thing as the
          emotion of "neutrality," for example. I ended up trying to split the
          difference as follows:
        </p>
        <p>
          To begin, I assembled a list of around 800 emotional vocabulary items.
          The vast majority of these are single words, but some are hyphenated
          compounds (e.g. "light-hearted") while others are multi-word phrases
          (e.g. "ticked off"). I did not prejudicially filter this word list by
          part of speech. To create the embedding space, I used a
          sentence-transformer model so that the single words, compound words,
          and multi-word phrases would all all be treated the same way. I chose
          the pretrained{" "}
          <a href="https://huggingface.co/sentence-transformers/all-mpnet-base-v2">
            all-mpnet-base-v2
          </a>{" "}
          model, which is a 768-dimensional embedding space and considered to
          have the highest quality of the original models published by SBERT.
          Performance was not a major consideration since I only needed to
          transform this relatively small list of words once to produce a JSON
          file that can be reused later.
        </p>
        <p>
          Once each of the vocabulary items had been vectorized, I then computed
          the vector projections onto a reduced set of 8 dimensions, one for
          each of the primary emotions. This is where I chose to split the
          difference between nouns and adjectives. Rather than use the
          inconsistent labeling as the primary emotions, I chose adjectival
          forms as the axes to project upon (e.g. "fearful" instead of "fear").
          Because "fear" is still included as an item in the vocabulary, the
          option is still left open to use it as the . At this point, we're
          really just counting on that fact that if we're only using eight
          primary emotions as our basis, the composites of adding those items
          together will never be able to contain more information than could be
          captured in eight dimensions. The main thing is that since our basis
          is not purely orthogonal, we want to pick things that are not less
          orthogonal, and we want to make sure the orthogonality is capturing
          the emotional variance rather than other incidental dimensions (like
          grammar). The issues here have a lot of overlap with the issues we
          faced when trying to build "eigenfaces" by doing dimensional reduction
          on pixel values. Many of the high-variance dimensions just end up
          capturing changes in lighting, for example. So by "normalizing" for
          part of speech (if that's a thing?), we're limiting those kinds of
          incidental effects on the resulting low-dimensional model. At the
          point we have our low-dimensional model, words with different parts of
          speech might now produce very different results, since we've built a
          model that isn't considering those differences anymore.
        </p>
        <p>
          Once the low-dimensional projection space was computed, I then
          mean-centered and normalized the vectors to unit length. Now, given a
          set of weights for the eight primary emotions of the same type that
          are used for generating facial expressions, we can simply compute the
          weighted sum of eight primary word vectors and then find a new word
          from our vocabulary list that points in the most similar direction.
        </p>
        <p>
          So how does liguistic intuition check out? At the top of this page is
          a table that shows the various additive combinations of pairs of the
          eight primary emotions. On the right hand side is an interactive
          control that allows you to adjust the weights of the primary emotions
          to see how the resulting word changes. Judge for yourself whether the
          resulting word makes sense in the context of the primary emotions.
          Some of them make a lot of sense. Some seem to offer new insight about
          how complex emotions arise from simpler concepts. Others seem not
          quite right. It will be interesting to see if it is possible to
          tighten up the alignment through more careful creation of the word
          embeddings, but it is most likely that this approach has fundamental
          limits on how precise it can be. Does this mean that there are more
          than eight primary emotions? Does this mean that addition is not the
          correct way to compose these concepts? Possibly. But, again, most
          likely it means that this model is built on assumptions provide some
          broad accuracy without being too precise. What is interesting is not
          that the model fails as much as it is that it actually succeeds at
          all.
        </p>
      </div>
    </div>
  );
};

export default CompositePage;
