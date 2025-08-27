import emotionsData from '../data/emotions_100.json';
import pcaData from '../data/pca_100.json';

export type Emotion = "angry" | "contempt" | "disgust" | "fear" | "happy" | "neutral" | "sad" | "surprise";
export type EmotionLevels = { [key in Emotion]?: number };

export const NoEmotion: EmotionLevels = {
    angry: 0, 
    contempt: 0, 
    disgust: 0, 
    fear: 0, 
    happy: 0, 
    neutral: 0, 
    sad: 0, 
    surprise: 0,
}

export const randomExpression = () => {
    const ret = {...NoEmotion};
    for (const emotion in ret) {
        ret[emotion] = Math.random() * 100 - 50;
    }
    return ret;
}

class EmotionModel {
    static instance: EmotionModel | undefined;
    emotions: Emotion[]
    vectors: number[][]
    pca: number[][]
    emotionIndex: { [key: string]: number }
    numCoords: number
    numComponents: number
    
    constructor() {
        // Initialize arrays
        this.emotions = [];
        this.vectors = [];
        this.pca = [];
        this.emotionIndex = {};
        
        this.emotions = Object.keys(emotionsData) as Emotion[];
        this.pca = pcaData as number[][];
        this.emotionIndex = this.emotions.reduce((acc, emotion, index) => ({ ...acc, [emotion]: index }), {});
        this.numCoords = this.pca[0].length;
        this.numComponents = this.pca.length;

        Object.values(emotionsData).forEach((vector) => {
            const v = new Array(this.numCoords).fill(0);
            for (let i = 0; i < this.numCoords; i++) {
                for (let j = 0; j < this.numComponents; j++) {
                    v[i] += vector[j] * this.pca[j][i];
                }
            }
            this.vectors.push(v);
        });

        this.normalizeEmotions();
    }
    normalizeEmotions() {
        for (const i in this.vectors) {
            const mag = Math.hypot(...this.vectors[i]);
            for (let j = 0; j < this.numCoords; j++) {
                this.vectors[i][j] /= mag;
            }
        }
        const center = [0,0,0];
        for (const i in this.vectors) {
            for (let j = 0; j < this.numCoords; j++) {
                center[j] += this.vectors[i][j] / this.numCoords;
            }
        }
        for (const i in this.vectors) {
            for (let j = 0; j < this.numCoords; j++) {
                this.vectors[i][j] -= center[j%3];
            }
        }
    }
    calculateCompositeEmotion(coefficients: EmotionLevels | number[]) {
        if (!this.vectors || !this.emotions || !this.pca) {
            return undefined;
        }
        const compositeEmotion : number[] = new Array(this.numCoords).fill(0);
        // let maxY = 0;
        if (Array.isArray(coefficients)) {
            for (let i = 0; i < coefficients.length; i++) {
                const emotion = this.emotions[i];
                for (let j = 0; j < this.numCoords; j++) {
                    compositeEmotion[j] += coefficients[i] * this.vectors[i][j];
                    // if (j % 3 == 1) {
                    //     maxY = Math.max(maxY, Math.abs(compositeEmotion[j]));
                    // }
                }
            }
        } else if (typeof coefficients == "object") {
            for (const emotion in coefficients) {
                if (coefficients[emotion] === 0 || !(emotion in this.emotionIndex)) {
                    continue;
                }
                for (let i = 0; i < this.numCoords; i++) {
                    compositeEmotion[i] += coefficients[emotion] * this.vectors[this.emotionIndex[emotion]][i];
                    // if (i % 3 == 1) {
                    //     maxY = Math.max(maxY, Math.abs(compositeEmotion[i]));
                    // }
                }
            }
        }
        // for (let i = 0; i < this.numCoords; i++) {
        //     compositeEmotion[i] /= maxY;
        // }
        return compositeEmotion;
    }
}

export default EmotionModel;