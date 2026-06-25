/**
 * STACK - Undo Functionality
 * 
 * Why: A stack (LIFO) is perfect for undo because the most recent
 *      action should be undone first — exactly what last-in-first-out gives us.
 * 
 * Time Complexity:
 *   Push:  O(1)
 *   Pop:   O(1)
 *   Peek:  O(1)
 * 
 * Space Complexity: O(n) where n = number of saved states
 */
class Stack {
  constructor(maxSize = 50) {
    this.items = [];
    this.maxSize = maxSize;
  }

  push(item) {
    if (this.items.length >= this.maxSize) {
      this.items.shift(); // remove oldest if full
    }
    this.items.push(item);
    return this;
  }

  pop() {
    if (this.isEmpty()) return null;
    return this.items.pop();
  }

  peek() {
    if (this.isEmpty()) return null;
    return this.items[this.items.length - 1];
  }

  isEmpty() {
    return this.items.length === 0;
  }

  size() {
    return this.items.length;
  }

  clear() {
    this.items = [];
  }

  toArray() {
    return [...this.items];
  }
}

window.Stack = Stack;