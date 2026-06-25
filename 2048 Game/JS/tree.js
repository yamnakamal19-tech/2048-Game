/**
 * TREE - AI Move Evaluation (N-ary Game Tree)
 * 
 * Why: A game tree models future board states from each possible move.
 *      The root is the current state, children are states after each move.
 *      The AI evaluates leaf nodes and picks the best path (minimax-style).
 * 
 * Time Complexity:
 *   Build tree (depth d, branching b): O(b^d)
 *   Evaluation: O(b^d)
 * 
 * Space Complexity: O(b^d)
 */
class TreeNode {
  constructor(board, move = null, score = 0, depth = 0) {
    this.board = board;
    this.move = move;         // which move led here
    this.score = score;       // board evaluation score
    this.depth = depth;
    this.children = [];
    this.id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.isSelected = false;
  }

  addChild(childNode) {
    this.children.push(childNode);
    return childNode;
  }
}

class GameTree {
  constructor() {
    this.root = null;
    this.bestPath = [];
    this.totalNodes = 0;
  }

  build(board, depth = 2) {
    this.totalNodes = 0;
    this.root = new TreeNode(board, null, 0, 0);
    this._buildRecursive(this.root, depth);
    return this.root;
  }

  _buildRecursive(node, remainingDepth) {
    if (remainingDepth === 0) return;

    const moves = ['up', 'down', 'left', 'right'];
    for (const move of moves) {
      const result = this._simulateMove(node.board, move);
      if (result.changed) {
        const childScore = this._evaluateBoard(result.board);
        const child = new TreeNode(result.board, move, childScore, node.depth + 1);
        node.addChild(child);
        this.totalNodes++;
        this._buildRecursive(child, remainingDepth - 1);
      }
    }
  }

  // Evaluate board quality for AI
  _evaluateBoard(board) {
    let score = 0;
    const size = board.length;

    // 1. Empty cells (more = better)
    let empty = 0;
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (board[r][c] === 0) empty++;
    score += empty * 10;

    // 2. Max tile in corner bonus
    const maxTile = Math.max(...board.flat());
    if (board[0][0] === maxTile || board[0][3] === maxTile ||
        board[3][0] === maxTile || board[3][3] === maxTile) {
      score += maxTile * 2;
    }

    // 3. Monotonicity (tiles decrease in one direction)
    score += this._monotonicity(board) * 5;

    // 4. Smoothness (adjacent tiles similar value)
    score -= this._roughness(board) * 2;

    // 5. Merge potential
    score += this._mergeCount(board) * 15;

    return score;
  }

  _monotonicity(board) {
    let score = 0;
    for (let r = 0; r < 4; r++) {
      let inc = 0, dec = 0;
      for (let c = 0; c < 3; c++) {
        if (board[r][c] >= board[r][c + 1]) dec++;
        if (board[r][c] <= board[r][c + 1]) inc++;
      }
      score += Math.max(inc, dec);
    }
    return score;
  }

  _roughness(board) {
    let rough = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (board[r][c] && c < 3 && board[r][c + 1])
          rough += Math.abs(Math.log2(board[r][c]) - Math.log2(board[r][c + 1]));
        if (board[r][c] && r < 3 && board[r + 1][c])
          rough += Math.abs(Math.log2(board[r][c]) - Math.log2(board[r + 1][c]));
      }
    }
    return rough;
  }

  _mergeCount(board) {
    let count = 0;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        if (board[r][c] && board[r][c] === board[r][c + 1]) count++;
        if (board[c][r] && board[c][r] === board[c + 1] && board[c + 1]) count++;
      }
    }
    return count;
  }

  // Returns the best move from root based on child scores
  getBestMove() {
    if (!this.root || this.root.children.length === 0) return null;

    let best = null;
    let bestScore = -Infinity;

    for (const child of this.root.children) {
      const subtreeScore = this._maxScore(child);
      if (subtreeScore > bestScore) {
        bestScore = subtreeScore;
        best = child.move;
        this.bestPath = [child];
      }
    }

    // Mark selected path
    this.root.children.forEach(c => c.isSelected = c.move === best);
    return best;
  }

  _maxScore(node) {
    if (node.children.length === 0) return node.score;
    return Math.max(node.score, ...node.children.map(c => this._maxScore(c)));
  }

  // For visualization: flattened tree nodes by depth
  getVisualizationData() {
    const levels = [];
    this._collectLevels(this.root, 0, levels);
    return {
      levels,
      totalNodes: this.totalNodes,
      bestPath: this.bestPath.map(n => n.id)
    };
  }

  _collectLevels(node, depth, levels) {
    if (!node) return;
    if (!levels[depth]) levels[depth] = [];
    levels[depth].push({
      id: node.id,
      move: node.move,
      score: node.score,
      isSelected: node.isSelected,
      childCount: node.children.length
    });
    for (const child of node.children) {
      this._collectLevels(child, depth + 1, levels);
    }
  }

  // Simulate a move on a board copy (returns {board, changed, score})
  _simulateMove(board, direction) {
    const copy = board.map(row => [...row]);
    let changed = false;
    let gained = 0;

    const rotate90 = (b) => b[0].map((_, i) => b.map(row => row[i]).reverse());
    const slideLeft = (b) => {
      let ch = false;
      for (let r = 0; r < 4; r++) {
        let row = b[r].filter(v => v !== 0);
        for (let i = 0; i < row.length - 1; i++) {
          if (row[i] === row[i + 1]) {
            row[i] *= 2; gained += row[i];
            row.splice(i + 1, 1);
            ch = true;
          }
        }
        const newRow = [...row, ...Array(4 - row.length).fill(0)];
        if (newRow.join() !== b[r].join()) ch = true;
        b[r] = newRow;
      }
      return { board: b, changed: ch };
    };

    let b = copy.map(r => [...r]);
    let rotations = 0;
    if (direction === 'right') { b = rotate90(rotate90(b)); rotations = 2; }
    else if (direction === 'up') { b = b[0].map((_, i) => b.map(r => r[i])); rotations = -1; }
    else if (direction === 'down') { b = b[0].map((_, i) => b.map(r => r[i]).reverse()).reverse(); rotations = -2; }

    const res = slideLeft(b.map(r => [...r]));
    changed = res.changed;
    let result = res.board;

    if (direction === 'right') result = rotate90(rotate90(result));
    else if (direction === 'up') result = result[0].map((_, i) => result.map(r => r[i]));
    else if (direction === 'down') {
      result = result.reverse();
      result = result[0].map((_, i) => result.map(r => r[i]));
    }

    return { board: result, changed, score: gained };
  }
}

window.TreeNode = TreeNode;
window.GameTree = GameTree;