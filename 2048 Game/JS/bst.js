/**
 * BINARY SEARCH TREE - Leaderboard Score Management
 * 
 * Why: A BST automatically maintains sorted order during insertion.
 *      In-order traversal gives us scores ranked from lowest to highest
 *      in O(n), and insertion/search are O(log n) on average.
 * 
 * Time Complexity:
 *   Insert:   O(log n) avg, O(n) worst
 *   Search:   O(log n) avg, O(n) worst
 *   Traversal: O(n)
 * 
 * Space Complexity: O(n)
 */
class BSTNode {
  constructor(score, playerData) {
    this.score = score;
    this.playerData = playerData; // { name, mode, tile, date }
    this.left = null;
    this.right = null;
    this.id = Date.now() + Math.random();
  }
}

class BST {
  constructor() {
    this.root = null;
    this._size = 0;
  }

  insert(score, playerData) {
    const node = new BSTNode(score, playerData);
    if (!this.root) {
      this.root = node;
    } else {
      this._insertNode(this.root, node);
    }
    this._size++;
    return node;
  }

  _insertNode(node, newNode) {
    if (newNode.score <= node.score) {
      if (!node.left) node.left = newNode;
      else this._insertNode(node.left, newNode);
    } else {
      if (!node.right) node.right = newNode;
      else this._insertNode(node.right, newNode);
    }
  }

  // Returns sorted array (ascending)
  inOrder() {
    const result = [];
    this._inOrder(this.root, result);
    return result;
  }

  _inOrder(node, result) {
    if (!node) return;
    this._inOrder(node.left, result);
    result.push({ score: node.score, ...node.playerData, id: node.id });
    this._inOrder(node.right, result);
  }

  // Returns top N scores (descending)
  getTopN(n = 10) {
    return this.inOrder().reverse().slice(0, n);
  }

  search(score) {
    return this._search(this.root, score);
  }

  _search(node, score) {
    if (!node) return null;
    if (score === node.score) return node;
    if (score < node.score) return this._search(node.left, score);
    return this._search(node.right, score);
  }

  size() {
    return this._size;
  }

  clear() {
    this.root = null;
    this._size = 0;
  }

  // For visualization: get tree as nested structure
  getTreeStructure() {
    return this._getStructure(this.root, 0);
  }

  _getStructure(node, depth) {
    if (!node) return null;
    return {
      score: node.score,
      name: node.playerData.name,
      depth,
      id: node.id,
      left: this._getStructure(node.left, depth + 1),
      right: this._getStructure(node.right, depth + 1)
    };
  }
}

window.BST = BST;