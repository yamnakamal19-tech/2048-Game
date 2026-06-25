#include <iostream>
#include <vector>
#include <array>
#include <stack>
#include <queue>
#include <map>
#include <unordered_map>
#include <algorithm>
#include <string>
#include <sstream>
#include <cstdlib>
#include <ctime>
#include <cassert>
#include <climits>

using namespace std;

using Board = array<array<int, 4>, 4>;

string boardHash(const Board &b)
{
    string h;
    for (auto &row : b)
        for (int v : row)
            h += to_string(v) + ",";
    return h;
}

void printBoard(const Board &b)
{
    cout << "┌────────────────────┐\n";
    for (auto &row : b)
    {
        cout << "│";
        for (int v : row)
            cout << (v ? to_string(v) : ".") << "\t";
        cout << "│\n";
    }
    cout << "└────────────────────┘\n";
}

/* STACK — Undo Functionality (LIFO) */

template <typename T>
class UndoStack
{
    static const int MAX_SIZE = 50;
    vector<T> items;

public:
    void push(const T &item)
    {
        if ((int)items.size() >= MAX_SIZE)
            items.erase(items.begin()); 
        items.push_back(item);
    }
    T pop()
    {
        if (items.empty())
            throw runtime_error("Stack underflow");
        T top = items.back();
        items.pop_back();
        return top;
    }
    const T &peek() const { return items.back(); }
    bool empty() const { return items.empty(); }
    size_t size() const { return items.size(); }

    void printState() const
    {
        cout << "[UndoStack] size=" << size() << "\n";
        for (int i = (int)items.size() - 1; i >= 0; --i)
            cout << "  [" << (i == (int)items.size() - 1 ? "TOP" : "   ") << "] "
                 << "score=" << items[i].score << "\n";
    }
};

/* ─────────────────────────────────────────────────────────────────────
 * QUEUE — Move Processing (FIFO)
 *
 * Why:  Moves must be replayed in the order they were made — FIFO.
 * Ops:  enqueue O(1), dequeue O(1) amortized
 * ─────────────────────────────────────────────────────────────────── */
struct MoveRecord
{
    string direction;
    int scoreGained;
    int moveNumber;
};

class MoveQueue
{
    deque<MoveRecord> items;
    static const int MAX_SIZE = 100;

public:
    void enqueue(const MoveRecord &m)
    {
        if ((int)items.size() >= MAX_SIZE)
            items.pop_front();
        items.push_back(m);
    }
    MoveRecord dequeue()
    {
        if (items.empty())
            throw runtime_error("Queue underflow");
        MoveRecord front = items.front();
        items.pop_front();
        return front;
    }
    const MoveRecord &front() const { return items.front(); }
    bool empty() const { return items.empty(); }
    size_t size() const { return items.size(); }

    void printState() const
    {
        cout << "[MoveQueue] size=" << size() << " — FRONT→REAR: ";
        for (auto &m : items)
            cout << "[" << m.direction << ":+" << m.scoreGained << "] → ";
        cout << "\n";
    }
};

/* ─────────────────────────────────────────────────────────────────────
 * DOUBLY LINKED LIST — Move History Navigation
 *
 * Why:  Allows traversal both forward and backward through history.
 * Ops:  append O(1), traverse O(n)
 * ─────────────────────────────────────────────────────────────────── */
struct HistoryEntry
{
    Board board;
    int score;
    string move;
    int moveNumber;
};

struct DLLNode
{
    HistoryEntry data;
    DLLNode *prev;
    DLLNode *next;
    explicit DLLNode(const HistoryEntry &d) : data(d), prev(nullptr), next(nullptr) {}
};

class DoublyLinkedList
{
    DLLNode *head = nullptr;
    DLLNode *tail = nullptr;
    DLLNode *current = nullptr;
    int _size = 0;
    static const int MAX_SIZE = 30;

    void trimFront()
    {
        if (!head)
            return;
        DLLNode *old = head;
        head = head->next;
        if (head)
            head->prev = nullptr;
        delete old;
        --_size;
    }

public:
    ~DoublyLinkedList()
    {
        while (head)
            trimFront();
    }

    void append(const HistoryEntry &entry)
    {
        // Truncate future history if current is not at tail
        if (current && current != tail)
        {
            DLLNode *node = current->next;
            current->next = nullptr;
            tail = current;
            while (node)
            {
                DLLNode *nx = node->next;
                delete node;
                node = nx;
                --_size;
            }
        }
        DLLNode *node = new DLLNode(entry);
        if (!head)
        {
            head = tail = node;
        }
        else
        {
            node->prev = tail;
            tail->next = node;
            tail = node;
        }
        current = node;
        ++_size;
        if (_size > MAX_SIZE)
            trimFront();
    }

