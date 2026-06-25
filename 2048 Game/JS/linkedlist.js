/**
 * DOUBLY LINKED LIST - Move History Navigation
 * 
 * Why: A doubly linked list allows traversal in both directions —
 *      perfect for navigating forward/backward through move history
 *      without the overhead of an array shift.
 * 
 * Time Complexity:
 *   Insert (front/back): O(1)
 *   Delete:              O(1) given node reference
 *   Traversal:           O(n)
 * 
 * Space Complexity: O(n)
 */
class DLLNode {
  constructor(data) {
    this.data = data;
    this.prev = null;
    this.next = null;
    this.id = Date.now() + Math.random();
  }
}

class DoublyLinkedList {
  constructor(maxSize = 30) {
    this.head = null;
    this.tail = null;
    this.current = null;
    this._size = 0;
    this.maxSize = maxSize;
  }

  append(data) {
    const node = new DLLNode(data);

    // If we're not at tail, truncate future history
    if (this.current && this.current !== this.tail) {
      let toRemove = this.current.next;
      this.current.next = null;
      this.tail = this.current;
      // update size
      while (toRemove) {
        this._size--;
        toRemove = toRemove.next;
      }
    }

    if (!this.head) {
      this.head = node;
      this.tail = node;
    } else {
      node.prev = this.tail;
      this.tail.next = node;
      this.tail = node;
    }
    this.current = node;
    this._size++;

    // Trim if over max
    if (this._size > this.maxSize) {
      this.head = this.head.next;
      if (this.head) this.head.prev = null;
      this._size--;
    }

    return node;
  }

  goBack() {
    if (this.current && this.current.prev) {
      this.current = this.current.prev;
      return this.current.data;
    }
    return null;
  }

  goForward() {
    if (this.current && this.current.next) {
      this.current = this.current.next;
      return this.current.data;
    }
    return null;
  }

  canGoBack() {
    return !!(this.current && this.current.prev);
  }

  canGoForward() {
    return !!(this.current && this.current.next);
  }

  getCurrentData() {
    return this.current ? this.current.data : null;
  }

  size() {
    return this._size;
  }

  clear() {
    this.head = null;
    this.tail = null;
    this.current = null;
    this._size = 0;
  }

  toArray() {
    const arr = [];
    let node = this.head;
    while (node) {
      arr.push({ data: node.data, isCurrent: node === this.current, id: node.id });
      node = node.next;
    }
    return arr;
  }
}

window.DoublyLinkedList = DoublyLinkedList;