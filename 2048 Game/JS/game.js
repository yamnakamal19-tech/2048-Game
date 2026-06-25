/**
 * GAME2048 - Core game logic
 * Uses Stack (undo), Queue (move history), DoublyLinkedList (navigation), Graph (state tracking)
 */
class Game2048 {
  constructor(options = {}) {
    this.size = 4;
    this.board = this._emptyBoard();
    this.score = 0;
    this.bestScore = parseInt(localStorage.getItem('dsa2048_best') || '0');
    this.gameOver = false;
    this.won = false;
    this.winAcknowledged = false;
    this.moveCount = 0;
    this.mergeCount = 0;
    this.undoCount = 0;
    this.startTime = Date.now();

    // DSA instances
    this.undoStack = new Stack(50);
    this.moveQueue = new Queue(100);
    this.moveHistory = new DoublyLinkedList(30);
    this.stateGraph = new Graph(150);

    this.onStateChange = options.onStateChange || (() => {});
    this.onWin = options.onWin || (() => {});
    this.onGameOver = options.onGameOver || (() => {});
    this.onMerge = options.onMerge || (() => {});
    this.onDSAUpdate = options.onDSAUpdate || (() => {});

    this._addRandomTile();
    this._addRandomTile();
    this._notifyDSA();
  }

  _emptyBoard() {
    return Array.from({ length: 4 }, () => Array(4).fill(0));
  }

  _deepCopy(board) {
    return board.map(row => [...row]);
  }

  _addRandomTile() {
    const empty = [];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        if (this.board[r][c] === 0) empty.push([r, c]);
    if (empty.length === 0) return null;
    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    this.board[r][c] = Math.random() < 0.9 ? 2 : 4;
    return [r, c];
  }

  move(direction) {
    if (this.gameOver) return false;

    // Save state to undo stack before moving
    const prevState = {
      board: this._deepCopy(this.board),
      score: this.score,
      moveCount: this.moveCount
    };

    const prevBoard = this._deepCopy(this.board);
    let changed = false;
    let gained = 0;
    let merges = 0;

    const result = this._applyMove(direction);
    changed = result.changed;
    gained = result.score;
    merges = result.merges;

    if (!changed) return false;

    // Record previous board in graph before tile spawn
    const newTile = this._addRandomTile();

    // Update score
    this.score += gained;
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('dsa2048_best', this.bestScore);
    }

    // Update counters
    this.moveCount++;
    this.mergeCount += merges;

    // Push to undo stack (LIFO - last move undone first)
    this.undoStack.push(prevState);

    // Enqueue move (FIFO - for action replay)
    this.moveQueue.enqueue({
      direction,
      score: gained,
      merges,
      moveNumber: this.moveCount,
      timestamp: Date.now()
    });

    // Append to doubly linked list for navigation
    this.moveHistory.append({
      board: this._deepCopy(this.board),
      score: this.score,
      move: direction,
      moveNumber: this.moveCount
    });

    // Add edge to state graph
    this.stateGraph.addEdge(prevBoard, this.board, direction);

    if (merges > 0) this.onMerge(merges, gained);

    // Check win
    if (!this.won && !this.winAcknowledged && this.board.flat().includes(2048)) {
      this.won = true;
      this.onWin();
    }

    // Check game over
    if (!this._hasValidMoves()) {
      this.gameOver = true;
      this.onGameOver(this.score);
    }