    const HistoryEntry *goBack()
    {
        if (current && current->prev)
        {
            current = current->prev;
            return &current->data;
        }
        return nullptr;
    }
    const HistoryEntry *goForward()
    {
        if (current && current->next)
        {
            current = current->next;
            return &current->data;
        }
        return nullptr;
    }
    bool canGoBack() const { return current && current->prev; }
    bool canGoForward() const { return current && current->next; }
    int size() const { return _size; }

    void printChain() const
    {
        cout << "[DLL] size=" << _size << " : ";
        DLLNode *n = head;
        while (n)
        {
            cout << (n == current ? "►" : " ") << n->data.move << " ";
            if (n->next)
                cout << "⇌ ";
            n = n->next;
        }
        cout << "\n";
    }
};

/* ─────────────────────────────────────────────────────────────────────
 * BINARY SEARCH TREE — Sorted Leaderboard
 *
 * Why:  BST keeps scores sorted on insert; in-order traversal gives
 *       rankings without an explicit sort step.
 * Ops:  insert O(log n) avg, inorder O(n)
 * ─────────────────────────────────────────────────────────────────── */
struct ScoreEntry
{
    string name;
    string mode;
    int maxTile;
};

struct BSTNode
{
    int score;
    ScoreEntry data;
    BSTNode *left = nullptr;
    BSTNode *right = nullptr;
    BSTNode(int s, const ScoreEntry &d) : score(s), data(d) {}
};

class LeaderboardBST
{
    BSTNode *root = nullptr;
    int _size = 0;

    BSTNode *insert(BSTNode *node, int score, const ScoreEntry &data)
    {
        if (!node)
            return new BSTNode(score, data);
        if (score <= node->score)
            node->left = insert(node->left, score, data);
        else
            node->right = insert(node->right, score, data);
        return node;
    }

    void inOrder(BSTNode *node, vector<pair<int, ScoreEntry>> &out) const
    {
        if (!node)
            return;
        inOrder(node->left, out);
        out.emplace_back(node->score, node->data);
        inOrder(node->right, out);
    }

    void deleteTree(BSTNode *node)
    {
        if (!node)
            return;
        deleteTree(node->left);
        deleteTree(node->right);
        delete node;
    }

public:
    ~LeaderboardBST() { deleteTree(root); }

    void insert(int score, const ScoreEntry &data)
    {
        root = insert(root, score, data);
        ++_size;
    }

    vector<pair<int, ScoreEntry>> getTopN(int n = 10) const
    {
        vector<pair<int, ScoreEntry>> all;
        inOrder(root, all);
        reverse(all.begin(), all.end()); // descending
        if ((int)all.size() > n)
            all.resize(n);
        return all;
    }

    int size() const { return _size; }

    void printLeaderboard() const
    {
        auto top = getTopN();
        cout << "[BST Leaderboard] — In-order (desc) traversal:\n";
        for (int i = 0; i < (int)top.size(); ++i)
            cout << "  #" << i + 1 << " " << top[i].second.name
                 << " — " << top[i].first
                 << " [" << top[i].second.mode << "]\n";
    }
};

/* ─────────────────────────────────────────────────────────────────────
 * GRAPH — Game State Tracking (Adjacency List)
 *
 * Why:  Each board state = node; each move = directed edge.
 *       Lets us detect revisited states and visualize exploration.
 * Ops:  addNode O(1), addEdge O(1)
 * ─────────────────────────────────────────────────────────────────── */
struct EdgeInfo
{
    string toHash;
    string move;
};

class StateGraph
{
    unordered_map<string, vector<EdgeInfo>> adjList;
    unordered_map<string, int> visitCount;
    static const int MAX_NODES = 200;

public:
    string addState(const Board &b)
    {
        string h = boardHash(b);
        adjList.emplace(h, vector<EdgeInfo>{});
        visitCount[h]++;
        if ((int)adjList.size() > MAX_NODES)
        {
            auto it = adjList.begin();
            visitCount.erase(it->first);
            adjList.erase(it);
        }
        return h;
    }

    void addEdge(const Board &from, const Board &to, const string &move)
    {
        string fh = addState(from);
        string th = addState(to);
        adjList[fh].push_back({th, move});
    }

    int nodeCount() const { return (int)adjList.size(); }
    int edgeCount() const
    {
        int e = 0;
        for (auto &kv : adjList)
            e += (int)kv.second.size();
        return e;
    }

    void printStats() const
    {
        cout << "[Graph] Nodes=" << nodeCount() << " Edges=" << edgeCount() << "\n";
    }
};

/* ─────────────────────────────────────────────────────────────────────
 * GAME ENGINE (simplified)
 * ─────────────────────────────────────────────────────────────────── */
struct GameState
{
    Board board;
    int score;
    int moveCount;
};

class Game2048
{
public:
    Board board{};
    int score = 0;
    int moveCount = 0;
    bool gameOver = false;

