/**
 * GRAPH - Game State Tracking (Adjacency List)
 * 
 * Why: A graph models the relationship between board states.
 *      Each unique board = a node. Each move connecting two boards = an edge.
 *      This lets us detect cycles (repeated states) and visualize exploration.
 * 
 * Time Complexity:
 *   Add Node:  O(1)
 *   Add Edge:  O(1)
 *   Has Node:  O(1) with hash map
 * 
 * Space Complexity: O(V + E) where V = states, E = moves between them
 */
class Graph {
  constructor(maxNodes = 200) {
    // adjacencyList: stateHash -> { edges: [{ to, move }], label, visitCount }
    this.adjacencyList = new Map();
    this.maxNodes = maxNodes;
    this._edgeCount = 0;
    this.recentNodes = []; // for visualization (last N nodes)
    this.maxRecentViz = 8;
  }

  // Hash a board state into a compact string key
  hashState(board) {
    return board.flat().join(',');
  }

  addState(board, label = '') {
    const hash = this.hashState(board);
    if (!this.adjacencyList.has(hash)) {
      if (this.adjacencyList.size >= this.maxNodes) {
        // Remove oldest entry
        const oldest = this.adjacencyList.keys().next().value;
        this.adjacencyList.delete(oldest);
      }
      this.adjacencyList.set(hash, { edges: [], label, visitCount: 1, hash });
    } else {
      this.adjacencyList.get(hash).visitCount++;
    }
    return hash;
  }

  addEdge(fromBoard, toBoard, move) {
    const fromHash = this.addState(fromBoard);
    const toHash = this.addState(toBoard);

    const fromNode = this.adjacencyList.get(fromHash);
    // Avoid duplicate edges
    const exists = fromNode.edges.some(e => e.to === toHash && e.move === move);
    if (!exists) {
      fromNode.edges.push({ to: toHash, move });
      this._edgeCount++;
    }

    // Track for visualization
    if (!this.recentNodes.includes(fromHash)) {
      this.recentNodes.push(fromHash);
      if (this.recentNodes.length > this.maxRecentViz) {
        this.recentNodes.shift();
      }
    }

    return { fromHash, toHash };
  }

  hasState(board) {
    return this.adjacencyList.has(this.hashState(board));
  }

  getNode(hash) {
    return this.adjacencyList.get(hash) || null;
  }

  nodeCount() {
    return this.adjacencyList.size;
  }

  edgeCount() {
    return this._edgeCount;
  }

  clear() {
    this.adjacencyList.clear();
    this._edgeCount = 0;
    this.recentNodes = [];
  }

  // Get recent state chain for visualization
  getRecentChain() {
    return this.recentNodes.map((hash, i) => {
      const node = this.adjacencyList.get(hash);
      return {
        hash: hash.substring(0, 8) + '...',
        fullHash: hash,
        visits: node ? node.visitCount : 0,
        edges: node ? node.edges.length : 0,
        index: i
      };
    });
  }
}

window.Graph = Graph;