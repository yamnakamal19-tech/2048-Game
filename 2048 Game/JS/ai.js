/**
 * AI PLAYER - Three difficulty levels using different DSA strategies
 */
class AIPlayer {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
    this.gameTree = new GameTree();
    this.moveDelay = difficulty === 'easy' ? 600 : difficulty === 'medium' ? 400 : 250;
    this.thinkingDepth = difficulty === 'hard' ? 3 : 2;
  }

  setDifficulty(diff) {
    this.difficulty = diff;
    this.moveDelay = diff === 'easy' ? 600 : diff === 'medium' ? 400 : 250;
    this.thinkingDepth = diff === 'hard' ? 3 : 2;
  }

  /**
   * Get best move for current board state
   * Easy:   Random valid move
   * Medium: Heuristic (prefer merges, empty cells, corner)
   * Hard:   Tree search (looks ahead N moves)
   */
  getBestMove(board) {
    const validMoves = this._getValidMoves(board);
    if (validMoves.length === 0) return null;

    switch (this.difficulty) {
      case 'easy':   return this._easyMove(validMoves);
      case 'medium': return this._mediumMove(board, validMoves);
      case 'hard':   return this._hardMove(board);
      default:       return this._mediumMove(board, validMoves);
    }
  }

  _easyMove(validMoves) {
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  _mediumMove(board, validMoves) {
    // Priority: moves that create merges > moves that free empty cells > random
    let bestMove = validMoves[0];
    let bestScore = -Infinity;

    for (const move of validMoves) {
      const result = this.gameTree._simulateMove(board, move);
      if (!result.changed) continue;

      let score = 0;
      const flat = result.board.flat();
      const empty = flat.filter(v => v === 0).length;
      const maxTile = Math.max(...flat);

      score += empty * 8;
      score += result.score; // tiles merged value

      // Prefer max tile in corner
      const b = result.board;
      if (b[0][0] === maxTile || b[0][3] === maxTile ||
          b[3][0] === maxTile || b[3][3] === maxTile) {
        score += maxTile;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    return bestMove;
  }

  _hardMove(board) {
    this.gameTree.build(board, this.thinkingDepth);
    return this.gameTree.getBestMove() || this._mediumMove(board, this._getValidMoves(board));
  }

  _getValidMoves(board) {
    return ['up', 'down', 'left', 'right'].filter(move => {
      const result = this.gameTree._simulateMove(board, move);
      return result.changed;
    });
  }

  getTreeVisualization() {
    return this.gameTree.getVisualizationData();
  }
}

window.AIPlayer = AIPlayer;