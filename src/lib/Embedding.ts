import {labels, data} from '../data/embedding.json';
import {Emotion, EmotionLevels} from './EmotionModel';

export class Embedding {
    labels: Emotion[];
    data: { [key: string]: number[] };

    constructor() {
        this.labels = labels as Emotion[];
        this.data = data;
    }

    getVector(word: string): number[] {
        if (!(word in this.data)) {
            return [];
        }
        return this.data[word] || [];
    }

    getEmotionLevels(word: string): EmotionLevels {
        if (!(word in this.data)) {
            return {};
        }
        return this.labels.reduce((acc, label, i) => acc[label] = this.data[word][i], {});
    }

    emotionLevelsToVector(emotions: EmotionLevels): number[] {
        return this.labels.reduce((acc, label, i) => { acc.push(emotions[label] || 0); return acc; }, []);
    }

    getClosestWord(emotions: EmotionLevels | number[], metric: "euclidean" | "cosine" = "cosine"): string {
        let matchVector = [];
        if (!Array.isArray(emotions)) {
            matchVector = this.emotionLevelsToVector(emotions);
        } else {
            matchVector = emotions;
        }
        console.log(matchVector);
        return Object.entries(this.data).reduce((acc, [word, vector]) => {
            let distance = Infinity;
            if (metric === "euclidean") {
                distance = vector.reduce((acc, level, i) => acc + (vector[i] - matchVector[i]) ** 2, 0);
            }
            if (metric === "cosine") {
                distance = vector.reduce((acc, level, i) => acc + matchVector[i] * vector[i], 0);
                distance = 1 - distance / (Math.hypot(...vector) * Math.hypot(...matchVector));
            }
            return distance < acc.distance ? { word, distance } : acc;
        }, { word: "", distance: Infinity }).word;
    }

}