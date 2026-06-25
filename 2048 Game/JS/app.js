/**
 * DSA 2048 Arena - Main Application Controller
 * Orchestrates all game modes, UI rendering, and DSA visualizations
 */

// ─── LEADERBOARD MANAGER ────────────────────────────────────────────────────
class LeaderboardManager {
  constructor() {
    this.bst = new BST();
    this._load();
  }

  addEntry(name, mode, score, tile) {
    const data = { name, mode, tile, date: new Date().toLocaleDateString() };
    this.bst.insert(score, data);
    this._save();
  }

  getTop10() {
    return this.bst.getTopN(10);
  }

  getBSTStructure() {
    return this.bst.getTreeStructure();
  }

  _save() {
    const entries = this.bst.inOrder();
    localStorage.setItem('dsa2048_leaderboard', JSON.stringify(entries));
  }

  _load() {
    const raw = localStorage.getItem('dsa2048_leaderboard');
    if (!raw) return;
    try {
      const entries = JSON.parse(raw);
      entries.forEach(e => this.bst.insert(e.score, { name: e.name, mode: e.mode, tile: e.tile, date: e.date }));
    } catch(e) {}
  }

  clear() {
    this.bst.clear();
    localStorage.removeItem('dsa2048_leaderboard');
  }
}

// ─── ACHIEVEMENT SYSTEM ──────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: 'first_merge', title: 'First Merge', desc: 'Make your first tile merge', icon: '🔗', condition: s => s.merges >= 1 },
  { id: 'tile_128',    title: 'Centurion+',  desc: 'Reach tile 128', icon: '🏅', condition: s => s.maxTile >= 128 },
  { id: 'tile_512',    title: 'High Roller', desc: 'Reach tile 512', icon: '🥈', condition: s => s.maxTile >= 512 },
  { id: 'tile_1024',   title: 'Grandmaster', desc: 'Reach tile 1024', icon: '🥇', condition: s => s.maxTile >= 1024 },
  { id: 'tile_2048',   title: '2048 Legend', desc: 'Reach tile 2048!', icon: '🏆', condition: s => s.maxTile >= 2048 },
  { id: 'moves_100',   title: 'Century Moves',desc: 'Make 100 moves', icon: '💯', condition: s => s.moves >= 100 },
  { id: 'score_10k',   title: 'Score Master', desc: 'Score 10,000+', icon: '⭐', condition: s => s.score >= 10000 },
  { id: 'undo_pro',    title: 'Time Traveler',desc: 'Use undo 10 times', icon: '⏮️', condition: s => s.undos >= 10 },
  { id: 'ai_slayer',   title: 'AI Slayer',    desc: 'Beat the AI in VS mode', icon: '🤖', condition: s => s.beatAI },
  { id: 'multi_champ', title: 'Multiplayer Champion', desc: 'Win a 2-player match', icon: '👑', condition: s => s.wonMultiplayer },
];

class AchievementManager {
  constructor() {
    this.unlocked = new Set(JSON.parse(localStorage.getItem('dsa2048_achievements') || '[]'));
  }

  check(stats, callback) {
    ACHIEVEMENTS.forEach(ach => {
      if (!this.unlocked.has(ach.id) && ach.condition(stats)) {
        this.unlocked.add(ach.id);
        this._save();
        if (callback) callback(ach);
      }
    });
  }

  getAll() {
    return ACHIEVEMENTS.map(a => ({ ...a, unlocked: this.unlocked.has(a.id) }));
  }

  _save() {
    localStorage.setItem('dsa2048_achievements', JSON.stringify([...this.unlocked]));
  }
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
class App {
  constructor() {
    this.currentPage = 'menu';
    this.currentMode = 'single';
    this.game1 = null;
    this.game2 = null;
    this.aiPlayer = new AIPlayer('medium');
    this.aiInterval = null;
    this.leaderboard = new LeaderboardManager();
    this.achievements = new AchievementManager();
    this.dsaData = {};
    this.timerInterval = null;
    this.p1Stats = { merges: 0, score: 0, maxTile: 2, moves: 0, undos: 0, time: 0, beatAI: false, wonMultiplayer: false };
    this.gamesPlayed = parseInt(localStorage.getItem('dsa2048_gamesPlayed') || '0');
    this.gamesWon = parseInt(localStorage.getItem('dsa2048_gamesWon') || '0');
    this._bindNav();
    this._initParticles();
    this._renderLeaderboardPage();
    this._renderAchievementsSection();
  }

