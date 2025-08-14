/**
 * WebGPU-based TPS transformation implementation
 * Provides GPU-accelerated thin plate spline transformations
 */

interface GPUBuffers {
  uniformBuffer: GPUBuffer | null;
  meshPointsBuffer: GPUBuffer | null;
  imagePointsBuffer: GPUBuffer | null;
  distortPointsBuffer: GPUBuffer | null;
  modelPointsBuffer: GPUBuffer | null;
  baseCoeffsBuffer: GPUBuffer | null;
  model2distortCoeffsBuffer: GPUBuffer | null;
  imageDataBuffer: GPUBuffer | null;
  faceDataBuffer: GPUBuffer | null;
  debugBuffer: GPUBuffer | null;
}

interface GPUCreateBuffersParams {
  baseNumPoints?: number;
  distortNumPoints?: number;
  imageWidth?: number;
  imageHeight?: number;
  faceMinY?: number;
  faceMinX?: number;
  faceWidth?: number;
  faceHeight?: number;
}

interface GPUUniforms {
  baseNumPoints?: number;
  distortNumPoints?: number;
  imageWidth?: number;
  imageHeight?: number;
  faceMinY?: number;
  faceMinX?: number;
  faceWidth?: number;
  faceHeight?: number;
}

interface GPUBufferUpdates {
  uniforms?: Uint32Array;
  meshPoints?: Float32Array;
  imagePoints?: Float32Array;
  distortPoints?: Float32Array;
  modelPoints?: Float32Array;
  baseCoeffs?: Float32Array;
  model2distortCoeffs?: Float32Array;
  imageData?: Uint32Array;
  faceData?: Uint32Array;
}

export default class GPU implements GPUBuffers {
  public device: GPUDevice | null;
  public context: GPUCanvasContext | null;
  public canvas: HTMLCanvasElement | null;
  public commandEncoder: GPUCommandEncoder | null;
  public computePassEncoder: GPUComputePassEncoder | null;
  public initialized: boolean;
  
  // Buffer references
  public uniformBuffer: GPUBuffer | null;
  public meshPointsBuffer: GPUBuffer | null;
  public imagePointsBuffer: GPUBuffer | null;
  public distortPointsBuffer: GPUBuffer | null;
  public modelPointsBuffer: GPUBuffer | null;
  public baseCoeffsBuffer: GPUBuffer | null;
  public model2distortCoeffsBuffer: GPUBuffer | null;
  public imageDataBuffer: GPUBuffer | null;
  public faceDataBuffer: GPUBuffer | null;
  public debugBuffer: GPUBuffer | null;
  
  // Bind group
  public bindGroup: GPUBindGroup | null;
  public bindGroupLayout: GPUBindGroupLayout | null;
  public pipelineLayout: GPUPipelineLayout | null;
  public computePipeline: GPUComputePipeline | null;

  constructor() {
    this.device = null;
    this.context = null;
    this.canvas = null;
    this.commandEncoder = null;
    this.computePassEncoder = null;
    this.initialized = false;
    
    // Buffer references
    this.uniformBuffer = null;
    this.meshPointsBuffer = null;
    this.imagePointsBuffer = null;
    this.distortPointsBuffer = null;
    this.modelPointsBuffer = null;
    this.baseCoeffsBuffer = null;
    this.model2distortCoeffsBuffer = null;
    this.imageDataBuffer = null;
    this.faceDataBuffer = null;
    this.debugBuffer = null;
    
    // Bind group
    this.bindGroup = null;
    this.bindGroupLayout = null;
    this.pipelineLayout = null;
    this.computePipeline = null;
  }

