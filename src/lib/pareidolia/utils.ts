export type BBox = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export const getBBox = (points: number[][]): BBox => {
return {
  minX: Math.floor(Math.min(...points.map(p => p[0]))),
  maxX: Math.ceil(Math.max(...points.map(p => p[0]))),
  minY: Math.floor(Math.min(...points.map(p => p[1]))),
  maxY: Math.ceil(Math.max(...points.map(p => p[1]))),
  minZ: Math.floor(Math.min(...points.map(p => p[2]))),
  maxZ: Math.ceil(Math.max(...points.map(p => p[2]))),
};
};

// Helper function to calculate cross product of three points
export const crossProduct = (p1: number[], p2: number[], p3: number[]): number => {
return (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
};

// Helper function to calculate distance between two points
export const distance = (p1: number[], p2: number[]): number => {
return Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
};

// Function to calculate convex hull using Graham's scan algorithm
export const calculateConvexHull = (points: number[][]): number[][] => {
if (points.length < 3) return points;

// Find the point with the lowest y-coordinate (and leftmost if tied)
let lowest = 0;
for (let i = 1; i < points.length; i++) {
  if (points[i][1] < points[lowest][1] || 
      (points[i][1] === points[lowest][1] && points[i][0] < points[lowest][0])) {
    lowest = i;
  }
}

// Sort points by polar angle with respect to the lowest point
const start = points[lowest];
const sortedPoints = points
  .filter((_, i) => i !== lowest)
  .sort((a, b) => {
    const angleA = Math.atan2(a[1] - start[1], a[0] - start[0]);
    const angleB = Math.atan2(b[1] - start[1], b[0] - start[0]);
    if (angleA !== angleB) return angleA - angleB;
    return distance(start, a) - distance(start, b);
  });

// Graham's scan
const hull: number[][] = [start];
for (const point of sortedPoints) {
  while (hull.length > 1 && crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
    hull.pop();
  }
  hull.push(point);
}

return hull;
};

// Function to check if a point lies within the convex hull
export const isPointInConvexHull = (point: number[], hull: number[][]): boolean => {
if (hull.length < 3) return false;

// Check if point is on the same side of all edges
for (let i = 0; i < hull.length; i++) {
  const p1 = hull[i];
  const p2 = hull[(i + 1) % hull.length];
  const cross = crossProduct(p1, p2, point);
  
  // If cross product is negative, point is outside
  if (cross < 0) return false;
}

return true;
};