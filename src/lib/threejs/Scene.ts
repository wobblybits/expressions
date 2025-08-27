import * as THREE from 'three';

class Scene {
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    renderer: THREE.WebGLRenderer;

    constructor(width: number, height: number, backgroundColor?: string, ambientLightColor?: string, directionalLightColor?: string, cameraPosition?: string) {
        this.scene = new THREE.Scene();
        // this.camera = new THREE.PerspectiveCamera( 45, 1, 0.1, 1000 );
        this.camera = new THREE.OrthographicCamera( -2.5, 2.5, 2.5, -2.5, 0.01, 1000 );
        this.camera.position.set( ...([0, 0, 10]) );
        this.camera.updateProjectionMatrix();
    
        this.scene.background = new THREE.Color( backgroundColor || 0xffffff );
        const ambientLight = new THREE.AmbientLight( ambientLightColor || 0xaa0077, 3 );
        
        const overheadLight = new THREE.DirectionalLight( directionalLightColor || 0xcc99aa, 1 );
        overheadLight.position.set( -2, 4.5, 9 );

        const sideLight = new THREE.DirectionalLight( directionalLightColor || 0x99aacc, 4 );
        sideLight.position.set( 3, 3, 5 );

        this.scene.add( ambientLight );
        this.scene.add( overheadLight );
        this.scene.add( sideLight );

        this.renderer = new THREE.WebGLRenderer({
            antialias: false,
        });
        this.renderer.setSize( width, height );

        return this;
    }

    add(object: THREE.Object3D) {
        this.scene.add(object);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }
    
}

export default Scene;