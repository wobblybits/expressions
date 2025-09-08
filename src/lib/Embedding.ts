// import embeddings from '../data/embeddings.json';
import { labels, data } from '../data/projections.json';
import {Emotion, EmotionLevels, NoEmotion} from './EmotionModel';

export class Embedding {
    // labels: Emotion[];
    data: { [key: string]: number[] };
    embeddingDims: number;
    primary: { [key in Emotion]: number[] };
    embeddings: { [key: string]: number[] };
    projections: { [key: string]: number[] };
    labels: Emotion[];
    meanEmbedding: number[];
    meanProjection: number[];
    basisTranslation: { [key in Emotion]: string }
    adjectiveBasis: { [key in Emotion]: string }
    nounBasis: { [key in Emotion]: string }

    constructor() {
        // this.embeddings = embeddings;
        this.projections = data;
        this.labels = labels as Emotion[];
        this.embeddingDims = this.embeddings[Object.keys(this.embeddings)[0]].length;
        console.log(this.embeddings, this.primary);
        this.meanEmbedding = this.getMeanVector(this.embeddings);
        this.meanProjection = this.getMeanVector(this.projections);
        this.projections = this.meanCenterAndNormalize(this.projections);
        // this.embeddings = this.meanCenterAndNormalize(this.embeddings);
        console.log(this.meanEmbedding, this.meanProjection, this.getClosestWordByEmbedding(this.meanEmbedding), this.getClosestWordByProjection(this.meanProjection));
        this.primary = Object.keys(NoEmotion).reduce((acc, label) => { acc[label] = this.embeddings[label]; return acc; }, {}) as { [key in Emotion]: number[] };
        this.adjectiveBasis = {
            angry: "angry",
            contempt: "contemptuous",
            disgust: "disgusted",
            fear: "fearful",
            happy: "happy",
            neutral: "neutral",
            sad: "sad",
            surprise: "surprised",
        }
        this.nounBasis = {
            angry: "anger",
            contempt: "contempt",
            disgust: "disgust",
            fear: "fear",
            happy: "joy",
            neutral: "neutrality",
            sad: "sadness",
            surprise: "surprise",
        }
        this.basisTranslation = this.adjectiveBasis;
    }

    normalize(vector: number[]): number[] {
        const mag = Math.hypot(...vector);
        return vector.map(val => val / mag);
    }

    getMeanVector(data: { [key: string]: number[] }): number[] {
        const mean = Object.values(data).reduce((acc, val) => acc.map((v, i) => v + val[i]), new Array(data[Object.keys(data)[0]].length).fill(0));
        return mean.map(val => val / Object.keys(data).length);
    }

    meanCenter(data: { [key: string]: number[] }): { [key: string]: number[] } {
        const mean = this.getMeanVector(data);
        return Object.entries(data).reduce((acc, [key, val]) => { acc[key] = val.map((v, i) => v - mean[i]); return acc; }, {});
    }

    meanCenterAndNormalize(data: { [key: string]: number[] }): { [key: string]: number[] } {
        const mean = this.getMeanVector(data);
        return Object.entries(data).reduce((acc, [key, val]) => { acc[key] = this.normalize(val.map((v, i) => v - mean[i])); return acc; }, {});
    }

    getEmbedding(word: string): number[] {
        if (!(word in this.embeddings)) {
            return [];
        }
        return this.embeddings[word] || [];
    }

    getProjection(word: string): number[] {
        if (!(word in this.projections)) {
            return [];
        }
        return this.projections[word] || [];
    }

    getEmotionLevels(word: string): EmotionLevels {
        if (!(word in this.projections)) {
            return {};
        }
        return this.labels.reduce((acc, label, i) => acc[label] = this.projections[word][i], {});
    }

    emotionLevelsToEmbedding(emotions: EmotionLevels): number[] {
        const vector = Object.keys(emotions).reduce((acc, label) => { this.embeddings[label].map((val, i) => { acc[i] += (val * (emotions[label] || 0)); }); return acc; }, new Array(this.embeddingDims).fill(0));
        return vector;
    }

    emotionLevelsToProjection(emotions: EmotionLevels): number[] {
        //return Object.keys(emotions).reduce((acc, label, i) => { acc[i] += (emotions[label] || 0) * this.projections[label][i]; return acc; }, new Array(this.labels.length).fill(0));
        const vector = Object.keys(emotions).reduce((acc, label) => { this.projections[this.basisTranslation[label]].map((val, i) => { acc[i] += (val * (emotions[label] || 0)); }); return acc; }, new Array(this.labels.length).fill(0));
        return vector;
    }

    getClosestWordByEmbedding(emotions: EmotionLevels | number[], metric: "euclidean" | "cosine" = "cosine"): string {
        let matchVector = [];
        if (!Array.isArray(emotions)) {
            matchVector = this.emotionLevelsToEmbedding(emotions);
        } else {
            matchVector = emotions;
        }
        // console.log(matchVector);
        const bestMatch = Object.entries(this.embeddings).reduce((acc, [word, vector]) => {
            let distance = Infinity;
            if (metric === "euclidean") {
                distance = vector.reduce((acc, level, i) => acc + (vector[i] - matchVector[i]) ** 2, 0);
            }
            if (metric === "cosine") {
                distance = vector.reduce((acc, level, i) => acc + matchVector[i] * vector[i], 0);
                distance = 1 - distance / (Math.hypot(...vector) * Math.hypot(...matchVector));
            }
            return distance < acc.distance ? { word, distance } : acc;
        }, { word: "", distance: Infinity });
        console.log(bestMatch.word, bestMatch.distance);
        return bestMatch.word;
    }

    getClosestWordByProjection(emotions: EmotionLevels | number[], metric: "euclidean" | "cosine" = "cosine"): string {
        let matchVector = [];
        if (!Array.isArray(emotions)) {
            matchVector = this.emotionLevelsToProjection(emotions);
        } else {
            matchVector = emotions;
        }
        const bestMatch = Object.entries(this.projections).reduce((acc, [word, vector]) => {
            let distance = Infinity;
            if (metric === "euclidean") {
                distance = vector.reduce((acc, level, i) => acc + (vector[i] - matchVector[i]) ** 2, 0);
            }
            if (metric === "cosine") {
                distance = vector.reduce((acc, level, i) => acc + matchVector[i] * vector[i], 0);
                distance = 1 - distance / (Math.hypot(...vector) * Math.hypot(...matchVector));
            }
            return distance < acc.distance ? { word, distance } : acc;
        }, { word: "", distance: Infinity });
        console.log(bestMatch.word, bestMatch.distance);
        return bestMatch.word;
    }

    getClosestWord(emotions: EmotionLevels | number[], metric: "euclidean" | "cosine" = "cosine"): string {
        return this.getClosestWordByProjection(emotions, metric);
    }

}