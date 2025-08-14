import { Component, createSignal, JSX } from "solid-js";
import ExpressionModel from "../lib/ExpressionModel";
import Face from "../../../components/ui/face/Face";
import EmotionModel, { NoEmotion, type EmotionLevels } from "../lib/EmotionModel";
import { For } from "solid-js";


const Controls: Component<{title: string, emotionModel: EmotionModel, callback: (emotionLevels: EmotionLevels) => void, children: JSX.Element}> = (props) => {

    const [displayEmotionLevels, setDisplayEmotionLevels] = createSignal<EmotionLevels>(NoEmotion);

    return (
        <div style={{display: "flex", "flex-direction": "column", "align-items": "center", "justify-content": "center", "width": "300px" }}>
            <h1 class="pixelated-text">{props.title}</h1>
            <div id="controls" class="pixelated-border">
                <h4>Expression</h4>
                <Face id="face" width={140} height={140} expressionModel={new ExpressionModel(props.emotionModel)} emotionLevels={displayEmotionLevels}/>
                <For each={Object.keys(NoEmotion)}>
                    {(key) => 
                        <div id="emotion-sliders" style={{display: "flex", "align-items": "center", gap: "10px"}}>
                            <input type="range" min="-100" max="100" value={displayEmotionLevels()[key as keyof EmotionLevels]} oninput={(e) => {
                                const currentEmotions = displayEmotionLevels();
                                const newEmotions = {...currentEmotions, [key]: parseInt(e.target.value)};
                                setDisplayEmotionLevels(newEmotions);
                                props.callback(newEmotions);
                            }}/>
                            <span>{String(key)}</span>
                        </div>
                    }
                </For>
                <input type="button" value="Reset" onClick={() => {
                    setDisplayEmotionLevels(NoEmotion);
                    document.querySelectorAll("#emotion-sliders input[type='range']").forEach((input) => {
                        (input as HTMLInputElement).value = "0";
                    });
                    props.callback(NoEmotion);
                }} />
                {props.children}
            </div>
          </div>
    );
}

export default Controls;