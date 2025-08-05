/**
 * WebGPU-based TPS transformation implementation
 * Provides GPU-accelerated thin plate spline transformations
 */

export default class GPU {
  constructor() {
    this.device = null;
    this.context = null;
    this.canvas = null;
    this.commandEncoder = null;
    this.computePassEncoder = null;
    this.initialized = false; // Add initialization flag
    
    // Buffer references
    this.uniformBuffer = null;
    this.meshPointsBuffer = null;
    this.imagePointsBuffer = null;
    this.distortPointsBuffer = null;
    this.modelPointsBuffer = null;
    this.baseCoeffsBuffer = null; // Combined forward/inverse coefficients
    this.model2distortCoeffsBuffer = null; // Active TPS coefficients
    this.imageDataBuffer = null;
    this.faceDataBuffer = null;
    this.debugBuffer = null; // Debug buffer for transformation values
    
    // Bind group
    this.bindGroup = null;
    this.bindGroupLayout = null;
    this.pipelineLayout = null;
    this.computePipeline = null;
  }

  /**
   * Initialize WebGPU device and context
   * @returns {Promise<boolean>} - true if initialization successful
   */
  async initialize() {
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
      this.initialized = true; // Set initialization flag
      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      return false;
    }
  }

  /**
   * Set up compute shader and pipeline
   */
  async setupComputeShader() {
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
        // Image data buffer
        {
          binding: 7,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'storage' }
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
        FaceMinY: u32,
        FaceMinX: u32,
        FaceWidth: u32,
        FaceHeight: u32,
      }

      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var<storage, read> meshPoints: array<f32>;
      @group(0) @binding(2) var<storage, read> imagePoints: array<f32>;
      @group(0) @binding(3) var<storage, read> distortPoints: array<f32>;
      @group(0) @binding(4) var<storage, read> modelPoints: array<f32>;
      @group(0) @binding(5) var<storage, read> baseCoeffs: array<f32>;
      @group(0) @binding(6) var<storage, read> model2distortCoeffs: array<f32>;
      @group(0) @binding(7) var<storage, read_write> imageData: array<u32>;
      @group(0) @binding(8) var<storage, read_write> faceData: array<u32>;

      // Radial basis function - r^2 * log(r)
      fn kernelFunction(dx: f32, dy: f32) -> f32 {
        if (dx == 0.0 && dy == 0.0) {
          return 0.0;
        }
        let dist = dx * dx + dy * dy;
        return dist * log(dist);
      }

      // Transform XY function: baseTPS.forward(activeTPS.inverse(baseTPS.inverse(point)))
      fn transformXY(point: vec2<f32>) -> vec2<f32> {
        let baseNumPoints = uniforms.baseNumPoints;
        let coeffsOffset = baseNumPoints + 3u;
        
        // Step 1: baseTPS.inverse(point) - use inverse coefficients (offset 0)
        var baseInverse = vec2<f32>(0.0, 0.0);
        {
          var Xo = baseCoeffs[0] + baseCoeffs[1] * point.x + baseCoeffs[2] * point.y;
          var Yo = baseCoeffs[coeffsOffset] + baseCoeffs[coeffsOffset + 1] * point.x + baseCoeffs[coeffsOffset + 2] * point.y;
          
          for (var r = 0u; r < baseNumPoints; r++) {
            let sourceX = imagePoints[r * 2u];
            let sourceY = imagePoints[r * 2u + 1u];
            let tmp = kernelFunction(point.x - sourceX, point.y - sourceY);
            Xo += baseCoeffs[r + 3u] * tmp;
            Yo += baseCoeffs[coeffsOffset + r + 3u] * tmp;
          }
          baseInverse = vec2<f32>(Xo, Yo);
        }
        
        // Step 2: activeTPS.inverse(baseInverse)
        var activeInverse = vec2<f32>(0.0, 0.0);
        {
          let distortNumPoints = uniforms.distortNumPoints;
          let distortCoeffsOffset = distortNumPoints + 3u;
          
          var Xo = model2distortCoeffs[0] + model2distortCoeffs[1] * baseInverse.x + model2distortCoeffs[2] * baseInverse.y;
          var Yo = model2distortCoeffs[distortCoeffsOffset] + model2distortCoeffs[distortCoeffsOffset + 1] * baseInverse.x + model2distortCoeffs[distortCoeffsOffset + 2] * baseInverse.y;
          
          for (var r = 0u; r < distortNumPoints; r++) {
            let sourceX = modelPoints[r * 2u];
            let sourceY = modelPoints[r * 2u + 1u];
            let tmp = kernelFunction(baseInverse.x - sourceX, baseInverse.y - sourceY);
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
            let sourceX = meshPoints[r * 2u];
            let sourceY = meshPoints[r * 2u + 1u];
            let tmp = kernelFunction(activeInverse.x - sourceX, activeInverse.y - sourceY);
            Xo += baseCoeffs[coeffsOffset * 2u + r + 3u] * tmp;
            Yo += baseCoeffs[coeffsOffset * 3u + r + 3u] * tmp;
          }
          result = vec2<f32>(Xo, Yo);
        }
        
        return result;
      }

      // Sample image data with bounds checking
      fn sampleImage(x: i32, y: i32) -> vec4<f32> {
        if (x < 0 || x >= i32(uniforms.imageWidth) || y < 0 || y >= i32(uniforms.imageHeight)) {
          return vec4<f32>(0.0, 0.0, 0.0, 0.0);
        }
        
        let index = u32(y) * uniforms.imageWidth + u32(x);
        let pixelData = imageData[index];
        
        // Convert RGBA from uint32 to vec4
        return vec4<f32>(
          f32(pixelData & 0xFFu) / 255.0,
          f32((pixelData >> 8u) & 0xFFu) / 255.0,
          f32((pixelData >> 16u) & 0xFFu) / 255.0,
          f32((pixelData >> 24u) & 0xFFu) / 255.0
        );
      }

      // Pack RGBA to uint32
      fn packRGBA(color: vec4<f32>) -> u32 {
        let r = u32(clamp(color.r, 0.0, 1.0) * 255.0);
        let g = u32(clamp(color.g, 0.0, 1.0) * 255.0);
        let b = u32(clamp(color.b, 0.0, 1.0) * 255.0);
        let a = u32(clamp(color.a, 0.0, 1.0) * 255.0);
        return r | (g << 8u) | (b << 16u) | (a << 24u);
      }

      // Extract alpha channel (blur mask) from uint32
      fn getBlurMask(pixelData: u32) -> f32 {
        return f32((pixelData >> 24u) & 0xFFu);
      }

      @compute @workgroup_size(8, 8)
      fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
        let x = global_id.x;
        let y = global_id.y;
        
        // Check bounds
        if (x >= uniforms.FaceWidth || y >= uniforms.FaceHeight) {
          return;
        }
        
        let faceIndex = y * uniforms.FaceWidth + x;
        
        // Get blur mask value from faceData alpha channel
        let facePixel = faceData[faceIndex];
        let blurMaskValue = getBlurMask(facePixel);
        
        // Skip if mask is zero
        if (blurMaskValue == 0.0) {
          return;
        }
        
        // Calculate original image coordinates
        let originalX = f32(x) + f32(uniforms.FaceMinX);
        let originalY = f32(y) + f32(uniforms.FaceMinY);
        
        // Apply TPS transformation
        let transformed = transformXY(vec2<f32>(originalX, originalY));
        
        // DEBUG: Output original vs transformed coordinates
        let debugColor = u32(originalX) | 
                        (u32(originalY) << 8u) | 
                        (u32(transformed.x) << 16u) | 
                        (255u << 24u);
        faceData[faceIndex] = debugColor;
        return;
        
        // Clamp transformation to reasonable bounds
        let clampedX = clamp(transformed.x, 0.0, f32(uniforms.imageWidth - 1));
        let clampedY = clamp(transformed.y, 0.0, f32(uniforms.imageHeight - 1));
        
        // Apply blur mask weighting
        let weight = blurMaskValue / 255.0;
        let weightedX = originalX + weight * (clampedX - originalX);
        let weightedY = originalY + weight * (clampedY - originalY);
        
        // Sample image data
        let sampleX = i32(round(weightedX));
        let sampleY = i32(round(weightedY));
        let color = sampleImage(sampleX, sampleY);
        
        // Write to output buffer
        faceData[faceIndex] = packRGBA(color);
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
   * @param {Object} params - Parameters for buffer creation
   */
  createBuffers(params) {
    if (!this.initialized) {
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
      layout: this.bindGroupLayout,
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
   * Update uniform buffer with scalar values
   * @param {Object} uniforms - Uniform values
   */
  updateUniforms(uniforms) {
    if (!this.initialized) {
      console.error('GPU not initialized');
      return;
    }

    const uniformData = new Uint32Array([
      uniforms.baseNumPoints || 0,
      uniforms.distortNumPoints || 0,
      uniforms.imageWidth || 0,
      uniforms.imageHeight || 0,
      uniforms.FaceMinY || 0,
      uniforms.FaceMinX || 0,
      uniforms.FaceWidth || 0,
      uniforms.FaceHeight || 0
    ]);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  /**
   * Update buffer with float32 data
   * @param {GPUBuffer} buffer - Target buffer
   * @param {Float32Array} data - Data to write
   */
  updateBuffer(buffer, data) {
    if (!this.initialized) {
      console.error('GPU not initialized');
      return;
    }
    this.device.queue.writeBuffer(buffer, 0, data);
  }

  /**
   * Update buffer with uint32 data
   * @param {GPUBuffer} buffer - Target buffer
   * @param {Uint32Array} data - Data to write
   */
  updateUintBuffer(buffer, data) {
    if (!this.initialized) {
      console.error('GPU not initialized');
      return;
    }
    this.device.queue.writeBuffer(buffer, 0, data);
  }

  /**
   * Update combined base coefficients buffer (forward and inverse interleaved)
   * @param {Float32Array} forwardX - Forward X coefficients
   * @param {Float32Array} forwardY - Forward Y coefficients
   * @param {Float32Array} inverseX - Inverse X coefficients
   * @param {Float32Array} inverseY - Inverse Y coefficients
   */
  updateBaseCoeffs(forwardX, forwardY, inverseX, inverseY) {
    if (!this.initialized) {
      console.error('GPU not initialized');
      return;
    }
    
    const baseNumPoints = forwardX.length - 3;
    const coeffsOffset = baseNumPoints + 3;
    
    // Check buffer size and adjust if necessary
    const bufferSizeInFloats = this.baseCoeffsBuffer.size / 4;
    const requiredSize = coeffsOffset * 4;
    
    console.log('updateBaseCoeffs debug:', {
      baseNumPoints,
      coeffsOffset,
      bufferSizeInFloats,
      requiredSize,
      bufferSize: this.baseCoeffsBuffer.size
    });
    
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
   * @param {GPUBuffer} buffer - Target buffer
   * @param {Float32Array} Xc - X coefficients
   * @param {Float32Array} Yc - Y coefficients
   */
  updateCombinedCoeffs(buffer, Xc, Yc) {
    if (!this.initialized) {
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
   * @param {Uint8Array} blurMask - Blur mask data
   */
  updateFaceDataWithBlurMask(blurMask) {
    if (!this.initialized) {
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
   * @param {number} faceWidth - Width of face region
   * @param {number} faceHeight - Height of face region
   * @returns {Promise<void>}
   */
  async execute(faceWidth, faceHeight) {
    if (!this.initialized) {
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
   * @param {GPUBuffer} buffer - Source buffer
   * @param {number} size - Size in bytes to read
   * @returns {Promise<ArrayBuffer>} - Buffer data
   */
  async readBuffer(buffer, size) {
    if (!this.initialized) {
      console.error('GPU not initialized');
      return new Uint8Array(0);
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
    const result = new Uint8Array(data);
    const copiedData = new Uint8Array(result);
    
    stagingBuffer.unmap();
    
    return copiedData;
  }

  /**
   * Clean up resources
   */
  destroy() {
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