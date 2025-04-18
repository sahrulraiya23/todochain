import SHA256 from 'crypto-js/sha256';

// Block class to represent each task in the chain
class Block {
  constructor(index, timestamp, data, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data; // This will now be an object with task details
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
    this.nonce = 0;
  }

  calculateHash() {
    return SHA256(
      this.index + 
      this.timestamp + 
      JSON.stringify(this.data) + 
      this.previousHash + 
      this.nonce
    ).toString();
  }

  // Mining method for proof of work
  mineBlock(difficulty) {
    const target = Array(difficulty + 1).join("0");
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    console.log("Block mined: " + this.hash);
  }
}

// Blockchain class to manage the chain of tasks
export class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 2;
    this.miningReward = 100;
  }

  // Create the first block in the chain
  createGenesisBlock() {
    return new Block(0, new Date().toLocaleString(), { 
      title: "Genesis Block", 
      assignedBy: "System", 
      assignedTo: "System", 
      isCompleted: true,
      completedAt: new Date().toLocaleString()
    }, "0");
  }

  // Get the latest block in the chain
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  // Add a new task to the blockchain
  addBlock(taskData) {
    // Ensure taskData has the required structure
    if (!taskData.title) {
      throw new Error("Task must have a title");
    }
    
    const newBlock = new Block(
      this.chain.length,
      new Date().toLocaleString(),
      {
        title: taskData.title,
        description: taskData.description || "",
        assignedBy: taskData.assignedBy || "Unknown",
        assignedTo: taskData.assignedTo || "Unknown",
        isCompleted: taskData.isCompleted || false,
        completedAt: taskData.isCompleted ? new Date().toLocaleString() : null
      },
      this.getLatestBlock().hash
    );
    
    newBlock.mineBlock(this.difficulty);
    this.chain.push(newBlock);
    
    return newBlock;
  }

  // Mark a task as completed
  completeTask(blockIndex, completedBy) {
    // Find the block to update
    const taskBlock = this.chain[blockIndex];
    
    // Update the task status
    taskBlock.data.isCompleted = true;
    taskBlock.data.completedAt = new Date().toLocaleString();
    
    // Recalculate the hash for this block
    taskBlock.hash = taskBlock.calculateHash();
    
    // Since we changed this block's hash, we need to update all subsequent blocks
    // to maintain chain integrity
    for (let i = blockIndex + 1; i < this.chain.length; i++) {
      this.chain[i].previousHash = this.chain[i - 1].hash;
      this.chain[i].hash = this.chain[i].calculateHash();
    }
    
    return taskBlock;
  }
  // Verify the integrity of the blockchain
  isValidChain(chainToValidate) {
    if (!chainToValidate || chainToValidate.length === 0) {
      return false;
    }
    
    // PERBAIKAN: Jangan melakukan perbandingan langsung dengan blok genesis baru
    // Cukup periksa apakah ini blok dengan index 0
    const genesisBlock = chainToValidate[0];
    if (genesisBlock.index !== 0 || genesisBlock.previousHash !== "0") {
      return false;
    }
    
    // Check the integrity of each subsequent block
    for (let i = 1; i < chainToValidate.length; i++) {
      const currentBlock = chainToValidate[i];
      const previousBlock = chainToValidate[i - 1];
      
      // Verifikasi bahwa hash sudah benar
      const recalculatedHash = SHA256(
        currentBlock.index + 
        currentBlock.timestamp + 
        JSON.stringify(currentBlock.data) + 
        currentBlock.previousHash + 
        currentBlock.nonce
      ).toString();
      
      if (currentBlock.hash !== recalculatedHash) {
        console.log('Hash tidak valid pada blok', i);
        return false;
      }
      
      // Verifikasi referensi hash sebelumnya
      if (currentBlock.previousHash !== previousBlock.hash) {
        console.log('Previous hash tidak valid pada blok', i);
        return false;
      }
    }
    
    return true;
  }

  // Adjust mining difficulty based on chain length
  adjustDifficulty() {
    const blockCount = this.chain.length;
    if (blockCount <= 10) {
      return 2; // Keep difficulty low for the first 10 blocks
    } else if (blockCount <= 20) {
      return 3; // Increase difficulty
    } else {
      return 4; // Higher difficulty for longer chains
    }
  }
}