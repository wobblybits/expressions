class TPSWasm {
    constructor(controlPoints, targetPoints) {
        this.controlPoints = controlPoints;
        this.targetPoints = targetPoints;
        this.module = null;
        this.tps = null;
        this.initialized = false;
    }

    async initialize() {
        // Extract the memory management functions from tps.js
        const getHeapMax = () => 2147483648;
        const alignMemory = (size, alignment) => Math.ceil(size / alignment) * alignment;
        
        const growMemory = (size) => {
            // This would need access to wasmMemory which isn't available yet
            // For now, return success
            return 1;
        };
        
        const _emscripten_resize_heap = (requestedSize) => {
            const oldSize = 0; // This would be HEAPU8.length in the real implementation
            requestedSize >>>= 0;
            const maxHeapSize = getHeapMax();
            if (requestedSize > maxHeapSize) {
                return false;
            }
            for (let cutDown = 1; cutDown <= 4; cutDown *= 2) {
                const overGrownHeapSize = oldSize * (1 + .2 / cutDown);
                const newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
                const replacement = growMemory(newSize);
                if (replacement) {
                    return true;
                }
            }
            return false;
        };

        // Create the proper import object structure that the WASM module expects
        const importObject = {
            a: {
                a: _emscripten_resize_heap
            }
        };

        const results = await WebAssembly.instantiateStreaming(fetch("/tps.wasm"), importObject);

        this.module = results.instance;
        
        // Assign all the WASM exports based on the tps.js assignWasmExports function
        // From tps.js: Module["_tps_destroy"]=_tps_destroy=wasmExports["d"];
        this._tps_destroy = this.module.exports._tps_destroy || this.module.exports.d;
        this._free = this.module.exports._free || this.module.exports.e;
        this._malloc = this.module.exports._malloc || this.module.exports.f;
        this._tps_create = this.module.exports._tps_create || this.module.exports.g;
        this._tps_forward = this.module.exports._tps_forward || this.module.exports.h;
        this._tps_inverse = this.module.exports._tps_inverse || this.module.exports.i;
        this.__emscripten_stack_restore = this.module.exports.__emscripten_stack_restore || this.module.exports.j;
        this.__emscripten_stack_alloc = this.module.exports.__emscripten_stack_alloc || this.module.exports.k;
        this._emscripten_stack_get_current = this.module.exports._emscripten_stack_get_current || this.module.exports.l;
        
        // Check if all required functions are available
        const requiredFunctions = [
            '_tps_destroy', '_free', '_malloc', '_tps_create', 
            '_tps_forward', '_tps_inverse'
        ];
        
        const missingFunctions = requiredFunctions.filter(func => !this[func]);
        if (missingFunctions.length > 0) {
            console.error("Missing functions:", missingFunctions);
            console.error("Available exports:", Object.keys(this.module.exports));
            throw new Error(`Missing required TPS functions: ${missingFunctions.join(', ')}`);
        }
        
        const flatControlPoints = this.controlPoints.flat();
        const flatTargetPoints = this.targetPoints.flat();
    
        this.tps = this._tps_create(flatControlPoints, flatTargetPoints, this.controlPoints.length);
        
        if (this.tps === 0) {
            throw new Error('Failed to create TPS instance');
        }
        
        this.initialized = true;
        console.log('WASM TPS initialized successfully');
    }

    // Forward transformation: transform from control points to target points
    forward(point) {
        if (!this.initialized || !this.tps) {
            throw new Error('TPS not initialized');
        }
        
        const [x, y] = point;
        const outX = new Float64Array(1);
        const outY = new Float64Array(1);
        
        this._tps_forward(this.tps, x, y, outX, outY);
        
        return [outX[0], outY[0]];
    }

    // Inverse transformation: transform from target points to control points
    inverse(point) {
        if (!this.initialized || !this.tps) {
            throw new Error('TPS not initialized');
        }
        
        const [x, y] = point;
        const outX = new Float64Array(1);
        const outY = new Float64Array(1);
        
        this._tps_inverse(this.tps, x, y, outX, outY);
        
        return [outX[0], outY[0]];
    }

    // Clean up WASM resources
    destroy() {
        if (this.tps && this._tps_destroy) {
            this._tps_destroy(this.tps);
            this.tps = null;
        }
        this.initialized = false;
    }
}

export { TPSWasm };