    UndoStack<GameState> undoStack;
    MoveQueue moveQueue;
    DoublyLinkedList history;
    LeaderboardBST leaderboard;
    StateGraph stateGraph;

    Game2048()
    {
        srand((unsigned)time(nullptr));
        addRandomTile();
        addRandomTile();
    }

    bool move(const string &dir)
    {
        if (gameOver)
            return false;
        Board prev = board;
        GameState prevState{board, score, moveCount};

        bool changed = applyMove(dir);
        if (!changed)
            return false;

        addRandomTile();
        moveCount++;

        undoStack.push(prevState);
        moveQueue.enqueue({dir, 0, moveCount});
        history.append({board, score, dir, moveCount});
        stateGraph.addEdge(prev, board, dir);

        if (!hasValidMoves())
            gameOver = true;
        return true;
    }

    bool undo()
    {
        if (undoStack.empty())
            return false;
        GameState s = undoStack.pop();
        board = s.board;
        score = s.score;
        moveCount = s.moveCount;
        gameOver = false;
        return true;
    }

    void printAll()
    {
        printBoard(board);
        cout << "Score: " << score << " | Moves: " << moveCount << "\n";
        undoStack.printState();
        moveQueue.printState();
        history.printChain();
        stateGraph.printStats();
    }

private:
    void addRandomTile()
    {
        vector<pair<int, int>> empty;
        for (int r = 0; r < 4; r++)
            for (int c = 0; c < 4; c++)
                if (!board[r][c])
                    empty.push_back({r, c});
        if (empty.empty())
            return;
        auto [r, c] = empty[rand() % empty.size()];
        board[r][c] = (rand() % 10 < 9) ? 2 : 4;
    }

    bool hasValidMoves() const
    {
        for (int r = 0; r < 4; r++)
            for (int c = 0; c < 4; c++)
            {
                if (!board[r][c])
                    return true;
                if (c < 3 && board[r][c] == board[r][c + 1])
                    return true;
                if (r < 3 && board[r][c] == board[r + 1][c])
                    return true;
            }
        return false;
    }

    // Rotate board 90° clockwise
    Board rotate90(const Board &b) const
    {
        Board r{};
        for (int i = 0; i < 4; i++)
            for (int j = 0; j < 4; j++)
                r[j][3 - i] = b[i][j];
        return r;
    }

    Board rotateN(const Board &b, int n) const
    {
        Board r = b;
        for (int i = 0; i < ((n % 4 + 4) % 4); i++)
            r = rotate90(r);
        return r;
    }

    // Slide row left, return score gained
    int slideLeft(array<int, 4> &row)
    {
        int gained = 0;
        array<int, 4> orig = row;
        array<int, 4> tmp{};
        int idx = 0;
        for (int v : row)
            if (v)
                tmp[idx++] = v;
        for (int i = 0; i < 3; i++)
        {
            if (tmp[i] && tmp[i] == tmp[i + 1])
            {
                tmp[i] *= 2;
                gained += tmp[i];
                tmp[i + 1] = 0;
            }
        }
        idx = 0;
        row = {};
        for (int v : tmp)
            if (v)
                row[idx++] = v;
        return gained;
    }

    bool applyMove(const string &dir)
    {
        int rotations = 0;
        if (dir == "right")
            rotations = 2;
        else if (dir == "up")
            rotations = 1;
        else if (dir == "down")
            rotations = 3;

        Board b = rotateN(board, rotations);
        bool changed = false;
        for (auto &row : b)
        {
            array<int, 4> orig = row;
            score += slideLeft(row);
            if (row != orig)
                changed = true;
        }
        if (changed)
            board = rotateN(b, (4 - rotations) % 4);
        return changed;
    }
};

/* ─────────────────────────────────────────────────────────────────────
 * DEMO MAIN
 * ─────────────────────────────────────────────────────────────────── */
int main()
{
    cout << "═══════════════════════════════════════════\n";
    cout << "  DSA 2048 Arena — C++ Reference Demo\n";
    cout << "═══════════════════════════════════════════\n\n";

    Game2048 game;
    cout << "Initial Board:\n";
    printBoard(game.board);

    // Simulate a series of moves
    vector<string> moves = {"left", "up", "right", "down", "left", "up", "left", "right", "down", "up"};
    for (auto &m : moves)
    {
        cout << "\n──── Move: " << m << " ────\n";
        game.move(m);
        game.printAll();
    }

    // Undo
    cout << "\n──── UNDO ────\n";
    game.undo();
    game.printAll();

    // Leaderboard demo
    game.leaderboard.insert(1024, {"Alice", "single", 64});
    game.leaderboard.insert(3456, {"Bob", "ai", 512});
    game.leaderboard.insert(2048, {"Charlie", "two", 256});
    game.leaderboard.insert(5000, {"Diana", "single", 1024});
    game.leaderboard.printLeaderboard();

    cout << "\n✔ All data structures exercised successfully.\n";
    return 0;
}