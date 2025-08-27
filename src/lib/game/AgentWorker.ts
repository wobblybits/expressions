import Agent from './Agent';

// Global variables for the worker
let agents: Agent[] = [];
let gridSize: number;
let extroversion: number = 1;
let learningRate: number = 1;
let idealVector: number[] = [];

const updateAgents = () => {
    for (const agent of agents) {
        agent.isPaired = false;
    }
    
    for (var i = 0; i < gridSize; i++) {
        for (var j = 0; j < gridSize; j++) {
            const agent = agents[i * gridSize + j];
            if (!agent.isPaired) {
                let notPaired = true;
                let attempts = 0;
                while (notPaired && attempts < extroversion) {
                    attempts++;
                    let dx = Math.round(Math.random() * 2.98 - 1.49);
                    let dy = Math.round(Math.random() * 2.98 - 1.49);
                    const j2 = Math.max(0, Math.min(gridSize - 1, j + dx));
                    const i2 = Math.max(0, Math.min(gridSize - 1, i + dy));  
                    dx = j2 - j;
                    dy = i2 - i;
                    if (dx == 0 && dy == 0) {
                        continue;
                    }
                    const otherAgent = agents[i2 * gridSize + j2];
                    if (otherAgent && !otherAgent.isPaired) {
                        agent.interact(otherAgent.internalState, learningRate, idealVector);
                        otherAgent.interact(agent.internalState, learningRate, idealVector);
                        agent.faceDirection(dx, dy);
                        otherAgent.faceDirection(-dx, -dy);
                        notPaired = false;
                    }
                }
                if (notPaired) {
                    agent.interact(agent.internalState, learningRate, idealVector);
                    agent.faceDirection(0, 0);
                }
            }
        }
    }
};

// Worker message handler
self.onmessage = (e) => {
    const { type, data } = e.data;
    
    switch (type) {
        case 'init':
            // Initialize agents
            gridSize = data.gridSize;
            agents = [];
            for (let i = 0; i < gridSize; i++) {
                for (let j = 0; j < gridSize; j++) {
                    agents.push(new Agent(`agent-${i}-${j}`, i, j));
                }
            }
            
            self.postMessage({
                type: 'agents-created',
                agents: agents.map(agent => ({
                    id: agent.id,
                    row: agent.row,
                    column: agent.column,
                    internalState: agent.internalState,
                    bias: agent.bias,
                    transitions: agent.transitions,
                    rotation: agent.rotation,
                    targetRotation: agent.targetRotation,
                    targetState: agent.targetState,
                    dim: agent.dim,
                    isPaired: agent.isPaired
                }))
            });
            break;
            
        case 'update':
            // Update agent states
            updateAgents();
            
            // Update agent positions/rotations
            const increment = data.increment;
            for (const agent of agents) {
                agent.update(increment);
            }
            
            // Send updated agent data back
            self.postMessage({
                type: 'agents-updated',
                agents: agents.map(agent => ({
                    id: agent.id,
                    internalState: agent.internalState,
                    rotation: agent.rotation,
                    targetRotation: agent.targetRotation,
                    targetState: agent.targetState,
                    isPaired: agent.isPaired
                }))
            });
            break;
            
        case 'update-settings':
            // Update worker settings
            if (data.extroversion !== undefined) {
                extroversion = data.extroversion;
            }
            break;
    }
}; 