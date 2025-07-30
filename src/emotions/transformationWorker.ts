import { TPS } from 'transformation-models';

self.onmessage = (e) => {
  const { tps, bbox, mean2monkey } = e.data;
  
  // Reconstruct TPS objects from serialized data
  const tpsInstance = TPS.fromJSON(tps);
  const mean2monkeyInstance = TPS.fromJSON(mean2monkey);
  
  const map = new Map();
  for (let y = bbox.minY; y < bbox.maxY; y++) {
    for (let x = bbox.minX; x < bbox.maxX; x++) {
      const key = `${x},${y}`;
      const inversePoint = mean2monkeyInstance.inverse([x, y, 0]);
      const transformedPoint = tpsInstance.inverse(inversePoint);
      const finalPoint = mean2monkeyInstance.forward(transformedPoint);
      map.set(key, finalPoint);
    }
  }
  
  // Send back the map as array of entries
  self.postMessage(Array.from(map.entries()));
}; 