  /**
   * Initialize WebGPU device and context
   * @returns true if initialization successful
   */
  async initialize(): Promise<boolean> {
    try {
      if (!navigator.gpu) {
        console.error('WebGPU not supported');
        return false;
      }

      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.error('No WebGPU adapter found');
        return false;
      }

      // Request higher limits for storage buffers
      this.device = await adapter.requestDevice({
        requiredLimits: {
          maxStorageBuffersPerShaderStage: 10
        }
      });
      
      // Create a hidden canvas for context
      this.canvas = document.createElement('canvas');
      this.canvas.style.display = 'none';
      document.body.appendChild(this.canvas);
      
      this.context = this.canvas.getContext('webgpu');
      if (!this.context) {
        console.error('WebGPU context not available');
        return false;
      }

      await this.setupComputeShader();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      return false;
    }
  }

  /**
   * Set up compute shader and pipeline
   */
  async setupComputeShader(): Promise<void> {
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    // Create bind group layout - now with only 8 storage buffers
    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        // Uniform buffer
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' }
        },
        // Mesh points buffer
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' }
        },
        // Image points buffer
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' }
        },
        // Distort points buffer
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' }
        },
        // Model points buffer
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' }
        },
        // Combined base coefficients (forward and inverse interleaved)
        {
          binding: 5,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' }
        },
        // Model2Distort coefficients
        {
          binding: 6,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' }
        },
        // Image data buffer - FIXED: Changed to read-only-storage
        {
          binding: 7,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'read-only-storage' }
        },
        // Face data buffer (with blur mask in alpha)
        {
          binding: 8,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' }
        }
      ]
    });

    // Create pipeline layout
    this.pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout]
    });

    // Compute shader code with TPS transformation implementation
    const computeShader = `
      struct Uniforms {
        baseNumPoints: u32,
        distortNumPoints: u32,
        imageWidth: u32,
        imageHeight: u32,
        faceMinY: u32,
        faceMinX: u32,
        faceWidth: u32,
        faceHeight: u32,
      }

      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var<storage, read> meshPoints: array<f32>;
      @group(0) @binding(2) var<storage, read> imagePoints: array<f32>;
      @group(0) @binding(3) var<storage, read> distortPoints: array<f32>;
      @group(0) @binding(4) var<storage, read> modelPoints: array<f32>;
      @group(0) @binding(5) var<storage, read> baseCoeffs: array<f32>;
      @group(0) @binding(6) var<storage, read> model2distortCoeffs: array<f32>;
      @group(0) @binding(7) var<storage, read> imageData: array<u32>;
      @group(0) @binding(8) var<storage, read_write> faceData: array<u32>;

      // Radial basis function - r^2 * log(r) using built-in length function
      fn kernelFunction(dx: f32, dy: f32) -> f32 {
        if (dx == 0.0 && dy == 0.0) {
          return 0.0;
        }
        let dist = length(vec2<f32>(dx, dy));
        return dist * dist * log(dist * dist);
      }

      // Transform XY function with vec2 optimizations
      fn transformXY(point: vec2<f32>) -> vec2<f32> {
        let baseNumPoints = uniforms.baseNumPoints;
        let coeffsOffset = baseNumPoints + 3u;
        
        // Validate coefficient array bounds
        if (baseNumPoints == 0u || coeffsOffset * 4u > arrayLength(&baseCoeffs)) {
          return point; // Return original point if coefficients are invalid
        }
        
        // Step 1: baseTPS.inverse(point) - use inverse coefficients (offset 0)
        var baseInverse = vec2<f32>(0.0, 0.0);
        {
          var Xo = baseCoeffs[0] + baseCoeffs[1] * point.x + baseCoeffs[2] * point.y;
          var Yo = baseCoeffs[coeffsOffset] + baseCoeffs[coeffsOffset + 1] * point.x + baseCoeffs[coeffsOffset + 2] * point.y;
          
          for (var r = 0u; r < baseNumPoints; r++) {
            let sourcePoint = vec2<f32>(imagePoints[r * 2u], imagePoints[r * 2u + 1u]);
            let diff = point - sourcePoint;
            let tmp = kernelFunction(diff.x, diff.y);
            Xo += baseCoeffs[r + 3u] * tmp;
            Yo += baseCoeffs[coeffsOffset + r + 3u] * tmp;
          }
          baseInverse = vec2<f32>(Xo, Yo);
        }
        
        // Step 2: activeTPS.inverse(baseInverse) - use forward coefficients with swapped points
        var activeInverse = vec2<f32>(0.0, 0.0);
        {
          let distortNumPoints = uniforms.distortNumPoints;
          let distortCoeffsOffset = distortNumPoints + 3u;
          
          // Validate model2distort coefficients
          if (distortNumPoints == 0u || distortCoeffsOffset * 2u > arrayLength(&model2distortCoeffs)) {
            return baseInverse; // Return base inverse if coefficients are invalid
          }
          
          // For inverse transformation, we need to find the input that produces baseInverse as output
          // Since we have inverse coefficients, we can use them directly
          var Xo = model2distortCoeffs[0] + model2distortCoeffs[1] * baseInverse.x + model2distortCoeffs[2] * baseInverse.y;
          var Yo = model2distortCoeffs[distortCoeffsOffset] + model2distortCoeffs[distortCoeffsOffset + 1] * baseInverse.x + model2distortCoeffs[distortCoeffsOffset + 2] * baseInverse.y;
          
          for (var r = 0u; r < distortNumPoints; r++) {
            // For inverse transformation, use distortPoints as source (since we want to map back to model)
            let sourcePoint = vec2<f32>(distortPoints[r * 2u], distortPoints[r * 2u + 1u]);
            let diff = baseInverse - sourcePoint;
            let tmp = kernelFunction(diff.x, diff.y);
            Xo += model2distortCoeffs[r + 3u] * tmp;
            Yo += model2distortCoeffs[distortCoeffsOffset + r + 3u] * tmp;
          }
          activeInverse = vec2<f32>(Xo, Yo);
        }
        
        // Step 3: baseTPS.forward(activeInverse) - use forward coefficients (offset 2*coeffsOffset)
        var result = vec2<f32>(0.0, 0.0);
        {
          var Xo = baseCoeffs[coeffsOffset * 2u] + baseCoeffs[coeffsOffset * 2u + 1u] * activeInverse.x + baseCoeffs[coeffsOffset * 2u + 2u] * activeInverse.y;
          var Yo = baseCoeffs[coeffsOffset * 3u] + baseCoeffs[coeffsOffset * 3u + 1u] * activeInverse.x + baseCoeffs[coeffsOffset * 3u + 2u] * activeInverse.y;
          
          for (var r = 0u; r < baseNumPoints; r++) {
            let sourcePoint = vec2<f32>(meshPoints[r * 2u], meshPoints[r * 2u + 1u]);
            let diff = activeInverse - sourcePoint;
            let tmp = kernelFunction(diff.x, diff.y);
            Xo += baseCoeffs[coeffsOffset * 2u + r + 3u] * tmp;
            Yo += baseCoeffs[coeffsOffset * 3u + r + 3u] * tmp;
          }
          result = vec2<f32>(Xo, Yo);
        }
        
        return result;
      }

      // Sample image data with bounds checking - use optimized unpacking
      fn sampleImage(x: i32, y: i32) -> vec4<f32> {
        // if (x < 0 || x >= i32(uniforms.imageWidth) || y < 0 || y >= i32(uniforms.imageHeight)) {
        //   return vec4<f32>(0.0, 0.0, 0.0, 0.0);
        // }
        
        let index = (u32(y) % uniforms.imageHeight) * uniforms.imageWidth + (u32(x) % uniforms.imageWidth);
        let pixelData = imageData[index];
        
        // Use the optimized unpacking function
        return unpackRGBA(pixelData);
      }

      // Optimized RGBA packing using vector operations - ARGB format to match unpacking
      fn packRGBA(color: vec4<f32>) -> u32 {
        let rgba = vec4<u32>(color * 255.0);
        return (rgba.a << 24u) | (rgba.r << 16u) | (rgba.g << 8u) | rgba.b;
      }

      // Optimized RGBA unpacking - ARGB format
      fn unpackRGBA(pixelData: u32) -> vec4<f32> {
        return vec4<f32>(
          f32((pixelData >> 16u) & 0xFFu), // R
          f32((pixelData >> 8u) & 0xFFu),  // G
          f32(pixelData & 0xFFu),          // B
          f32((pixelData >> 24u) & 0xFFu)  // A
        ) / 255.0;
      }

      // Extract alpha channel (blur mask) from uint32 - ARGB format
      fn getBlurMask(pixelData: u32) -> f32 {
        return f32((pixelData >> 24u) & 0xFFu);
      }

      @compute @workgroup_size(8, 8)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>, @builtin(local_invocation_id) local_id: vec3<u32>) {
        let x = global_id.x;
        let y = global_id.y;
        
        // Early bounds check
        if (x >= uniforms.faceWidth || y >= uniforms.faceHeight) {
          return;
        }
        
        let faceIndex = y * uniforms.faceWidth + x;
        
        // Add bounds check for buffer access to prevent crashes
        if (faceIndex >= arrayLength(&faceData)) {
          return;
        }

        let alpha = faceData[faceIndex] >> 24u;
        if (alpha == 0u) {
          return;
        }

        // Transform the current pixel coordinates
        let point = vec2<f32>(f32(uniforms.faceMinX + x), f32(uniforms.faceMinY + y));
        let transformed = point + f32(alpha)/255.0 * (transformXY(point) - point);
        
        // Convert float coordinates to integers for sampling
        let sampleX = i32(transformed.x);
        let sampleY = i32(transformed.y);
        
        // Sample the image and write to output
        faceData[faceIndex] = packRGBA(sampleImage(sampleX, sampleY));
      }
    `;

    // Create compute pipeline
    this.computePipeline = this.device.createComputePipeline({
      layout: this.pipelineLayout,
      compute: {
        module: this.device.createShaderModule({
          code: computeShader
        }),
        entryPoint: 'main'
      }
    });
  }

  /**
   * Create buffers for all uniform data
   */
  createBuffers(params: GPUCreateBuffersParams): void {
    if (!this.initialized || !this.device) {
      console.error('GPU not initialized');
      return;
    }

    const {
      baseNumPoints = 0,
      distortNumPoints = 0,
      imageWidth = 0,
      imageHeight = 0,
      faceMinY = 0,
      faceMinX = 0,
      faceWidth = 0,
      faceHeight = 0
    } = params;

    // Uniform buffer
    this.uniformBuffer = this.device.createBuffer({
      size: 8 * 4, // 8 u32 values
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Mesh points buffer
    this.meshPointsBuffer = this.device.createBuffer({
      size: baseNumPoints * 2 * 4, // f32 array
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // Image points buffer
    this.imagePointsBuffer = this.device.createBuffer({
      size: baseNumPoints * 2 * 4, // f32 array
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // Distort points buffer
    this.distortPointsBuffer = this.device.createBuffer({
      size: distortNumPoints * 2 * 4, // f32 array
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // Model points buffer
    this.modelPointsBuffer = this.device.createBuffer({
      size: distortNumPoints * 2 * 4, // f32 array
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // Combined base coefficients (forward and inverse interleaved)
    this.baseCoeffsBuffer = this.device.createBuffer({
      size: (baseNumPoints + 3) * 4 * 4, // 4 sets of coefficients (forward X/Y, inverse X/Y), each with baseNumPoints + 3 elements
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // Model2Distort coefficients
    this.model2distortCoeffsBuffer = this.device.createBuffer({
      size: (distortNumPoints + 3) * 2 * 4, // X and Y coefficients interleaved
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    // Image data buffers
    this.imageDataBuffer = this.device.createBuffer({
      size: imageWidth * imageHeight * 4, // u32 array
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    this.faceDataBuffer = this.device.createBuffer({
      size: faceWidth * faceHeight * 4, // u32 array
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    // Debug buffer for transformation values
    this.debugBuffer = this.device.createBuffer({
      size: 1024 * 4, // 1024 f32 values
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });

    // Create bind group
    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout!,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.meshPointsBuffer } },
        { binding: 2, resource: { buffer: this.imagePointsBuffer } },
        { binding: 3, resource: { buffer: this.distortPointsBuffer } },
        { binding: 4, resource: { buffer: this.modelPointsBuffer } },
        { binding: 5, resource: { buffer: this.baseCoeffsBuffer } },
        { binding: 6, resource: { buffer: this.model2distortCoeffsBuffer } },
        { binding: 7, resource: { buffer: this.imageDataBuffer } },
        { binding: 8, resource: { buffer: this.faceDataBuffer } }
      ]
    });
  }

  /**
   * Batch update multiple buffers in a single command encoder
   */
  batchUpdateBuffers(updates: GPUBufferUpdates): void {
    if (!this.initialized || !this.device) {
      console.error('GPU not initialized');
      return;
    }

    const commandEncoder = this.device.createCommandEncoder();
    
    // Batch all buffer writes
    if (updates.uniforms && this.uniformBuffer) {
      this.device.queue.writeBuffer(this.uniformBuffer, 0, updates.uniforms);
    }
    if (updates.meshPoints && this.meshPointsBuffer) {
      this.device.queue.writeBuffer(this.meshPointsBuffer, 0, updates.meshPoints);
    }
    if (updates.imagePoints && this.imagePointsBuffer) {
      this.device.queue.writeBuffer(this.imagePointsBuffer, 0, updates.imagePoints);
    }
    if (updates.distortPoints && this.distortPointsBuffer) {
      this.device.queue.writeBuffer(this.distortPointsBuffer, 0, updates.distortPoints);
    }
    if (updates.modelPoints && this.modelPointsBuffer) {
      this.device.queue.writeBuffer(this.modelPointsBuffer, 0, updates.modelPoints);
    }
    if (updates.baseCoeffs && this.baseCoeffsBuffer) {
      this.device.queue.writeBuffer(this.baseCoeffsBuffer, 0, updates.baseCoeffs);
    }
    if (updates.model2distortCoeffs && this.model2distortCoeffsBuffer) {
      this.device.queue.writeBuffer(this.model2distortCoeffsBuffer, 0, updates.model2distortCoeffs);
    }
    if (updates.imageData && this.imageDataBuffer) {
      this.device.queue.writeBuffer(this.imageDataBuffer, 0, updates.imageData);
    }
    if (updates.faceData && this.faceDataBuffer) {
      this.device.queue.writeBuffer(this.faceDataBuffer, 0, updates.faceData);
    }
    
    // Submit all updates in one command
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Update uniform buffer with scalar values
   */
  updateUniforms(uniforms: GPUUniforms): void {
    if (!this.initialized || !this.device || !this.uniformBuffer) {
      console.error('GPU not initialized');
      return;
    }

    const uniformData = new Uint32Array([
      uniforms.baseNumPoints || 0,
      uniforms.distortNumPoints || 0,
      uniforms.imageWidth || 0,
      uniforms.imageHeight || 0,
      uniforms.faceMinY || 0,
      uniforms.faceMinX || 0,
      uniforms.faceWidth || 0,
      uniforms.faceHeight || 0
    ]);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  /**
   * Update buffer with float32 data
   */
  updateBuffer(buffer: GPUBuffer, data: Float32Array): void {
    if (!this.initialized || !this.device) {
      console.error('GPU not initialized');
      return;
    }
    this.device.queue.writeBuffer(buffer, 0, data);
  }

  /**
   * Update buffer with uint32 data
   */
  updateUintBuffer(buffer: GPUBuffer, data: Uint32Array): void {
    if (!this.initialized || !this.device) {
      console.error('GPU not initialized');
      return;
    }
    this.device.queue.writeBuffer(buffer, 0, data);
  }

  /**
   * Update combined base coefficients buffer (forward and inverse interleaved)
   */
  updateBaseCoeffs(forwardX: Float32Array, forwardY: Float32Array, inverseX: Float32Array, inverseY: Float32Array): void {
    if (!this.initialized || !this.device || !this.baseCoeffsBuffer) {
      console.error('GPU not initialized');
      return;
    }
    
    const baseNumPoints = forwardX.length - 3;
    const coeffsOffset = baseNumPoints + 3;
    
    // Check buffer size and adjust if necessary
    const bufferSizeInFloats = this.baseCoeffsBuffer.size / 4;
    const requiredSize = coeffsOffset * 4;
    
    if (requiredSize > bufferSizeInFloats) {
      console.error('Buffer too small for coefficients. Need', requiredSize, 'floats, buffer has', bufferSizeInFloats);
      return;
    }
    
    // Create combined array: [forwardX, forwardY, inverseX, inverseY]
    const combinedCoeffs = new Float32Array(requiredSize);
    
    // Copy forward coefficients (first two blocks)
    for (let i = 0; i < coeffsOffset; i++) {
      combinedCoeffs[i] = forwardX[i];                    // forwardX
      combinedCoeffs[i + coeffsOffset] = forwardY[i];     // forwardY
    }
    
    // Copy inverse coefficients (last two blocks)
    for (let i = 0; i < coeffsOffset; i++) {
      combinedCoeffs[i + coeffsOffset * 2] = inverseX[i]; // inverseX
      combinedCoeffs[i + coeffsOffset * 3] = inverseY[i]; // inverseY
    }
    
    this.device.queue.writeBuffer(this.baseCoeffsBuffer, 0, combinedCoeffs);
  }

  /**
   * Update combined coefficients buffer (X and Y interleaved) for active TPS
   */
  updateCombinedCoeffs(buffer: GPUBuffer, Xc: Float32Array, Yc: Float32Array): void {
    if (!this.initialized || !this.device) {
      console.error('GPU not initialized');
      return;
    }

    const combined = new Float32Array(Xc.length + Yc.length);
    for (let i = 0; i < Xc.length; i++) {
      combined[i] = Xc[i];
      combined[i + Xc.length] = Yc[i];
    }
    this.device.queue.writeBuffer(buffer, 0, combined);
  }

  /**
   * Update face data buffer with blur mask in alpha channel
   */
  updateFaceDataWithBlurMask(blurMask: Uint8Array): void {
    if (!this.initialized || !this.device || !this.faceDataBuffer) {
      console.error('GPU not initialized');
      return;
    }

    const faceData = new Uint32Array(blurMask.length);
    for (let i = 0; i < blurMask.length; i++) {
      // Pack blur mask value into alpha channel
      faceData[i] = (blurMask[i] << 24);
    }
    
    this.device.queue.writeBuffer(this.faceDataBuffer, 0, faceData);
  }

  /**
   * Execute compute shader with dynamic workgroup sizing
   * @returns Promise that resolves when execution is complete
   */
  async execute(faceWidth: number, faceHeight: number): Promise<void> {
    if (!this.initialized || !this.device || !this.computePipeline || !this.bindGroup) {
      console.error('GPU not initialized');
      return Promise.reject(new Error('GPU not initialized'));
    }

    const workgroupSize = 8; // 8x8 = 64 threads per workgroup
    const workgroupCountX = Math.ceil(faceWidth / workgroupSize);
    const workgroupCountY = Math.ceil(faceHeight / workgroupSize);
    
    this.commandEncoder = this.device.createCommandEncoder();
    this.computePassEncoder = this.commandEncoder.beginComputePass();
    
    this.computePassEncoder.setPipeline(this.computePipeline);
    this.computePassEncoder.setBindGroup(0, this.bindGroup);

    this.computePassEncoder.dispatchWorkgroups(workgroupCountX, workgroupCountY);
    
    this.computePassEncoder.end();
    this.device.queue.submit([this.commandEncoder.finish()]);
    
    return Promise.resolve();
  }

  /**
   * Read data from buffer
   * @returns Buffer data
   */
  async readBuffer(buffer: GPUBuffer, size: number): Promise<Uint8ClampedArray> {
    if (!this.initialized || !this.device) {
      console.error('GPU not initialized');
      return new Uint8ClampedArray(0);
    }

    const stagingBuffer = this.device.createBuffer({
      size: size,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });

    const commandEncoder = this.device.createCommandEncoder();
    commandEncoder.copyBufferToBuffer(buffer, 0, stagingBuffer, 0, size);
    this.device.queue.submit([commandEncoder.finish()]);

    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const data = stagingBuffer.getMappedRange();
    
    // Copy the data before unmapping to avoid detachment issues
    const result = new Uint8ClampedArray(data);
    const copiedData = new Uint8ClampedArray(result);
    
    stagingBuffer.unmap();
    
    return copiedData;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    
    // Destroy buffers
    const buffers = [
      this.uniformBuffer, this.meshPointsBuffer, this.imagePointsBuffer,
      this.distortPointsBuffer, this.modelPointsBuffer, this.baseCoeffsBuffer,
      this.model2distortCoeffsBuffer, this.imageDataBuffer, this.faceDataBuffer,
      this.debugBuffer
    ];
    
    buffers.forEach(buffer => {
      if (buffer) buffer.destroy();
    });
  }
} 