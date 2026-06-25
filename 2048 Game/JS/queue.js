/**
 * QUEUE - Move Processing & Action History
 * 
 * Why: A queue (FIFO) ensures moves are processed in the exact order
 *      they were made. This is critical in two-player mode for fair
 *      turn management and in replaying action history.
 * 
 * Time Complexity:
 *   Enqueue: O(1)
 *   Dequeue: O(1) amortized (with index optimization)
 *   Peek:    O(1)
 * 
 * Space Complexity: O(n)
 */
class Queue {
  constructor(maxSize = 100) {
    this.items = [];
    this.head = 0;
    this.maxSize = maxSize;
  }

  enqueue(item) {
    if (this.size() >= this.maxSize) {
      this.dequeue(); // drop oldest
    }
    this.items.push(item);
    return this;
  }

  dequeue() {
    if (this.isEmpty()) return null;
    const item = this.items[this.head];
    this.head++;
    // Compact array periodically to avoid memory leak
    if (this.head > 20) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return item;
  }

  peek() {
    if (this.isEmpty()) return null;
    return this.items[this.head];
  }

  isEmpty() {
    return this.head >= this.items.length;
  }

  size() {
    return this.items.length - this.head;
  }

  clear() {
    this.items = [];
    this.head = 0;
  }

  toArray() {
    return this.items.slice(this.head);
  }
}

window.Queue = Queue;