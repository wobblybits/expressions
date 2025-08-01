export class PerformanceMonitor {
    private measurements: Map<string, number[]> = new Map();
    private startTimes: Map<string, number> = new Map();

    startTimer(name: string): void {
        this.startTimes.set(name, performance.now());
    }

    endTimer(name: string): number {
        const startTime = this.startTimes.get(name);
        if (!startTime) return 0;

        const duration = performance.now() - startTime;
        this.startTimes.delete(name);

        if (!this.measurements.has(name)) {
            this.measurements.set(name, []);
        }
        this.measurements.get(name)!.push(duration);

        return duration;
    }

    getAverageTime(name: string): number {
        const times = this.measurements.get(name);
        if (!times || times.length === 0) return 0;
        return times.reduce((a, b) => a + b, 0) / times.length;
    }

    getStats(name: string): { avg: number; min: number; max: number; count: number } {
        const times = this.measurements.get(name);
        if (!times || times.length === 0) {
            return { avg: 0, min: 0, max: 0, count: 0 };
        }

        return {
            avg: times.reduce((a, b) => a + b, 0) / times.length,
            min: Math.min(...times),
            max: Math.max(...times),
            count: times.length
        };
    }

    clear(name?: string): void {
        if (name) {
            this.measurements.delete(name);
        } else {
            this.measurements.clear();
        }
    }
}

export default PerformanceMonitor;