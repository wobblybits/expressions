let moduleInstance = null;

export async function initializeTPSModule() {
    if (!moduleInstance) {
        moduleInstance = await import('./tps.js');
    }
    return moduleInstance;
} 