const h={path:[468,473],closed:!1,name:"Eye line",description:"Draw a line from left to right that connects the centers of the eyes."},d={path:[98,327],closed:!1,name:"Nose line",description:"Draw a line from left to right that connects the outer edge of each nostril."},l={path:[78,308],closed:!1,name:"Mouth line",description:"Draw a line from left to right that connects the left edge of the mouth to the right edge of the mouth."},m={path:[148,377],closed:!1,name:"Chin line",description:"Draw a line from left to right that represents the bottom of the chin."},g={path:[118,347],closed:!1,name:"Cheekbone line",description:"Draw a line from left to right that connects the tops of the cheekbones."},p={path:[105,334],closed:!1,name:"Brow line",description:"Draw a line from left to right that connects the centers of the eyebrows."},P={path:[83,313],closed:!1,name:"Upper chin",description:"Draw a line from left to right that represents the top of the chin under the lips."},v={path:[37,267],closed:!1,name:"Upper lip",description:"Draw a line from left to right that connects the peaks of the upper lip."},b={path:[10,168],closed:!1,name:"Top symmetry",description:"Draw a line from the top center of the forehead to the bridge of the nose."},B={path:[226,446],closed:!1,name:"Outer corners of eyes",description:"Draw a line from left to right that connects the outer corners of the eyes."},y={path:[173,398],closed:!1,name:"Inner corners of eyes",description:"Draw a line from left to right that connects the inner corners (tear ducts) of the eyes."},C={path:[470,472],closed:!1,name:"Left eye bisect",description:"Draw a line from top to bottom that bisects the left eye."},U={path:[475,477],closed:!1,name:"Right eye bisect",description:"Draw a line from top to bottom that bisects the right eye."},w={path:[67,297],closed:!1,name:"Forehead line",description:"Draw a line from left to right that connects the middle of the forehead above the eyebrows."},_={path:[172,397],closed:!1,name:"Jaw line",description:"Draw a line from left to right that represents the bottom of the jaw at the outside of the face."},G={path:[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109],closed:!0,name:"Silhouette",description:"Starting at the top of the forehead and going clockwise, outline the face."},x={pupilLine:h,noseLine:d,mouthLine:l,chinLine:m,cheekboneLine:g,browLine:p,upperChin:P,upperLip:v,topBridge:b,outerEyes:B,innerEyes:y,leftEyeBisection:C,rightEyeBisection:U,foreheadLine:w,jawLine:_,silhouette:G};function D(u=0,e=0){const t=[];for(let i=0;i<u;i++){t[i]=[];for(let s=0;s<e;s++)t[i][s]=0}return t}function S(u){if(u.length!==u[0].length)return;let e=0,t=0,i=0,s=u.length,o=0,f=[],r=[];for(e=0;e<s;e+=1)for(f[f.length]=[],r[r.length]=[],i=0;i<s;i+=1)e==i?f[e][i]=1:f[e][i]=0,r[e][i]=u[e][i];for(e=0;e<s;e+=1){if(o=r[e][e],o==0){for(t=e+1;t<s;t+=1)if(r[t][e]!=0){for(i=0;i<s;i++)o=r[e][i],r[e][i]=r[t][i],r[t][i]=o,o=f[e][i],f[e][i]=f[t][i],f[t][i]=o;break}if(o=r[e][e],o==0)return}for(i=0;i<s;i++)r[e][i]=r[e][i]/o,f[e][i]=f[e][i]/o;for(t=0;t<s;t++)if(t!=e)for(o=r[t][e],i=0;i<s;i++)r[t][i]-=o*r[e][i],f[t][i]-=o*f[e][i]}return f}class O{_sourcePoints;_targetPoints;_forwardParameters;_inverseParameters;constructor(){this._sourcePoints=[],this._targetPoints=[],this._forwardParameters={},this._inverseParameters={}}get sourcePoints(){return this._sourcePoints}get targetPoints(){return this._targetPoints}get forwardParameters(){return this._forwardParameters}set forwardParameters(e){this._forwardParameters=e}get inverseParameters(){return this._inverseParameters}set inverseParameters(e){this._inverseParameters=e}calculate(e,t){this._sourcePoints=e,this._targetPoints=t,this._forwardParameters=this.__calculateParameters(e,t),this._inverseParameters=this.__calculateParameters(t,e)}__calculateParameters(e,t){throw new Error("__calculateParameters must be implemented by subclass")}}class E extends O{invA;kernelCache;constructor(e,t){super(),this.invA=null,this.kernelCache=new Map,e&&t&&this.calculate(e,t)}forward(e){return this.__isEmpty(this._forwardParameters)?e:this.__transform(e,this._forwardParameters)}inverse(e){return this.__isEmpty(this._inverseParameters)?e:this.__transform(e,this._inverseParameters)}__transform(e,t){let i=t.Xc[0]+t.Xc[1]*e[0]+t.Xc[2]*e[1],s=t.Yc[0]+t.Yc[1]*e[0]+t.Yc[2]*e[1];for(let o=0;o<t.m;o++){const f=this.__kernelFunction(e[0]-t.sourcePoints[o][0],e[1]-t.sourcePoints[o][1]);i+=t.Xc[o+3]*f,s+=t.Yc[o+3]*f}return[i,s]}__calculateParameters(e,t){if(e.length!==t.length)return console.warn("Number of points do not match!"),null;const i=e.length;let s=D(i+3,i+3);for(let r=0;r<i;r++)s[0][3+r]=1,s[1][3+r]=e[r][0],s[2][3+r]=e[r][1],s[3+r][0]=1,s[3+r][1]=e[r][0],s[3+r][2]=e[r][1];for(let r=0;r<i;r++)for(let a=0;a<i;a++)s[r+3][a+3]=this.__kernelFunction(e[r][0]-e[a][0],e[r][1]-e[a][1]),s[a+3][r+3]=s[r+3][a+3];if(this.invA=S(s),this.invA===null)return null;let o=new Float64Array(i+3),f=new Float64Array(i+3);for(let r=0;r<i+3;r++)for(let a=0;a<i;a++)o[r]+=this.invA[r][a+3]*t[a][0],f[r]+=this.invA[r][a+3]*t[a][1];return{m:i,Xc:o,Yc:f,sourcePoints:e}}updateParameters(e){this._targetPoints=e;const t=this.targetPoints.length;let i=new Float64Array(t+3),s=new Float64Array(t+3);for(let o=0;o<t+3;o++)for(let f=0;f<t;f++)i[o]+=this.invA[o][f+3]*e[f][0],s[o]+=this.invA[o][f+3]*e[f][1];return this._forwardParameters.Xc=[...i],this._forwardParameters.Yc=[...s],{Xc:i,Yc:s}}updateInverseParameters(e){this._targetPoints=[...e];const t=this.__calculateParameters(this._targetPoints,this._sourcePoints);return t&&!this.__isEmpty(t)&&(this._inverseParameters=t,this._inverseParameters.Yc[1]=0,this._inverseParameters.Yc[2]=1,this._inverseParameters.Xc[1]=1,this._inverseParameters.Xc[2]=0),this._inverseParameters}__kernelFunction(e,t){if(e==0&&t==0)return 0;const i=e*e+t*t;return i*Math.log(i)}__isEmpty(e){return Object.keys(e).length===0&&e.constructor===Object}}class z{device;context;canvas;commandEncoder;computePassEncoder;initialized;uniformBuffer;meshPointsBuffer;imagePointsBuffer;distortPointsBuffer;modelPointsBuffer;baseCoeffsBuffer;model2distortCoeffsBuffer;imageDataBuffer;faceDataBuffer;debugBuffer;bindGroup;bindGroupLayout;pipelineLayout;computePipeline;constructor(){this.device=null,this.context=null,this.canvas=null,this.commandEncoder=null,this.computePassEncoder=null,this.initialized=!1,this.uniformBuffer=null,this.meshPointsBuffer=null,this.imagePointsBuffer=null,this.distortPointsBuffer=null,this.modelPointsBuffer=null,this.baseCoeffsBuffer=null,this.model2distortCoeffsBuffer=null,this.imageDataBuffer=null,this.faceDataBuffer=null,this.debugBuffer=null,this.bindGroup=null,this.bindGroupLayout=null,this.pipelineLayout=null,this.computePipeline=null}async initialize(){try{if(!navigator.gpu)return console.error("WebGPU not supported"),!1;const e=await navigator.gpu.requestAdapter();return e?(this.device=await e.requestDevice({requiredLimits:{maxStorageBuffersPerShaderStage:10}}),this.canvas=document.createElement("canvas"),this.canvas.style.display="none",document.body.appendChild(this.canvas),this.context=this.canvas.getContext("webgpu"),this.context?(await this.setupComputeShader(),this.initialized=!0,!0):(console.error("WebGPU context not available"),!1)):(console.error("No WebGPU adapter found"),!1)}catch(e){return console.error("Failed to initialize WebGPU:",e),!1}}async setupComputeShader(){if(!this.device)throw new Error("Device not initialized");this.bindGroupLayout=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:6,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:7,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:8,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}}]}),this.pipelineLayout=this.device.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]});const e=`
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
    `;this.computePipeline=this.device.createComputePipeline({layout:this.pipelineLayout,compute:{module:this.device.createShaderModule({code:e}),entryPoint:"main"}})}createBuffers(e){if(!this.initialized||!this.device){console.error("GPU not initialized");return}const{baseNumPoints:t=0,distortNumPoints:i=0,imageWidth:s=0,imageHeight:o=0,faceMinY:f=0,faceMinX:r=0,faceWidth:a=0,faceHeight:c=0}=e;this.uniformBuffer=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.meshPointsBuffer=this.device.createBuffer({size:t*2*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.imagePointsBuffer=this.device.createBuffer({size:t*2*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.distortPointsBuffer=this.device.createBuffer({size:i*2*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.modelPointsBuffer=this.device.createBuffer({size:i*2*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.baseCoeffsBuffer=this.device.createBuffer({size:(t+3)*4*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.model2distortCoeffsBuffer=this.device.createBuffer({size:(i+3)*2*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.imageDataBuffer=this.device.createBuffer({size:s*o*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),this.faceDataBuffer=this.device.createBuffer({size:a*c*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),this.debugBuffer=this.device.createBuffer({size:1024*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC}),this.bindGroup=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.uniformBuffer}},{binding:1,resource:{buffer:this.meshPointsBuffer}},{binding:2,resource:{buffer:this.imagePointsBuffer}},{binding:3,resource:{buffer:this.distortPointsBuffer}},{binding:4,resource:{buffer:this.modelPointsBuffer}},{binding:5,resource:{buffer:this.baseCoeffsBuffer}},{binding:6,resource:{buffer:this.model2distortCoeffsBuffer}},{binding:7,resource:{buffer:this.imageDataBuffer}},{binding:8,resource:{buffer:this.faceDataBuffer}}]})}batchUpdateBuffers(e){if(!this.initialized||!this.device){console.error("GPU not initialized");return}const t=this.device.createCommandEncoder();e.uniforms&&this.uniformBuffer&&this.device.queue.writeBuffer(this.uniformBuffer,0,e.uniforms),e.meshPoints&&this.meshPointsBuffer&&this.device.queue.writeBuffer(this.meshPointsBuffer,0,e.meshPoints),e.imagePoints&&this.imagePointsBuffer&&this.device.queue.writeBuffer(this.imagePointsBuffer,0,e.imagePoints),e.distortPoints&&this.distortPointsBuffer&&this.device.queue.writeBuffer(this.distortPointsBuffer,0,e.distortPoints),e.modelPoints&&this.modelPointsBuffer&&this.device.queue.writeBuffer(this.modelPointsBuffer,0,e.modelPoints),e.baseCoeffs&&this.baseCoeffsBuffer&&this.device.queue.writeBuffer(this.baseCoeffsBuffer,0,e.baseCoeffs),e.model2distortCoeffs&&this.model2distortCoeffsBuffer&&this.device.queue.writeBuffer(this.model2distortCoeffsBuffer,0,e.model2distortCoeffs),e.imageData&&this.imageDataBuffer&&this.device.queue.writeBuffer(this.imageDataBuffer,0,e.imageData),e.faceData&&this.faceDataBuffer&&this.device.queue.writeBuffer(this.faceDataBuffer,0,e.faceData),this.device.queue.submit([t.finish()])}updateUniforms(e){if(!this.initialized||!this.device||!this.uniformBuffer){console.error("GPU not initialized");return}const t=new Uint32Array([e.baseNumPoints||0,e.distortNumPoints||0,e.imageWidth||0,e.imageHeight||0,e.faceMinY||0,e.faceMinX||0,e.faceWidth||0,e.faceHeight||0]);this.device.queue.writeBuffer(this.uniformBuffer,0,t)}updateBuffer(e,t){if(!this.initialized||!this.device){console.error("GPU not initialized");return}this.device.queue.writeBuffer(e,0,t)}updateUintBuffer(e,t){if(!this.initialized||!this.device){console.error("GPU not initialized");return}this.device.queue.writeBuffer(e,0,t)}updateBaseCoeffs(e,t,i,s){if(!this.initialized||!this.device||!this.baseCoeffsBuffer){console.error("GPU not initialized");return}const f=e.length-3+3,r=this.baseCoeffsBuffer.size/4,a=f*4;if(a>r){console.error("Buffer too small for coefficients. Need",a,"floats, buffer has",r);return}const c=new Float32Array(a);for(let n=0;n<f;n++)c[n]=e[n],c[n+f]=t[n];for(let n=0;n<f;n++)c[n+f*2]=i[n],c[n+f*3]=s[n];this.device.queue.writeBuffer(this.baseCoeffsBuffer,0,c)}updateCombinedCoeffs(e,t,i){if(!this.initialized||!this.device){console.error("GPU not initialized");return}const s=new Float32Array(t.length+i.length);for(let o=0;o<t.length;o++)s[o]=t[o],s[o+t.length]=i[o];this.device.queue.writeBuffer(e,0,s)}updateFaceDataWithBlurMask(e){if(!this.initialized||!this.device||!this.faceDataBuffer){console.error("GPU not initialized");return}const t=new Uint32Array(e.length);for(let i=0;i<e.length;i++)t[i]=e[i]<<24;this.device.queue.writeBuffer(this.faceDataBuffer,0,t)}async execute(e,t){if(!this.initialized||!this.device||!this.computePipeline||!this.bindGroup)return console.error("GPU not initialized"),Promise.reject(new Error("GPU not initialized"));const i=8,s=Math.ceil(e/i),o=Math.ceil(t/i);return this.commandEncoder=this.device.createCommandEncoder(),this.computePassEncoder=this.commandEncoder.beginComputePass(),this.computePassEncoder.setPipeline(this.computePipeline),this.computePassEncoder.setBindGroup(0,this.bindGroup),this.computePassEncoder.dispatchWorkgroups(s,o),this.computePassEncoder.end(),this.device.queue.submit([this.commandEncoder.finish()]),Promise.resolve()}async readBuffer(e,t){if(!this.initialized||!this.device)return console.error("GPU not initialized"),new Uint8ClampedArray(0);const i=this.device.createBuffer({size:t,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),s=this.device.createCommandEncoder();s.copyBufferToBuffer(e,0,i,0,t),this.device.queue.submit([s.finish()]),await i.mapAsync(GPUMapMode.READ);const o=i.getMappedRange(),f=new Uint8ClampedArray(o),r=new Uint8ClampedArray(f);return i.unmap(),r}destroy(){this.canvas&&this.canvas.parentNode&&this.canvas.parentNode.removeChild(this.canvas),[this.uniformBuffer,this.meshPointsBuffer,this.imagePointsBuffer,this.distortPointsBuffer,this.modelPointsBuffer,this.baseCoeffsBuffer,this.model2distortCoeffsBuffer,this.imageDataBuffer,this.faceDataBuffer,this.debugBuffer].forEach(t=>{t&&t.destroy()})}}export{z as G,E as T,x as f,G as s};
