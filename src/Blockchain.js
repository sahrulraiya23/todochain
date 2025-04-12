// Blockchain.js (dengan mining)
import SHA256 from 'crypto-js/sha256';

export class Block {
  constructor(index, timestamp, data, previousHash = '', difficulty = 4) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.difficulty = difficulty;
    this.nonce = 0;
    this.hash = this.mineBlock(difficulty);
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

  // Metode untuk menambang blok
  mineBlock(difficulty) {
    // Buat pola hash yang harus diawali dengan 'difficulty' jumlah nol
    let target = Array(difficulty + 1).join("0");
    
    let calculatedHash = this.calculateHash();
    
    while (calculatedHash.substring(0, difficulty) !== target) {
      this.nonce++;
      calculatedHash = this.calculateHash();
    }
    
    console.log("Blok ditambang! Hash:", calculatedHash);
    return calculatedHash;
  }
}

export class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 2; // Default difficulty, angka lebih tinggi = lebih sulit
    this.miningReward = 100; // Reward untuk mining (jika diimplementasikan)
  }

  createGenesisBlock() {
    return new Block(0, new Date().toLocaleString(), "Genesis Block", "0");
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  // Metode untuk menambahkan blok dengan mining
  addBlock(data) {
    const previousBlock = this.getLatestBlock();
    const newBlock = new Block(
      this.chain.length,
      new Date().toLocaleString(),
      data,
      previousBlock.hash,
      this.difficulty
    );
    
    // Blok sudah ditambang di constructor Block
    this.chain.push(newBlock);
    return newBlock;
  }

  // Metode untuk menyesuaikan tingkat kesulitan secara dinamis
  adjustDifficulty(blockGenerationTimeInSeconds = 10) {
    const lastBlock = this.getLatestBlock();
    const previousBlock = this.chain[this.chain.length - 2];
    
    if (!previousBlock) return this.difficulty;
    
    const timeExpected = blockGenerationTimeInSeconds * 1000; // konversi ke milidetik
    const timeTaken = Date.parse(lastBlock.timestamp) - Date.parse(previousBlock.timestamp);
    
    if (timeTaken < timeExpected / 2) {
      return this.difficulty + 1;
    } else if (timeTaken > timeExpected * 2) {
      return Math.max(1, this.difficulty - 1);
    } else {
      return this.difficulty;
    }
  }

  isValidChain(chain) {
    if (!chain || chain.length === 0) {
      return false;
    }
    
    // Periksa blok genesis
    if (JSON.stringify(chain[0]) !== JSON.stringify(this.createGenesisBlock())) {
      // Kita bisa buat ini lebih fleksibel dengan hanya memeriksa indeks dan previousHash
      if (chain[0].index !== 0 || chain[0].previousHash !== "0") {
        return false;
      }
    }

    // Validasi setiap blok dalam rantai
    for (let i = 1; i < chain.length; i++) {
      const currentBlock = chain[i];
      const previousBlock = chain[i - 1];

      // Periksa hash blok saat ini valid
      if (currentBlock.hash !== new Block(
        currentBlock.index,
        currentBlock.timestamp,
        currentBlock.data,
        currentBlock.previousHash,
        currentBlock.difficulty
      ).calculateHash()) {
        return false;
      }

      // Periksa apakah previousHash menunjuk ke hash blok sebelumnya
      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }

    return true;
  }
}