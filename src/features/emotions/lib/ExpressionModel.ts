import * as THREE from 'three';
import { vertices, indices } from '../../../data/mediapipe478.json';
import meanData from '../../../data/mean.json';
import EmotionModel from './EmotionModel';
import type { EmotionLevels } from './EmotionModel';

// instantiate a loader
class ExpressionModel {
    canonicalFace: THREE.BufferGeometry | undefined;
    faceMaterial: THREE.Material;
    sphere: THREE.Object3D | undefined;
    emotionModel: EmotionModel;
    faceMesh: THREE.Mesh;
    vertices: number[];
    pupilIndices: number[];
    pupils: THREE.Mesh[];
    pupilMaterial: THREE.Material;
    constructor(emotionalModel: EmotionModel) {
        this.canonicalFace = undefined;
        this.emotionModel = emotionalModel;
        this.canonicalFace =  new THREE.BufferGeometry();    
        
        const center = [0,0,0];
        for (let i = 0; i < meanData.length; i++) {
            center[i%3] += meanData[i] * 3 / meanData.length;
        }
        const centeredData = meanData.map((value, index) => value - center[index%3]);

        this.vertices = centeredData;

        this.canonicalFace.setAttribute('position', new THREE.Float32BufferAttribute(this.vertices, 3));
        this.canonicalFace.setIndex(indices);
        this.canonicalFace.computeVertexNormals();
        this.canonicalFace.computeBoundingBox();

        this.faceMaterial = new THREE.MeshToonMaterial( {
            color: 0xaaddcc,
        } );
        this.faceMaterial.side = THREE.DoubleSide;
        this.faceMaterial.flatShading = false;
        this.faceMaterial.wireframe = false;
        this.faceMesh = new THREE.Mesh(this.canonicalFace, this.faceMaterial);

        this.pupilIndices = [473, 468];
        this.pupilMaterial = new THREE.MeshPhongMaterial({
            color: 0x000000,
            transparent: false,
            opacity: 1.0,
            shininess: 5000
        });
        this.pupils = [];
        for (let i = 0; i < this.pupilIndices.length; i++) {
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(.125, 32, 32), this.pupilMaterial);
            this.pupils.push(pupil);
        }
    }
    getExpression(expression: EmotionLevels | number[]) {
        if (!this.canonicalFace) {
            return undefined;
        }
        const group = new THREE.Group();
        const coordinates = this.emotionModel.calculateCompositeEmotion(expression);

        if (!coordinates) {
            // Return a group with the face mesh instead of just the geometry
            group.add(this.faceMesh);
            group.position.set(0, 0, 0);
            group.scale.set(1, -1, -1);
            group.rotation.set(0, 0, 0);
            return group;
        }

        const positionAttribute = this.faceMesh.geometry.getAttribute('position');

        let maxY = 0;
        let minY = 0;
        for (let i = 0; i < coordinates.length; i++) {
            coordinates[i] += this.vertices[i];
            if (i % 3 == 1) {
                maxY = Math.max(maxY, coordinates[i]);
                minY = Math.min(minY, coordinates[i]);
            }
        }
        for (let i = 0; i < coordinates.length; i++) {
            coordinates[i] /= .25 *(maxY - minY);
        }

        this.faceMesh.geometry.setAttribute('position',  new THREE.Float32BufferAttribute(coordinates,3));

        positionAttribute.needsUpdate = true;

        group.add(this.faceMesh);

        for (let i = 0; i < this.pupils.length; i++) {
            const pupil = this.pupils[i];
            pupil.position.set(coordinates[this.pupilIndices[i]*3], coordinates[this.pupilIndices[i]*3+1], coordinates[this.pupilIndices[i]*3+2]+.125);
            group.add(pupil);
        }
        group.position.set(0, 0, 0);
        group.scale.set(1, -1, -1);
        group.rotation.set(0, 0, 0);
        return group;
    }
}

export default ExpressionModel;
