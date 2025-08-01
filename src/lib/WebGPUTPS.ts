// Add WebGPU type declarations
declare global {
    interface Navigator {
        gpu?: any;
    }
}

// WebGPU types
declare class GPUDevice {
    createShaderModule(descriptor: any): any;
    createComputePipeline(descriptor: any): any;
    createTexture(descriptor: any): any;
    createBuffer(descriptor: any): any;
    createBindGroup(descriptor: any): any;
    createCommandEncoder(): any;
    queue: any;
}

declare class GPUComputePipeline {
    getBindGroupLayout(index: number): any;
}

declare class GPUTexture {
    createView(): any;
}

declare class GPUBuffer {
    mapAsync(mode: any): Promise<void>;
    getMappedRange(): ArrayBuffer;
    unmap(): void;
}

declare class GPUCommandEncoder {
    beginComputePass(): any;
    copyTextureToBuffer(source: any, destination: any, copySize: any): void;
    finish(): any;
}

declare class GPUComputePassEncoder {
    setPipeline(pipeline: any): void;
    setBindGroup(index: number, bindGroup: any): void;
    dispatchWorkgroups(x: number, y: number, z?: number): void;
    end(): void;
}

declare const GPUMapMode: {
    READ: any;
};

declare const GPUTextureUsage: {
    TEXTURE_BINDING: any;
    COPY_DST: any;
    STORAGE_BINDING: any;
    COPY_SRC: any;
};

declare const GPUBufferUsage: {
    UNIFORM: any;
    COPY_DST: any;
    MAP_READ: any;
};

declare class GPUBindGroup {
    // Empty class - just for type checking
}

class WebGPUTPS {
    private device: GPUDevice | null = null;
    private pipeline: GPUComputePipeline | null = null;
    private uniformBuffer: GPUBuffer | null = null;
    private inputTexture: GPUTexture | null = null;
    private maskTexture: GPUTexture | null = null;
    private outputTexture: GPUTexture | null = null;
    private bindGroup: GPUBindGroup | null = null;
    
    private width: number = 0;
    private height: number = 0;
    private initialized: boolean = false;

    async initialize(): Promise<boolean> {
        try {
            // Check WebGPU support
            if (!navigator.gpu) {
                console.warn('WebGPU not supported');
                return false;
            }

            const adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance'
            });
            
            if (!adapter) {
                console.warn('No WebGPU adapter found');
                return false;
            }

            this.device = await adapter.requestDevice({
                requiredFeatures: ['shader-f16'],
                requiredLimits: {
                    maxStorageBufferBindingSize: 1024 * 1024 * 1024, // 1GB
                    maxBufferSize: 1024 * 1024 * 1024
                }
            });

