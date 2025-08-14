import EmotionModel, { NoEmotion } from './EmotionModel';
import ExpressionModel from './ExpressionModel';

class ActivationFunctions {
    // 1. Tanh - Classic, symmetric, bounded
    static tanh(x) {
        return Math.tanh(x);
    }
    
    static tanhDerivative(x) {
        const t = Math.tanh(x);
        return 1 - t * t;
    }
    
    // 2. ELU - Smooth, handles negatives well
    static elu(x, alpha = 1.0) {
        return x >= 0 ? x : alpha * (Math.exp(x) - 1);
    }
    
    static eluDerivative(x, alpha = 1.0) {
        return x >= 0 ? 1 : alpha * Math.exp(x);
    }
    
    // 3. Swish - Modern, smooth, self-gated
    static swish(x) {
        return x / (1 + Math.exp(-x));
    }
    
    static swishDerivative(x) {
        const sigmoid = 1 / (1 + Math.exp(-x));
        return sigmoid + x * sigmoid * (1 - sigmoid);
    }
    
    // 4. GELU - Used in modern transformers
    static gelu(x) {
        return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)));
    }
    
    static geluDerivative(x) {
        const sqrt2OverPi = Math.sqrt(2 / Math.PI);
        const term = x + 0.044715 * x * x * x;
        const tanhTerm = Math.tanh(sqrt2OverPi * term);
        const sechSquared = 1 - tanhTerm * tanhTerm;
        
        return 0.5 * (1 + tanhTerm) + 
               0.5 * x * sechSquared * sqrt2OverPi * (1 + 3 * 0.044715 * x * x);
    }
    
    // 5. Leaky ReLU - Simple, addresses dying neurons
    static leakyRelu(x, alpha = 0.01) {
        return x > 0 ? x : alpha * x;
    }
    
    static leakyReluDerivative(x, alpha = 0.01) {
        return x > 0 ? 1 : alpha;
    }
}

const activations = {
    'tanh': [ActivationFunctions.tanh, ActivationFunctions.tanhDerivative],
    'elu': [ActivationFunctions.elu, ActivationFunctions.eluDerivative],
    'swish': [ActivationFunctions.swish, ActivationFunctions.swishDerivative],
    'gelu': [ActivationFunctions.gelu, ActivationFunctions.geluDerivative],
    'leakyRelu': [ActivationFunctions.leakyRelu, ActivationFunctions.leakyReluDerivative]
};

class Agent {
    id: string;
    row: number;
    column: number;
    internalState: number[];
    idealState: number[];
    transitions: number[][];
    rotation: number[];
    targetRotation: number[];
    targetState: number[];
    dim: number;
    isPaired: boolean;
    expressionModel: ExpressionModel;
    bias: number[];
    
    constructor(id: string, row: number, column: number) {
        this.id = id;
        this.row = row;
        this.column = column;
        this.internalState = Object.values(NoEmotion).map(() => Math.random()*.5 - .25);
        this.bias = Object.values(NoEmotion).map(() => Math.random()*.2 - .1);
        this.dim = this.internalState.length;
        //this.transitions = new Array(this.dim).fill(0).map(() => new Array(this.dim).fill(0).map(() => Math.random()*2 - 1));
        this.transitions = new Array(this.dim).fill(0).map((d, i) => new Array(this.dim).fill(0).map((d2, j) => /*i == j ? 1 :*/ Math.random()*1 - .5));
        this.rotation = [0, 0, 0];
        this.targetRotation = [0, 0, 0];
        this.targetState = [...this.internalState];
        this.isPaired = false;
        this.expressionModel = new ExpressionModel(new EmotionModel());
    }

    interact(state: number[], learningRate: number, idealVector: number[]) {
        this.isPaired = true;
        
        const [activation, derivative] = activations['swish'];

        const transmul = [];
        for (let i = 0; i < this.dim; i++) {
            let v = this.bias[i]; // Start with bias term
            for (let j = 0; j < this.dim; j++) {
                v += this.transitions[i][j] * state[j];
            }
            transmul.push(v);
        }
        
        const delta = transmul.map(v => activation(v));
        
        // Update target state
        const pretanh = [...this.internalState];
        for (let i = 0; i < this.dim; i++) {
            pretanh[i] += delta[i];
        }

        this.targetState = pretanh.map(v => Math.tanh(v));
        
        // Compute loss (Mean Squared Error)
        const errors = [];
        let totalLoss = 0;
        for (let i = 0; i < this.dim; i++) {
            const error = idealVector[i] - this.targetState[i];
            errors.push(error);
            totalLoss += error * error;
        }
        totalLoss /= this.dim; // Average the loss
        
        // Gradient descent update to transition matrix
        for (let i = 0; i < this.dim; i++) {
            const dLoss_dTarget = -2 * errors[i] / this.dim;
            const dTarget_dRaw = 1 - Math.tanh(pretanh[i]) ** 2;
            const dRaw_dDelta = 1;
            const dDelta_dMult = derivative(transmul[i]);
            for (let j = 0; j < this.dim; j++) {
                // Compute gradient: ∂Loss/∂T[i][j]
                const dMult_dTransition = state[j];
                
                const gradient = dLoss_dTarget * dTarget_dRaw * dRaw_dDelta * dDelta_dMult * dMult_dTransition;
                this.transitions[i][j] -= learningRate * gradient;
            }
            
            // Update bias vector
            // Gradient: ∂Loss/∂bias[i]
            const dMult_dBias = 1; // transmul[i] includes bias[i] directly
            
            const biasGradient = dLoss_dTarget * dTarget_dRaw * dRaw_dDelta * dDelta_dMult * dMult_dBias;
            this.bias[i] -= learningRate * biasGradient;
        }
        
        return {
            loss: totalLoss,
            errors: errors,
            delta: delta,
            bias: [...this.bias] // Return copy of current bias for monitoring
        };
    }

    rotate(rotation: number[]) {
        this.targetRotation = [...rotation];
    }

    update(increment: number) {
        let doneRotating = true;
        for (let i = 0; i < this.rotation.length; i++) {
            this.rotation[i] += (this.targetRotation[i] - this.rotation[i]) * increment * 4;
        } 
        for (let i = 0; i < this.dim; i++) {
            this.internalState[i] += (this.targetState[i] - this.internalState[i]) * increment;
        }
    }

    getExpression(levelScale: number) {
        const expression = this.expressionModel.getExpression(this.internalState.map((value) => value * levelScale));
        for (var i = 1; i < expression.children.length; i++) {
            const pupil = expression.children[i];
            pupil.position.set(pupil.position.x + this.rotation[1] * .2, pupil.position.y + this.rotation[0] * .3, pupil.position.z - Math.abs(this.rotation[1] * .1));
        }
        expression.rotation.set(...this.rotation);
        expression.position.set(this.column*5, this.row*5, 0);
        return expression;
    }

    faceDirection(x: number, y: number) {
        const newRotation = [0, 0, 0];
        if (x == 1) {
            newRotation[1] = Math.PI/5;
        } else if (x == -1) {
            newRotation[1] = -Math.PI/5;
        } 
        if (y == -1) {
            newRotation[0] = Math.PI/8;
        } else if (y == 1) {
            newRotation[0] = -Math.PI/8;
        }
        this.targetRotation = newRotation;
    }

}

export default Agent;