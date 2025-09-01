// WebGPU type declarations
declare global {
  interface Navigator {
    gpu: {
      requestAdapter(): Promise<GPUAdapter | null>;
    };
  }
  
  interface GPUAdapter {
    requestDevice(options: GPUDeviceDescriptor): Promise<GPUDevice>;
  }
  
  interface GPUDeviceDescriptor {
    requiredLimits?: GPULimits;
  }
  
  interface GPULimits {
    maxStorageBuffersPerShaderStage?: number;
  }
  
  interface GPUBuffer {
    size: number;
    usage: number;
    destroy(): void;
    mapAsync(mode: number): Promise<void>;
    getMappedRange(): ArrayBuffer;
    unmap(): void;
  }
  
  interface GPUDevice {
    createBindGroupLayout(options: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
    createPipelineLayout(options: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
    createComputePipeline(options: GPUComputePipelineDescriptor): GPUComputePipeline;
    createBuffer(options: GPUBufferDescriptor): GPUBuffer;
    createBindGroup(options: GPUBindGroupDescriptor): GPUBindGroup;
    createCommandEncoder(): GPUCommandEncoder;
    createShaderModule(options: GPUShaderModuleDescriptor): GPUShaderModule;
    queue: GPUQueue;
  }
  
  interface GPUCanvasContext {
    configure(config: GPUCanvasConfiguration): void;
    getCurrentTexture(): GPUTexture;
  }
  
  interface GPUCanvasConfiguration {
    device: GPUDevice;
    format: GPUTextureFormat;
    usage?: number;
  }
  
  interface GPUTexture {
    destroy(): void;
  }
  
  interface GPUTextureFormat {
    // WebGPU texture format constants
  }
  
  interface GPUCommandEncoder {
    beginComputePass(): GPUComputePassEncoder;
    copyBufferToBuffer(source: GPUBuffer, sourceOffset: number, destination: GPUBuffer, destinationOffset: number, size: number): void;
    finish(): GPUCommandBuffer;
  }
  
  interface GPUCommandBuffer {}
  
  interface GPUComputePassEncoder {
    setPipeline(pipeline: GPUComputePipeline): void;
    setBindGroup(index: number, bindGroup: GPUBindGroup): void;
    dispatchWorkgroups(x: number, y?: number, z?: number): void;
    end(): void;
  }
  
  interface GPUBindGroup {
    // Bind group interface
  }
  
  interface GPUBindGroupLayout {
    // Bind group layout interface
  }
  
  interface GPUPipelineLayout {
    // Pipeline layout interface
  }
  
  interface GPUComputePipeline {
    // Compute pipeline interface
  }
  
  interface GPUShaderModule {
    // Shader module interface
  }
  
  interface GPUQueue {
    writeBuffer(buffer: GPUBuffer, offset: number, data: ArrayBufferView): void;
    submit(commands: GPUCommandBuffer[]): void;
  }
  
  interface GPUBindGroupLayoutDescriptor {
    entries: GPUBindGroupLayoutEntry[];
  }
  
  interface GPUBindGroupLayoutEntry {
    binding: number;
    visibility: number;
    buffer?: GPUBufferBindingLayout;
  }
  
  interface GPUBufferBindingLayout {
    type: 'uniform' | 'storage' | 'read-only-storage';
  }
  
  interface GPUPipelineLayoutDescriptor {
    bindGroupLayouts: GPUBindGroupLayout[];
  }
  
  interface GPUComputePipelineDescriptor {
    layout: GPUPipelineLayout;
    compute: GPUProgrammableStage;
  }
  
  interface GPUProgrammableStage {
    module: GPUShaderModule;
    entryPoint: string;
  }
  
  interface GPUBufferDescriptor {
    size: number;
    usage: number;
  }
  
  interface GPUBindGroupDescriptor {
    layout: GPUBindGroupLayout;
    entries: GPUBindGroupEntry[];
  }
  
  interface GPUBindGroupEntry {
    binding: number;
    resource: GPUBindingResource;
  }
  
  interface GPUBindingResource {
    buffer: GPUBuffer;
  }
  
  interface GPUShaderModuleDescriptor {
    code: string;
  }
  
  // WebGPU constants
  const GPUShaderStage: {
    COMPUTE: number;
  };
  
  const GPUBufferUsage: {
    UNIFORM: number;
    STORAGE: number;
    COPY_DST: number;
    COPY_SRC: number;
    MAP_READ: number;
  };
  
  const GPUMapMode: {
    READ: number;
  };
}

export {}; 