            await this.createPipeline();
            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize WebGPU:', error);
            return false;
        }
    }

    private async createPipeline(): Promise<void> {
        if (!this.device) throw new Error('Device not initialized');

        const shaderModule = this.device.createShaderModule({
            code: `
                struct Uniforms {
                    imageSize: vec2<f32>,
                    processingScale: vec2<f32>,
                    imageBBox: vec4<f32>,
                    tpsMatrix: mat4x4<f32>
                }

                @group(0) @binding(0) var inputTexture: texture_2d<f32>;
                @group(0) @binding(1) var maskTexture: texture_2d<f32>;
                @group(0) @binding(2) var originalTexture: texture_2d<f32>;
                @group(0) @binding(3) var outputTexture: texture_storage_2d<rgba8unorm, write>;
                @group(0) @binding(4) var<uniform> uniforms: Uniforms;

                @compute @workgroup_size(16, 16)
                fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                    let pixelCoord = vec2<i32>(global_id.xy);
                    
                    // Check bounds
                    if (pixelCoord.x >= i32(uniforms.imageSize.x) || 
                        pixelCoord.y >= i32(uniforms.imageSize.y)) {
                        return;
                    }
                    
                    let texCoord = vec2<f32>(pixelCoord) / uniforms.imageSize;
                    
                    // Check mask
                    let mask = textureLoad(maskTexture, pixelCoord, 0).r;
                    if (mask < 0.5) { 
                        return; 
                    }
                    
                    // Calculate original coordinates
                    let originalCoord = texCoord * uniforms.processingScale + uniforms.imageBBox.xy;
                    
                    // Apply TPS transformation
                    let transformed = uniforms.tpsMatrix * vec4<f32>(originalCoord, 0.0, 1.0);
                    let sourceCoord = transformed.xy / transformed.w;
                    
                    // Convert to texture coordinates
                    let sourceTexCoord = sourceCoord / uniforms.imageSize;
                    
                    // Sample and write
                    if (sourceTexCoord.x >= 0.0 && sourceTexCoord.x <= 1.0 && 
                        sourceTexCoord.y >= 0.0 && sourceTexCoord.y <= 1.0) {
                        let sourcePixelCoord = vec2<i32>(sourceTexCoord * uniforms.imageSize);
                        let color = textureLoad(originalTexture, sourcePixelCoord, 0);
                        textureStore(outputTexture, pixelCoord, color);
                    }
                }
            `
        });

        this.pipeline = this.device.createComputePipeline({
            layout: 'auto',
            compute: { 
                module: shaderModule, 
                entryPoint: 'main' 
            }
        });
    }

    async processFrame(
        landmarks: number[][], 
        imageData: Uint8ClampedArray, 
        maskData: Uint8ClampedArray,
        width: number, 
        height: number,
        processingScale: number,
        imageBBox: { minX: number; minY: number; maxX: number; maxY: number }
    ): Promise<Uint8ClampedArray> {
        if (!this.device || !this.pipeline) {
            throw new Error('WebGPU not initialized');
        }

        // Update dimensions if needed
        if (this.width !== width || this.height !== height) {
            this.width = width;
            this.height = height;
            await this.createTextures();
        }

        // Upload data
        await this.uploadTextures(imageData, maskData);
        this.uploadUniforms(landmarks, processingScale, imageBBox);

        // Create command encoder and compute pass
        const commandEncoder = this.device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();
        
        computePass.setPipeline(this.pipeline);
        computePass.setBindGroup(0, this.bindGroup!);
        
        // Dispatch compute workgroups
        const workgroupSize = 16;
        const workgroupsX = Math.ceil(this.width / workgroupSize);
        const workgroupsY = Math.ceil(this.height / workgroupSize);
        
        computePass.dispatchWorkgroups(workgroupsX, workgroupsY);
        computePass.end();

        // Submit commands
        this.device.queue.submit([commandEncoder.finish()]);

        // Read back result
        return await this.downloadResult();
    }

    private async createTextures(): Promise<void> {
        if (!this.device) return;

        // Create input texture
        this.inputTexture = this.device.createTexture({
            size: [this.width, this.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });

        // Create mask texture
        this.maskTexture = this.device.createTexture({
            size: [this.width, this.height, 1],
            format: 'r8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
        });

        // Create output texture
        this.outputTexture = this.device.createTexture({
            size: [this.width, this.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
        });

        // Create uniform buffer
        this.uniformBuffer = this.device.createBuffer({
            size: 4 * 4 + 4 * 4 + 4 * 4 + 4 * 4 + 16 * 4, // uniforms + tps matrix
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // Create bind group
        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline!.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.inputTexture.createView() },
                { binding: 1, resource: this.maskTexture.createView() },
                { binding: 2, resource: this.inputTexture.createView() }, // Original texture same as input for now
                { binding: 3, resource: this.outputTexture.createView() },
                { binding: 4, resource: { buffer: this.uniformBuffer } }
            ]
        });
    }

    private async uploadTextures(imageData: Uint8ClampedArray, maskData: Uint8ClampedArray): Promise<void> {
        if (!this.device || !this.inputTexture || !this.maskTexture) return;

        // Upload image data
        this.device.queue.writeTexture(
            { texture: this.inputTexture },
            imageData,
            { bytesPerRow: this.width * 4, rowsPerImage: this.height },
            { width: this.width, height: this.height }
        );

        // Upload mask data
        this.device.queue.writeTexture(
            { texture: this.maskTexture },
            maskData,
            { bytesPerRow: this.width, rowsPerImage: this.height },
            { width: this.width, height: this.height }
        );
    }

    private uploadUniforms(
        landmarks: number[][], 
        processingScale: number, 
        imageBBox: { minX: number; minY: number; maxX: number; maxY: number }
    ): void {
        if (!this.device || !this.uniformBuffer) return;

        // Calculate TPS matrix from landmarks
        const tpsMatrix = this.calculateTPSMatrix(landmarks);
        
        // Create uniform data
        const uniformData = new Float32Array([
            // imageSize
            this.width, this.height, 0, 0,
            // processingScale
            processingScale, processingScale, 0, 0,
            // imageBBox
            imageBBox.minX, imageBBox.minY, imageBBox.maxX, imageBBox.maxY,
            // padding
            0, 0, 0, 0,
            // tpsMatrix (16 floats)
            ...tpsMatrix
        ]);

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
    }

    private calculateTPSMatrix(landmarks: number[][]): Float32Array {
        // Simplified TPS matrix calculation
        // In a real implementation, you'd compute the full TPS transformation
        const matrix = new Float32Array(16);
        
        // Identity matrix for now - replace with actual TPS computation
        matrix[0] = 1; matrix[5] = 1; matrix[10] = 1; matrix[15] = 1;
        
        return matrix;
    }

    private async downloadResult(): Promise<Uint8ClampedArray> {
        if (!this.device || !this.outputTexture) {
            throw new Error('Textures not initialized');
        }

        // Create staging buffer
        const stagingBuffer = this.device.createBuffer({
            size: this.width * this.height * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        // Copy texture to buffer
        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyTextureToBuffer(
            { texture: this.outputTexture },
            { buffer: stagingBuffer },
            { width: this.width, height: this.height }
        );
        this.device.queue.submit([commandEncoder.finish()]);

        // Map and read buffer
        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const result = new Uint8ClampedArray(stagingBuffer.getMappedRange());
        const copy = new Uint8ClampedArray(result);
        stagingBuffer.unmap();

        return copy;
    }

    isSupported(): boolean {
        return this.initialized;
    }

    destroy(): void {
        // Clean up resources
        this.device = null;
        this.pipeline = null;
        this.uniformBuffer = null;
        this.inputTexture = null;
        this.maskTexture = null;
        this.outputTexture = null;
        this.bindGroup = null;
    }
}

export default WebGPUTPS; 