  // ─── NAVIGATION ─────────────────────────────────────────────────────────
  _bindNav() {
    document.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => this.showPage(btn.dataset.page));
    });
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => this._selectMode(btn.dataset.mode));
    });
  }

  showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) {
      target.classList.add('active');
      this.currentPage = page;
    }
    if (page === 'leaderboard') this._renderLeaderboardPage();
    if (page === 'dashboard') this._renderDashboard();
  }

  _selectMode(mode) {
    this.currentMode = mode;
    document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.mode-card[data-mode="${mode}"]`);
    if (card) card.classList.add('selected');

    // Show/hide AI difficulty
    const aiSection = document.getElementById('ai-difficulty-section');
    if (aiSection) aiSection.style.display = mode === 'ai' ? 'block' : 'none';

    // Show start button
    const startBtn = document.getElementById('start-mode-btn');
    if (startBtn) startBtn.style.display = 'block';
  }

  startGame() {
    this._stopAI();
    this._clearTimer();
    if (this.game1) { this.game1.undoStack.clear(); }

    if (this.currentMode === 'two') {
      this._startTwoPlayer();
    } else if (this.currentMode === 'ai') {
      this._startAIMode();
    } else {
      this._startSinglePlayer();
    }

    this.showPage('game');
    this._startTimer();
  }

  // ─── SINGLE PLAYER ──────────────────────────────────────────────────────
  _startSinglePlayer() {
    document.getElementById('game-board-2-container').style.display = 'none';
    document.getElementById('game-board-1-container').style.display = 'block';
    document.getElementById('game-mode-label').textContent = '⚡ Single Player';

    this.game1 = new Game2048({
      onStateChange: (board, score) => {
        this._renderBoard('board1', board);
        this._updateScoreDisplay('p1-score', score, this.game1.bestScore);
        this._checkAchievements(this.game1);
      },
      onWin: () => this._showWinModal(this.game1.score),
      onGameOver: (score) => this._handleGameOver(score, 'Single Player'),
      onMerge: (count, gained) => this._showMergeEffect('board1', gained),
      onDSAUpdate: (data) => { this.dsaData = data; this._renderDSAWidgets(data); }
    });

    this._renderBoard('board1', this.game1.board);
    this._setupKeyboard();
  }

  // ─── TWO PLAYER ─────────────────────────────────────────────────────────
  _startTwoPlayer() {
    document.getElementById('game-board-2-container').style.display = 'block';
    document.getElementById('game-board-1-container').style.display = 'block';
    document.getElementById('game-mode-label').textContent = '👥 Two Player';

    this.game1 = new Game2048({
      onStateChange: (board, score) => {
        this._renderBoard('board1', board);
        this._updateScoreDisplay('p1-score', score, this.game1.bestScore);
        this._checkTwoPlayerWin();
      },
      onWin: () => this._announceTwoPlayerWinner('Player 1 reached 2048!'),
      onGameOver: () => this._checkTwoPlayerWin(),
      onDSAUpdate: (data) => { this.dsaData = data; this._renderDSAWidgets(data); }
    });

    this.game2 = new Game2048({
      onStateChange: (board, score) => {
        this._renderBoard('board2', board);
        this._updateScoreDisplay('p2-score', score, this.game2.bestScore);
        this._checkTwoPlayerWin();
      },
      onWin: () => this._announceTwoPlayerWinner('Player 2 reached 2048!'),
      onGameOver: () => this._checkTwoPlayerWin(),
      onDSAUpdate: () => {}
    });

    this._renderBoard('board1', this.game1.board);
    this._renderBoard('board2', this.game2.board);
    this._setupKeyboard();
  }

  _checkTwoPlayerWin() {
    if (!this.game1 || !this.game2) return;
    if (this.game1.gameOver && this.game2.gameOver) {
      const winner = this.game1.score >= this.game2.score ? 'Player 1' : 'Player 2';
      this._announceTwoPlayerWinner(`${winner} wins with ${Math.max(this.game1.score, this.game2.score)} points!`);
    }
  }

  _announceTwoPlayerWinner(msg) {
    this._showModal('🏆 Game Over!', msg, () => {
      this.achievements.check({ wonMultiplayer: true }, (ach) => this._showAchievement(ach));
      this.showPage('menu');
    });
  }

  // ─── AI MODE ────────────────────────────────────────────────────────────
  _startAIMode() {
    const diff = document.getElementById('ai-difficulty')?.value || 'medium';
    this.aiPlayer.setDifficulty(diff);

    document.getElementById('game-board-2-container').style.display = 'block';
    document.getElementById('game-board-1-container').style.display = 'block';
    document.getElementById('game-mode-label').textContent = `🤖 vs AI (${diff})`;

    this.game1 = new Game2048({
      onStateChange: (board, score) => {
        this._renderBoard('board1', board);
        this._updateScoreDisplay('p1-score', score, this.game1.bestScore);
      },
      onWin: () => this._handleAIResult('You won! You reached 2048!', true),
      onGameOver: () => this._handleAIResult(
        `Game Over! Your score: ${this.game1.score} vs AI: ${this.game2?.score || 0}`, 
        this.game1.score > (this.game2?.score || 0)
      ),
      onDSAUpdate: (data) => { this.dsaData = data; this._renderDSAWidgets(data); }
    });

    this.game2 = new Game2048({
      onStateChange: (board, score) => {
        this._renderBoard('board2', board);
        this._updateScoreDisplay('p2-score', score, this.game2.bestScore);
        this._renderTreeViz();
      },
      onWin: () => this._handleAIResult('AI reached 2048! Better luck next time.', false),
      onGameOver: () => {
        this._handleAIResult(
          `AI ran out of moves! Your score: ${this.game1.score} vs AI: ${this.game2.score}`,
          this.game1.score >= this.game2.score
        );
      },
      onDSAUpdate: () => {}
    });

    this._renderBoard('board1', this.game1.board);
    this._renderBoard('board2', this.game2.board);
    this._setupKeyboard();
    this._startAI();
  }

  _startAI() {
    this.aiInterval = setInterval(() => {
      if (!this.game2 || this.game2.gameOver) return;
      const move = this.aiPlayer.getBestMove(this.game2.board);
      if (move) {
        this.game2.move(move);
        this._renderTreeViz();
      } else {
        // No valid moves left for AI — treat as AI game over
        this.game2.gameOver = true;
        this._handleAIResult(
          `AI ran out of moves! Your score: ${this.game1.score} vs AI: ${this.game2.score}`,
          this.game1.score >= this.game2.score
        );
      }
    }, this.aiPlayer.moveDelay);
  }

  _stopAI() {
    if (this.aiInterval) { clearInterval(this.aiInterval); this.aiInterval = null; }
  }

  _handleAIResult(msg, playerWon) {
    this._stopAI();
    this._showModal(playerWon ? '🎉 You Won!' : '😔 AI Won', msg, () => this.showPage('menu'));
    if (playerWon) {
      this.achievements.check({ beatAI: true }, (ach) => this._showAchievement(ach));
    }
  }

  // ─── KEYBOARD CONTROLS ──────────────────────────────────────────────────
  _setupKeyboard() {
    document.onkeydown = (e) => {
      const map = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
        w: 'up', s: 'down', a: 'left', d: 'right',
        W: 'up', S: 'down', A: 'left', D: 'right'
      };
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();

      if (this.currentMode === 'two') {
        // WASD = Player 1, Arrows = Player 2
        if (['w','s','a','d','W','S','A','D'].includes(e.key)) {
          this.game1?.move(dir);
        } else {
          this.game2?.move(dir);
        }
      } else {
        this.game1?.move(dir);
      }
    };
  }

  // ─── BOARD RENDERING ────────────────────────────────────────────────────
  _renderBoard(boardId, board) {
    const el = document.getElementById(boardId);
    if (!el) return;

    const prev = {};
    el.querySelectorAll('.tile[data-value]').forEach(t => {
      prev[`${t.dataset.row}-${t.dataset.col}`] = t.dataset.value;
    });

    el.innerHTML = '';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const val = board[r][c];
        const tile = document.createElement('div');
        tile.className = `tile ${val ? `tile-${Math.min(val, 2048)}` : 'tile-empty'}`;
        tile.dataset.row = r;
        tile.dataset.col = c;
        tile.dataset.value = val;
        if (val) {
          tile.textContent = val >= 1024 ? (val >= 2048 ? '2K+' : '1K') : val;
          tile.setAttribute('data-label', val);
          // Animate new tiles
          if (!prev[`${r}-${c}`] || prev[`${r}-${c}`] === '0') {
            tile.classList.add('tile-new');
          }
          // Animate merges (simplified: bigger tiles assumed merged)
          if (prev[`${r}-${c}`] && parseInt(prev[`${r}-${c}`]) === val / 2) {
            tile.classList.add('tile-merge');
          }
        }
        el.appendChild(tile);
      }
    }
  }

  _updateScoreDisplay(elId, score, best) {
    const el = document.getElementById(elId);
    if (el) el.textContent = score.toLocaleString();
    const bestEl = document.getElementById(elId.replace('score', 'best'));
    if (bestEl) bestEl.textContent = best.toLocaleString();
  }

  // ─── DSA VISUALIZATIONS ─────────────────────────────────────────────────
  _renderDSAWidgets(data) {
    this._renderStackWidget(data.stack);
    this._renderQueueWidget(data.queue);
    this._renderLinkedListWidget(data.history);
    this._renderGraphWidget(data.graph, data.graphStats);
    if (this.currentPage === 'dashboard') {
      this._renderDashboard();
    }
  }

  _renderStackWidget(stack) {
    const el = document.getElementById('stack-viz-mini');
    if (!el) return;
    const items = stack.slice(-5).reverse();
    el.innerHTML = items.map((item, i) => `
      <div class="stack-item ${i === 0 ? 'stack-top' : ''}">
        <span class="stack-label">${i === 0 ? 'TOP' : ''}</span>
        <span class="stack-value">Score: ${item.score}</span>
      </div>
    `).join('') + `<div class="dsa-stat">Size: ${stack.length}</div>`;
  }

  _renderQueueWidget(queue) {
    const el = document.getElementById('queue-viz-mini');
    if (!el) return;
    const items = queue.slice(-4);
    el.innerHTML = `<div class="queue-label-row"><span>FRONT</span><span>REAR</span></div>` +
      `<div class="queue-items">` +
      items.map(item => `<div class="queue-item">
        <div class="q-dir">${item.direction?.toUpperCase()}</div>
        <div class="q-score">+${item.score}</div>
      </div>`).join('<span class="q-arrow">→</span>') +
      `</div><div class="dsa-stat">Queued: ${queue.length}</div>`;
  }

  _renderLinkedListWidget(history) {
    const el = document.getElementById('dll-viz-mini');
    if (!el) return;
    const items = history.slice(-5);
    el.innerHTML = items.map((item, i) => `
      <div class="dll-node ${item.isCurrent ? 'dll-current' : ''}">
        <div class="dll-move">${item.data?.move?.toUpperCase() || 'START'}</div>
        <div class="dll-score">S:${item.data?.score || 0}</div>
      </div>
      ${i < items.length - 1 ? '<span class="dll-arrow">⇌</span>' : ''}
    `).join('') + `<div class="dsa-stat">History: ${history.length}</div>`;
  }

  _renderGraphWidget(chain, stats) {
    const el = document.getElementById('graph-viz-mini');
    if (!el) return;
    el.innerHTML = `
      <div class="graph-chain">
        ${chain.map(n => `<div class="graph-node">
          <div class="gn-hash">${n.hash}</div>
          <div class="gn-visits">v:${n.visits}</div>
        </div>`).join('<span class="g-arrow">→</span>')}
      </div>
      <div class="dsa-stat">Nodes: ${stats?.nodes || 0} | Edges: ${stats?.edges || 0}</div>`;
  }

  _renderTreeViz() {
    const el = document.getElementById('tree-viz-mini');
    if (!el || this.currentMode !== 'ai') return;
    const vizData = this.aiPlayer.getTreeVisualization();
    if (!vizData || !vizData.levels.length) return;

    const root = vizData.levels[0]?.[0];
    const children = vizData.levels[1] || [];

    el.innerHTML = `
      <div class="tree-root">
        <div class="tree-node root-node">CURRENT</div>
      </div>
      <div class="tree-children">
        ${children.map(c => `
          <div class="tree-node ${c.isSelected ? 'tree-selected' : ''}">
            <div class="tn-move">${c.move?.toUpperCase()}</div>
            <div class="tn-score">${c.score}</div>
          </div>
        `).join('')}
      </div>
      <div class="dsa-stat">Nodes: ${vizData.totalNodes}</div>
    `;
  }

  // ─── FULL DASHBOARD ─────────────────────────────────────────────────────
  _renderDashboard() {
    if (!this.game1) return;
    const stats = this.game1.getStats();
    this._renderFullStack();
    this._renderFullQueue();
    this._renderFullDLL();
    this._renderFullGraph();
    this._renderBSTViz();
    this._updateStatsCards(stats);
  }

  _renderFullStack() {
    const el = document.getElementById('dash-stack');
    if (!el || !this.game1) return;
    const items = this.game1.undoStack.toArray().reverse();
    el.innerHTML = `<div class="dash-viz-title">Undo Stack (LIFO)</div>` +
      (items.length ? items.slice(0, 8).map((item, i) =>
        `<div class="dash-stack-item ${i === 0 ? 'dash-top' : ''}">
          <span class="badge">${i === 0 ? 'TOP' : items.length - i}</span>
          Move #${item.moveCount} | Score: ${item.score}
        </div>`
      ).join('') : '<div class="empty-viz">Stack empty — make some moves</div>') +
      `<div class="viz-info">Push O(1) | Pop O(1) | Size: ${items.length}</div>`;
  }

  _renderFullQueue() {
    const el = document.getElementById('dash-queue');
    if (!el || !this.game1) return;
    const items = this.game1.moveQueue.toArray();
    el.innerHTML = `<div class="dash-viz-title">Move Queue (FIFO)</div>
      <div class="dash-queue-row">
        ${items.slice(-6).map((item, i, arr) =>
          `<div class="dash-queue-item ${i === 0 ? 'dash-front' : i === arr.length-1 ? 'dash-rear' : ''}">
            <div>${item.direction?.toUpperCase()}</div>
            <div class="q-small">+${item.score}</div>
          </div>
          ${i < arr.length-1 ? '<span>→</span>' : ''}`
        ).join('')}
        ${items.length === 0 ? '<div class="empty-viz">Queue empty</div>' : ''}
      </div>
      <div class="viz-info">Enqueue O(1) | Dequeue O(1) | Size: ${items.length}</div>`;
  }

  _renderFullDLL() {
    const el = document.getElementById('dash-dll');
    if (!el || !this.game1) return;
    const items = this.game1.moveHistory.toArray();
    el.innerHTML = `<div class="dash-viz-title">Move History (Doubly Linked List)</div>
      <div class="dash-dll-row">
        ${items.slice(-6).map((item, i, arr) =>
          `<div class="dash-dll-node ${item.isCurrent ? 'dll-curr' : ''}">
            <div>${item.data?.move?.toUpperCase() || 'START'}</div>
            <div class="q-small">S:${item.data?.score || 0}</div>
          </div>
          ${i < arr.length-1 ? '<span class="dll-bi">⇌</span>' : ''}`
        ).join('')}
        ${items.length === 0 ? '<div class="empty-viz">No history yet</div>' : ''}
      </div>
      <div class="viz-info">Insert O(1) | Navigate O(1) | Size: ${items.length}</div>`;
  }

  _renderFullGraph() {
    const el = document.getElementById('dash-graph');
    if (!el || !this.game1) return;
    const stats = { nodes: this.game1.stateGraph.nodeCount(), edges: this.game1.stateGraph.edgeCount() };
    const chain = this.game1.stateGraph.getRecentChain();
    el.innerHTML = `<div class="dash-viz-title">State Graph (Adjacency List)</div>
      <div class="dash-graph-row">
        ${chain.map((n, i) =>
          `<div class="dash-graph-node">
            <div class="gn-mini">${n.hash}</div>
            <div class="q-small">v:${n.visits} e:${n.edges}</div>
          </div>
          ${i < chain.length-1 ? '<span>→</span>' : ''}`
        ).join('')}
        ${chain.length === 0 ? '<div class="empty-viz">No states recorded yet</div>' : ''}
      </div>
      <div class="viz-info">Nodes: ${stats.nodes} | Edges: ${stats.edges} | Add O(1)</div>`;
  }

  _renderBSTViz() {
    const el = document.getElementById('dash-bst');
    if (!el) return;
    const top = this.leaderboard.getTop10();
    el.innerHTML = `<div class="dash-viz-title">Leaderboard BST (In-order)</div>
      <div class="bst-list">
        ${top.length ? top.map((e, i) =>
          `<div class="bst-row">
            <span class="bst-rank">#${i+1}</span>
            <span class="bst-name">${e.name}</span>
            <span class="bst-score">${e.score?.toLocaleString()}</span>
            <span class="bst-mode">${e.mode}</span>
          </div>`
        ).join('') : '<div class="empty-viz">No scores yet — play a game!</div>'}
      </div>
      <div class="viz-info">Insert O(log n) | Search O(log n) | Traverse O(n)</div>`;
  }

  _updateStatsCards(stats) {
    const map = {
      'stat-score': stats.score,
      'stat-best': stats.bestScore,
      'stat-tile': stats.maxTile,
      'stat-moves': stats.moves,
      'stat-merges': stats.merges,
      'stat-undos': stats.undos,
      'stat-time': this._formatTime(stats.time),
      'stat-games': this.gamesPlayed,
      'stat-won': this.gamesWon,
      'stat-graph': stats.graphNodes
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  }

  // ─── LEADERBOARD PAGE ───────────────────────────────────────────────────
  _renderLeaderboardPage() {
    const el = document.getElementById('leaderboard-list');
    if (!el) return;
    const top = this.leaderboard.getTop10();
    if (!top.length) {
      el.innerHTML = '<div class="empty-lb">No scores yet. Play a game to get on the board!</div>';
      return;
    }
    el.innerHTML = top.map((e, i) => `
      <div class="lb-row ${i === 0 ? 'lb-gold' : i === 1 ? 'lb-silver' : i === 2 ? 'lb-bronze' : ''}">
        <span class="lb-rank">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</span>
        <span class="lb-name">${e.name}</span>
        <span class="lb-score">${e.score?.toLocaleString()}</span>
        <span class="lb-tile">Tile: ${e.tile}</span>
        <span class="lb-mode">${e.mode}</span>
        <span class="lb-date">${e.date}</span>
      </div>
    `).join('');
  }

  _renderAchievementsSection() {
    const el = document.getElementById('achievements-grid');
    if (!el) return;
    el.innerHTML = this.achievements.getAll().map(a => `
      <div class="ach-card ${a.unlocked ? 'ach-unlocked' : 'ach-locked'}">
        <div class="ach-icon">${a.icon}</div>
        <div class="ach-title">${a.title}</div>
        <div class="ach-desc">${a.desc}</div>
      </div>
    `).join('');
  }

  _checkAchievements(game) {
    const stats = game.getStats();
    this.achievements.check({
      ...stats,
      merges: stats.merges
    }, (ach) => this._showAchievement(ach));
  }

  // ─── MODALS & NOTIFICATIONS ─────────────────────────────────────────────
  _showModal(title, msg, onClose) {
    const overlay = document.getElementById('modal-overlay');
    const mTitle = document.getElementById('modal-title');
    const mMsg = document.getElementById('modal-message');
    const mBtn = document.getElementById('modal-btn');
    if (!overlay) return;
    mTitle.textContent = title;
    mMsg.textContent = msg;
    overlay.classList.add('active');
    mBtn.onclick = () => {
      overlay.classList.remove('active');
      if (onClose) onClose();
    };
  }

  _showWinModal(score) {
    if (this.game1) this.game1.winAcknowledged = true;
    this.gamesWon++;
    localStorage.setItem('dsa2048_gamesWon', this.gamesWon);
    this._showModal('🎉 You reached 2048!', `Amazing! Score: ${score.toLocaleString()}. Keep going for higher!`, null);
    this._launchConfetti();
    this._promptLeaderboard(score);
  }

  _handleGameOver(score, mode) {
    this.gamesPlayed++;
    localStorage.setItem('dsa2048_gamesPlayed', this.gamesPlayed);
    this._stopAI();
    this._clearTimer();
    this._showModal('Game Over', `Final Score: ${score.toLocaleString()}`, () => {
      this._promptLeaderboard(score, mode);
    });
  }

  _promptLeaderboard(score, mode) {
    const name = prompt('Enter your name for the leaderboard:') || 'Anonymous';
    this.leaderboard.addEntry(name, mode || this.currentMode, score, this.game1?.getMaxTile() || 0);
    this._renderLeaderboardPage();
  }

  _showAchievement(ach) {
    const container = document.getElementById('achievement-toast');
    if (!container) return;
    container.innerHTML = `<div class="ach-toast">
      <span class="ach-t-icon">${ach.icon}</span>
      <div>
        <div class="ach-t-title">Achievement Unlocked!</div>
        <div class="ach-t-name">${ach.title}</div>
      </div>
    </div>`;
    container.classList.add('active');
    setTimeout(() => { container.classList.remove('active'); }, 3500);
    this._renderAchievementsSection();
  }

  _showMergeEffect(boardId, gained) {
    const el = document.getElementById(`${boardId}-score-flash`);
    if (!el) return;
    el.textContent = `+${gained}`;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 600);
  }

  _launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -10,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 4 + 2,
      color: `hsl(${Math.random()*360},80%,60%)`,
      size: Math.random() * 8 + 4
    }));

    let frames = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });
      frames++;
      if (frames < 150) requestAnimationFrame(animate);
      else canvas.style.display = 'none';
    };
    animate();
  }

  // ─── TIMER ──────────────────────────────────────────────────────────────
  _startTimer() {
    this.timerInterval = setInterval(() => {
      const el = document.getElementById('game-timer');
      if (el && this.game1) {
        el.textContent = this._formatTime(this.game1.getElapsedTime());
      }
    }, 1000);
  }

  _clearTimer() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  }

  _formatTime(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // ─── PARTICLES (BACKGROUND) ─────────────────────────────────────────────
  _initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: Math.random() * 2 + 1,
      alpha: Math.random() * 0.4 + 0.1
    }));

    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(147, 51, 234, ${p.alpha})`;
        ctx.fill();
      });
      requestAnimationFrame(draw);
    };
    draw();
  }
}

// ─── BOOTSTRAP ───────────────────────────────────────────────────────────────
let appInstance;
document.addEventListener('DOMContentLoaded', () => {
  appInstance = new App();
  window.app = appInstance;

  // Touch support
  let touchStartX, touchStartY;
  document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!appInstance.game1 || appInstance.currentPage !== 'game') return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;
    let dir;
    if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'right' : 'left';
    else dir = dy > 0 ? 'down' : 'up';
    appInstance.game1.move(dir);
  }, { passive: true });
});