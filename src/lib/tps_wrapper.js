// Simple, reliable WASM module loader
let wasmModule = null;
let fallbackModule = null;

async function loadWasmModule() {
    if (wasmModule) return wasmModule;
    
    try {
        // Use a unique module name to avoid conflicts
        const Module = {
            locateFile: (path) => path === 'tps.wasm' ? '/tps.wasm' : path,
            onRuntimeInitialized: () => {
                console.log('WASM TPS module initialized');
            },
            noExitRuntime: true, // Add this to prevent conflicts
            print: (text) => console.log('TPS WASM:', text),
            printErr: (text) => console.error('TPS WASM Error:', text)
        };
        
        // Load the WASM module script with a unique global name
        const script = document.createElement('script');
        script.src = '/tps.js';
        script.async = true;
        
        // Wait for module to be ready
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        // Check if the module loaded properly
        if (typeof window.Module !== 'undefined' && window.Module._tps_create) {
            wasmModule = window.Module;
            return wasmModule;
        }
        
        throw new Error('WASM module not properly loaded');
        
    } catch (error) {
        console.warn('WASM TPS failed to load:', error);
        return null;
    }
}

async function loadFallbackModule() {
    if (!fallbackModule) {
        const { TPS } = await import('transformation-models');
        fallbackModule = TPS;
    }
    return fallbackModule;
}

class TPSWasm {
    constructor(controlPoints, targetPoints) {
        this.controlPoints = controlPoints;
        this.targetPoints = targetPoints;
        this.module = null;
        this.tps = null;
        this.fallback = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            // Try WASM first
            this.module = await loadWasmModule();
            
            if (this.module && this.module._tps_create) {
                await this.initializeWasm();
                return;
            }
            
        } catch (error) {
            console.warn('WASM initialization failed:', error);
        }
        
        // Fall back to JS implementation
        await this.initializeFallback();
    }

    async initializeWasm() {
        // Convert points to flat arrays
        const flatControlPoints = this.controlPoints.flat();
        const flatTargetPoints = this.targetPoints.flat();
        
        // Allocate memory
        const controlPtr = this.module._malloc(flatControlPoints.length * 8);
        const targetPtr = this.module._malloc(flatTargetPoints.length * 8);
        
        if (controlPtr === 0 || targetPtr === 0) {
            throw new Error('Failed to allocate memory');
        }
        
        // Copy data to WASM memory
        for (let i = 0; i < flatControlPoints.length; i++) {
            this.module.HEAPF64[controlPtr / 8 + i] = flatControlPoints[i];
            this.module.HEAPF64[targetPtr / 8 + i] = flatTargetPoints[i];
        }
        
        // Create TPS instance
        this.tps = this.module._tps_create(controlPtr, targetPtr, this.controlPoints.length);
        
        if (this.tps === 0) {
            throw new Error('Failed to create TPS instance');
        }
        
        this.initialized = true;
        console.log('WASM TPS initialized successfully');
    }

    async initializeFallback() {
        const TPS = await loadFallbackModule();
        this.fallback = new TPS(this.controlPoints, this.targetPoints);
        this.initialized = true;
        console.log('Fallback JS TPS initialized');
    }

    forward(point) {
        if (!this.initialized) {
            throw new Error('TPS not initialized');
        }
        
        if (this.fallback) {
            return this.fallback.forward(point);
        }
        
        // Allocate output memory
        const outX = this.module._malloc(8);
        const outY = this.module._malloc(8);
        
        if (outX === 0 || outY === 0) {
            throw new Error('Failed to allocate output memory');
        }
        
        try {
            this.module._tps_forward(this.tps, point[0], point[1], outX, outY);
            
            const result = [
                this.module.HEAPF64[outX / 8],
                this.module.HEAPF64[outY / 8]
            ];
            
            return result;
        } finally {
            this.module._free(outX);
            this.module._free(outY);
        }
    }

    inverse(point) {
        if (!this.initialized) {
            throw new Error('TPS not initialized');
        }
        
        if (this.fallback) {
            return this.fallback.inverse(point);
        }
        
        // Allocate output memory
        const outX = this.module._malloc(8);
        const outY = this.module._malloc(8);
        
        if (outX === 0 || outY === 0) {
            throw new Error('Failed to allocate output memory');
        }
        
        try {
            this.module._tps_inverse(this.tps, point[0], point[1], outX, outY);
            
            const result = [
                this.module.HEAPF64[outX / 8],
                this.module.HEAPF64[outY / 8]
            ];
            
            return result;
        } finally {
            this.module._free(outX);
            this.module._free(outY);
        }
    }

    destroy() {
        if (this.tps && this.module && !this.fallback) {
            this.module._tps_destroy(this.tps);
            this.tps = null;
        }
        this.initialized = false;
    }
}

export { TPSWasm };