    this._notifyDSA();
    this.onStateChange(this.board, this.score);
    return true;
  }

  undo() {
    if (this.undoStack.isEmpty()) return false;
    const prev = this.undoStack.pop();
    this.board = prev.board;
    this.score = prev.score;
    this.moveCount = prev.moveCount;
    this.undoCount++;
    this.gameOver = false;
    this._notifyDSA();
    this.onStateChange(this.board, this.score);
    return true;
  }

  _applyMove(direction) {
    let board = this._deepCopy(this.board);
    let totalScore = 0;
    let totalMerges = 0;
    let changed = false;

    // Normalize: always slide left, then rotate back
    const rotateBoard = (b, times) => {
      let res = b;
      for (let t = 0; t < ((times % 4) + 4) % 4; t++) {
        res = res[0].map((_, i) => res.map(row => row[i]).reverse());
      }
      return res;
    };

    const rotations = { left: 0, up: 1, right: 2, down: 3 };
    const rot = rotations[direction];

    board = rotateBoard(board, rot);
    for (let r = 0; r < 4; r++) {
      const { row, score, merges, rowChanged } = this._slideLeft(board[r]);
      board[r] = row;
      totalScore += score;
      totalMerges += merges;
      if (rowChanged) changed = true;
    }
    board = rotateBoard(board, (4 - rot) % 4);

    if (changed) this.board = board;
    return { changed, score: totalScore, merges: totalMerges };
  }

  _slideLeft(row) {
    let arr = row.filter(v => v !== 0);
    let score = 0, merges = 0;
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        score += arr[i];
        merges++;
        arr.splice(i + 1, 1);
      }
    }
    const newRow = [...arr, ...Array(4 - arr.length).fill(0)];
    const rowChanged = newRow.join(',') !== row.join(',');
    return { row: newRow, score, merges, rowChanged };
  }

  _hasValidMoves() {
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        if (this.board[r][c] === 0) return true;
        if (c < 3 && this.board[r][c] === this.board[r][c + 1]) return true;
        if (r < 3 && this.board[r][c] === this.board[r + 1][c]) return true;
      }
    return false;
  }

  getMaxTile() {
    return Math.max(...this.board.flat());
  }

  getElapsedTime() {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  getStats() {
    return {
      score: this.score,
      bestScore: this.bestScore,
      maxTile: this.getMaxTile(),
      moves: this.moveCount,
      merges: this.mergeCount,
      undos: this.undoCount,
      time: this.getElapsedTime(),
      undoStackSize: this.undoStack.size(),
      queueSize: this.moveQueue.size(),
      historySize: this.moveHistory.size(),
      graphNodes: this.stateGraph.nodeCount(),
      graphEdges: this.stateGraph.edgeCount()
    };
  }

  saveGame(slot = 'default') {
    const save = {
      board: this.board,
      score: this.score,
      moveCount: this.moveCount,
      mergeCount: this.mergeCount,
      timestamp: Date.now()
    };
    localStorage.setItem(`dsa2048_save_${slot}`, JSON.stringify(save));
    return save;
  }

  loadGame(slot = 'default') {
    const raw = localStorage.getItem(`dsa2048_save_${slot}`);
    if (!raw) return false;
    const save = JSON.parse(raw);
    this.board = save.board;
    this.score = save.score;
    this.moveCount = save.moveCount || 0;
    this.mergeCount = save.mergeCount || 0;
    this.gameOver = false;
    this._notifyDSA();
    this.onStateChange(this.board, this.score);
    return true;
  }

  _notifyDSA() {
    this.onDSAUpdate({
      stack: this.undoStack.toArray(),
      queue: this.moveQueue.toArray(),
      history: this.moveHistory.toArray(),
      graph: this.stateGraph.getRecentChain(),
      graphStats: {
        nodes: this.stateGraph.nodeCount(),
        edges: this.stateGraph.edgeCount()
      }
    });
  }

  reset() {
    this.board = this._emptyBoard();
    this.score = 0;
    this.gameOver = false;
    this.won = false;
    this.winAcknowledged = false;
    this.moveCount = 0;
    this.mergeCount = 0;
    this.undoCount = 0;
    this.startTime = Date.now();
    this.undoStack.clear();
    this.moveQueue.clear();
    this.moveHistory.clear();
    this.stateGraph.clear();
    this._addRandomTile();
    this._addRandomTile();
    this._notifyDSA();
    this.onStateChange(this.board, this.score);
  }
}

window.Game2048 = Game2048;