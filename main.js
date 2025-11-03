// Base Candy main.js - FIXED VERSION WITH SOUND, LOADING DELAY, AND 8x8 GRID
document.addEventListener("DOMContentLoaded", () => {
  // constants - CHANGED TO 8x8
  const ROWS = 8;
  const COLS = 8;
  const TILES = ROWS * COLS;
  const imagesPath = "images/";

  // CONTRACT CONFIGURATION
  const CONTRACT_ADDRESS = "0xe0c3D4DF26F3D3E27475f1C49168032891011708";
  const CONTRACT_ABI = [
    "function mintScorecard(uint256 score, string memory playerName, uint256 rank, string memory compliment) public returns (uint256)",
    "function getPlayerTokens(address player) public view returns (uint256[] memory)",
    "function totalSupply() public view returns (uint256)",
    "event ScorecardMinted(address indexed player, uint256 indexed tokenId, uint256 score, string playerName, uint256 rank)"
  ];

  // Get app URL for sharing (use current URL or fallback)
  const APP_URL = window.location.origin + window.location.pathname;

  // logos base names (must match your images)
  const LOGOS = [
    "base",
    "arbitrum",
    "optimism",
    "zksync",
    "ethereum",
    "solana"
  ];

  // DOM
  const startScreen = document.getElementById("startScreen");
  const startButton = document.getElementById("startButton");
  const gameBoardContainer = document.getElementById("gameBoardContainer");
  const gameBoard = document.getElementById("gameBoard");
  const scoreEl = document.getElementById("score");
  const timeEl = document.getElementById("time");
  const resetBtn = document.getElementById("resetBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const muteBtn = document.getElementById("muteBtn");
  const endScreen = document.getElementById("endScreen");
  const complimentEl = document.getElementById("compliment");
  const finalScoreEl = document.getElementById("finalScore");
  const restartButton = document.getElementById("restartButton");
  const topbar = document.getElementById("topbar");
  const leaderboardEl = document.getElementById("leaderboard");
  const leaderboardPreviewEl = document.getElementById("leaderboardPreview");
  const countdownOverlay = document.getElementById("countdownOverlay");
  const countdownNumber = document.getElementById("countdownNumber");
  
  // New DOM elements
  const nameInputSection = document.getElementById("nameInputSection");
  const playerNameInput = document.getElementById("playerNameInput");
  const saveNameBtn = document.getElementById("saveNameBtn");
  const actionButtons = document.getElementById("actionButtons");
  const shareToFarcasterBtn = document.getElementById("shareToFarcasterBtn");
  const mintNFTBtn = document.getElementById("mintNFTBtn");
  const walletStatus = document.getElementById("walletStatus");
  const scorecardCanvas = document.getElementById("scorecardCanvas");

  // Audio elements
  const bgMusic = document.getElementById("bgMusic");
  const matchSound = document.getElementById("matchSound");
  const specialSound = document.getElementById("specialSound");
  const comboSound = document.getElementById("comboSound");
  const invalidSound = document.getElementById("invalidSound");
  const winSound = document.getElementById("winSound");

  // game state
  let board = []; // 2d array of tile objects {el, img}
  let score = 0;
  let timeLeft = 60;
  let currentTile = null;
  let targetTile = null;
  let timerInterval = null;
  let isPaused = false;
  let isMuted = false;
  let hintTimeout = null;
  let isProcessing = false;
  
  // New state
  let playerName = "";
  let playerRank = 0;
  let currentCompliment = "";
  let walletConnected = false;
  let userAddress = null;
  let provider = null;
  let signer = null;
  let isFarcasterContext = false;

  // Check if running in Farcaster context
  if (typeof window.farcasterSDK !== 'undefined') {
    isFarcasterContext = true;
    console.log('Running in Farcaster mini app context');
  }

  // IMPROVED SOUND SYSTEM
  function playSound(name) {
    if (isMuted) return;
    
    try {
      let sound = null;
      switch(name) {
        case 'match':
          sound = matchSound.cloneNode();
          sound.volume = 0.4;
          break;
        case 'special':
          sound = specialSound.cloneNode();
          sound.volume = 0.5;
          break;
        case 'combo':
          sound = comboSound.cloneNode();
          sound.volume = 0.6;
          break;
        case 'invalid':
          sound = invalidSound.cloneNode();
          sound.volume = 0.3;
          break;
        case 'win':
          sound = winSound.cloneNode();
          sound.volume = 0.7;
          break;
      }
      
      if (sound) {
        sound.play().catch(e => console.log('Audio play failed:', e));
      }
    } catch(e) {
      console.log('Sound error:', e);
    }
  }

  function startBackgroundMusic() {
    if (isMuted) return;
    try {
      bgMusic.volume = 0.25;
      bgMusic.play().catch(e => console.log('Background music play failed:', e));
    } catch(e) {
      console.log('Background music error:', e);
    }
  }

  function stopBackgroundMusic() {
    try {
      bgMusic.pause();
      bgMusic.currentTime = 0;
    } catch(e) {
      console.log('Stop music error:', e);
    }
  }

  // helpers for file names
  function normalFile(name){ return `${imagesPath}${name}.png` }
  function superFile(name){ return `${imagesPath}${name}-super.png` }
  function megaFile(name){ return `${imagesPath}${name}-mega.png` }
  function blankFile(){ return `${imagesPath}blank.png` }

  function baseNameFromSrc(src){
    const file = src.split("/").pop();
    return file.toLowerCase();
  }

  function baseTypeFromSrc(src){
    const f = baseNameFromSrc(src);
    if(f.endsWith("-super.png")) return { base: f.replace("-super.png",""), suffix: "super" };
    if(f.endsWith("-mega.png")) return { base: f.replace("-mega.png",""), suffix: "mega" };
    if(f.endsWith(".png")) return { base: f.replace(".png",""), suffix: "normal" };
    return { base: f, suffix: "normal" };
  }

  function chooseRandomNormal(){
    const name = LOGOS[Math.floor(Math.random() * LOGOS.length)];
    return normalFile(name);
  }

  // shuffle array for random selections
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // Preload images
  function preloadImages() {
    const images = [];
    LOGOS.forEach(logo => {
      images.push(normalFile(logo));
      images.push(superFile(logo));
      images.push(megaFile(logo));
    });
    images.push(blankFile());
    
    images.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }

  // build initial board with no automatic matches
  function initBoard() {
    board = [];
    gameBoard.innerHTML = "";
    score = 0;
    timeLeft = 60;
    timeEl.textContent = timeLeft;
    updateScore();
    isPaused = false;
    pauseBtn.textContent = "Pause";

    // create tile elements
    for(let r=0;r<ROWS;r++){
      const row = [];
      for(let c=0;c<COLS;c++){
        const tileEl = document.createElement("div");
        tileEl.className = "tile";
        tileEl.draggable = true;
        tileEl.dataset.r = r;
        tileEl.dataset.c = c;

        const img = document.createElement("img");
        tileEl.appendChild(img);

        // event drag handlers
        tileEl.addEventListener("dragstart", dragStart);
        tileEl.addEventListener("dragover", dragOver);
        tileEl.addEventListener("dragenter", dragEnter);
        tileEl.addEventListener("dragleave", dragLeave);
        tileEl.addEventListener("drop", dragDrop);
        tileEl.addEventListener("dragend", dragEnd);

        // Touch handlers for mobile
        tileEl.addEventListener("touchstart", touchStart);
        tileEl.addEventListener("touchmove", touchMove);
        tileEl.addEventListener("touchend", touchEnd);

        gameBoard.appendChild(tileEl);
        row.push({ el: tileEl, img });
      }
      board.push(row);
    }

    // populate ensuring no immediate matches
    let attempts = 0;
    do {
      for(let r=0;r<ROWS;r++){
        for(let c=0;c<COLS;c++){
          board[r][c].img.src = chooseRandomNormal();
        }
      }
      attempts++;
      if (attempts > 100) break; // Safety valve
    } while (hasAnyMatches());

    scaleBoard();
    startHintTimer();
  }

  // check for any matches present
  function hasAnyMatches(){
    const found = findAllMatches({apply:false});
    return found.length > 0;
  }

  // Mobile touch handlers
  let touchStartX, touchStartY, touchTile;

  function touchStart(e) {
    if (isPaused || isProcessing) return;
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchTile = this;
    this.style.transform = 'scale(0.95)';
  }

  function touchMove(e) {
    e.preventDefault(); // Prevent scrolling
  }

  function touchEnd(e) {
    if (!touchTile) return;
    touchTile.style.transform = '';
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;
    const threshold = 20;
    
    const r = parseInt(touchTile.dataset.r);
    const c = parseInt(touchTile.dataset.c);
    
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
      // Horizontal swipe
      const dir = dx > 0 ? 1 : -1;
      const targetCol = c + dir;
      if (targetCol >= 0 && targetCol < COLS) {
        attemptSwap(r, c, r, targetCol);
      }
    } else if (Math.abs(dy) > threshold) {
      // Vertical swipe
      const dir = dy > 0 ? 1 : -1;
      const targetRow = r + dir;
      if (targetRow >= 0 && targetRow < ROWS) {
        attemptSwap(r, c, targetRow, c);
      }
    }
    
    touchTile = null;
  }

  // drag handlers
  function dragStart(e){
    if (isPaused || isProcessing) return;
    currentTile = this;
    this.classList.add("dragging");
  }
  function dragOver(e){ e.preventDefault(); }
  function dragEnter(e){ e.preventDefault(); }
  function dragLeave(e){}
  function dragDrop(e){
    targetTile = this;
  }
  function dragEnd(e){
    this.classList.remove("dragging");
    if(!currentTile || !targetTile) {
      currentTile = null; targetTile = null;
      return;
    }
    const r1=+currentTile.dataset.r, c1=+currentTile.dataset.c;
    const r2=+targetTile.dataset.r, c2=+targetTile.dataset.c;

    // adjacency
    const dr = Math.abs(r1-r2), dc = Math.abs(c1-c2);
    if ((dr===1 && dc===0) || (dr===0 && dc===1)) {
      attemptSwap(r1, c1, r2, c2);
    }
    currentTile = null;
    targetTile = null;
  }

  // Attempt swap with validation
  function attemptSwap(r1, c1, r2, c2) {
    if (isProcessing || isPaused) return;
    
    isProcessing = true;
    swapTiles(r1,c1,r2,c2);
    
    // validate swap: must create at least one match
    const created = findAllMatches({apply:false, checkPositions: [[r1,c1],[r2,c2]]});
    if (created.length === 0) {
      // Invalid swap - revert
      playSound('invalid');
      swapTiles(r1,c1,r2,c2);
      isProcessing = false;
    } else {
      playSound('match');
      processMatchesAndGravity();
      startHintTimer();
    }
  }

  // swap tile images
  function swapTiles(r1,c1,r2,c2){
    const s1 = board[r1][c1].img.src;
    board[r1][c1].img.src = board[r2][c2].img.src;
    board[r2][c2].img.src = s1;
  }

  // find all matches: returns array of {type, coords}
  function findAllMatches({apply=true, checkPositions=null} = {}){
    const allMatches = findMixedMatches(checkPositions).map((coords) => {
      const suffixes = new Set(coords.map(([r,c]) => baseTypeFromSrc(board[r][c].img.src).suffix));
      const normalCount = coords.filter(([r,c]) => baseTypeFromSrc(board[r][c].img.src).suffix === 'normal').length;
      const superCount = coords.filter(([r,c]) => baseTypeFromSrc(board[r][c].img.src).suffix === 'super').length;
      const megaCount = coords.filter(([r,c]) => baseTypeFromSrc(board[r][c].img.src).suffix === 'mega').length;
      
      if (suffixes.size === 1 && suffixes.has('normal')) return {type: 'normal', coords};
      if (suffixes.size === 1 && suffixes.has('super')) return {type: 'super-super', coords};
      if (suffixes.size === 1 && suffixes.has('mega')) return {type: 'mega-mega', coords};
      if (suffixes.has('super') && suffixes.has('mega')) return {type: 'super-mega', coords};
      if (normalCount === 2 && superCount === 1) return {type: 'normal-super', coords};
      if (normalCount === 2 && megaCount === 1) return {type: 'normal-mega', coords};
      if (suffixes.has('mega') && suffixes.has('normal')) return {type: 'mega-normal', coords};
      return null;
    }).filter(match => match && ((match.type === 'normal' || match.type === 'mega-normal' || match.type === 'normal-super' || match.type === 'normal-mega') ? match.coords.length >= 3 : match.coords.length >= 2));

    if(!apply) return allMatches;

    // Filter if checkPositions
    let filtered = allMatches;
    if(checkPositions && checkPositions.length > 0){
      filtered = allMatches.filter(({coords}) => coords.some(([r,c]) => checkPositions.some(([rr,cc]) => rr===r && cc===c)));
    }

    // Process each match
    const seen = new Set();
    for(const match of filtered){
      const key = match.coords.sort((a,b)=>a[0]-b[0] || a[1]-b[1]).map(c=>c.join(",")).join("|");
      if(seen.has(key)) continue;
      match.coords.forEach(c => seen.add(c.join(",")));
      processMatch(match);
    }

    updateScore();
    return allMatches;
  }

  // find mixed matches for same base, any suffixes
  function findMixedMatches(checkPositions = null) {
    const matches = [];

    // horizontal
    for(let r=0;r<ROWS;r++){
      let run = [];
      for(let c=0;c<COLS;c++){
        const pos = [r,c];
        const t = baseTypeFromSrc(board[r][c].img.src);
        if (run.length === 0 || t.base === baseTypeFromSrc(board[run[run.length-1][0]][run[run.length-1][1]].img.src).base) {
          run.push(pos);
        } else {
          if (run.length >= 2) matches.push(run.slice());
          run = [pos];
        }
      }
      if (run.length >= 2) matches.push(run.slice());
    }

    // vertical
    for(let c=0;c<COLS;c++){
      let run = [];
      for(let r=0;r<ROWS;r++){
        const pos = [r,c];
        const t = baseTypeFromSrc(board[r][c].img.src);
        if (run.length === 0 || t.base === baseTypeFromSrc(board[run[run.length-1][0]][run[run.length-1][1]].img.src).base) {
          run.push(pos);
        } else {
          if (run.length >= 2) matches.push(run.slice());
          run = [pos];
        }
      }
      if (run.length >= 2) matches.push(run.slice());
    }

    // filter by checkPositions if provided
    if (checkPositions && checkPositions.length > 0) {
      return matches.filter(coords => coords.some(([r,c]) => checkPositions.some(([rr,cc]) => rr===r && cc===c)));
    }
    return matches;
  }

  // process a single match based on type
  function processMatch({type, coords}) {
    const len = coords.length;
    const centerIdx = Math.floor(len / 2);
    const center = coords[centerIdx];
    const [cr, cc] = center;
    const base = baseTypeFromSrc(board[cr][cc].img.src).base;

    if (type === 'normal') {
      if (len === 3) {
        coords.forEach(([r,c]) => clearTile(r, c, 10));
        triggerSparkleAt(cr, cc, base, 'normal');
      } else if (len === 4) {
        // Create super candy but don't trigger
        coords.forEach(([r,c]) => {
          if (r !== cr || c !== cc) clearTile(r, c, 15);
        });
        board[cr][cc].img.src = superFile(base);
        attachBadge(board[cr][cc].el, "S");
        triggerSparkleAt(cr, cc, base, 'four');
        playSound('special');
      } else if (len >= 5) {
        // Create mega candy but don't trigger
        coords.forEach(([r,c]) => {
          if (r !== cr || c !== cc) clearTile(r, c, 25);
        });
        board[cr][cc].img.src = megaFile(base);
        attachBadge(board[cr][cc].el, "M");
        triggerSparkleAt(cr, cc, base, 'five');
        playSound('special');
      }
    } else if (type === 'super-super') {
      const toClear = new Set();
      coords.forEach(([r,c]) => {
        getNeighborsCoords(r, c, 1).forEach(k => toClear.add(k.join(",")));
        clearTile(r, c, 8);
      });
      toClear.forEach(k => {
        const [rr,cc] = k.split(",").map(Number);
        clearTile(rr, cc, 8);
      });
      triggerSparkleAt(cr, cc, base, 'super-super');
      playSound('special');
    } else if (type === 'normal-super') {
      coords.forEach(([r,c]) => clearTile(r, c, 10));
      clearRandomRows(2);
      clearRandomColumns(2);
      triggerSparkleAt(cr, cc, base, 'normal-super');
      playSound('special');
    } else if (type === 'normal-mega') {
      coords.forEach(([r,c]) => clearTile(r, c, 10));
      clearRandomRows(3);
      clearRandomColumns(3);
      triggerSparkleAt(cr, cc, base, 'normal-mega');
      playSound('special');
    } else if (type === 'mega-normal') {
      coords.forEach(([r,c]) => clearTile(r, c, 10));
      clearRectangleAround(cr, cc);
      triggerSparkleAt(cr, cc, base, 'mega-normal');
      playSound('special');
    } else if (type === 'mega-super') {
      coords.forEach(([r,c]) => clearTile(r, c, 15));
      clearRandomRows(2);
      triggerSparkleAt(cr, cc, base, 'mega-super');
      playSound('special');
    } else if (type === 'super-mega') {
      coords.forEach(([r,c]) => clearTile(r, c, 15));
      clearRandomRows(5);
      clearRandomColumns(5);
      triggerSparkleAt(cr, cc, base, 'super-mega');
      playSound('special');
    } else if (type === 'mega-mega') {
      coords.forEach(([r,c]) => clearTile(r, c, 25));
      clearRandomRows(4);
      clearRandomColumns(4);
      triggerSparkleAt(cr, cc, base, 'mega-mega');
      playSound('special');
    }
  }

  // clear a tile and add score
  function clearTile(r, c, points) {
    if (board[r][c].img.src.endsWith("blank.png")) return;
    board[r][c].img.src = blankFile();
    board[r][c].el.classList.add("crushed");
    setTimeout(() => board[r][c].el.classList.remove("crushed"), 300);
    score += points;
    showScorePopup(r, c, points);
  }

  // Show score popup
  function showScorePopup(r, c, points) {
    const tile = board[r][c].el;
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = `+${points}`;
    tile.style.position = 'relative';
    tile.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);
  }

  // clear column, skip exceptRow
  function clearColumn(col, exceptRow = -1) {
    for (let r = 0; r < ROWS; r++) {
      if (r !== exceptRow) clearTile(r, col, 5);
    }
  }

  // clear row, skip exceptCol
  function clearRow(row, exceptCol = -1) {
    for (let c = 0; c < COLS; c++) {
      if (c !== exceptCol) clearTile(row, c, 5);
    }
  }

  // clear random rows
  function clearRandomRows(n) {
    let rows = Array.from({length: ROWS}, (_, i) => i);
    shuffle(rows);
    for (let i = 0; i < Math.min(n, rows.length); i++) {
      clearRow(rows[i]);
    }
  }

  // clear random columns
  function clearRandomColumns(n) {
    let cols = Array.from({length: COLS}, (_, i) => i);
    shuffle(cols);
    for (let i = 0; i < Math.min(n, cols.length); i++) {
      clearColumn(cols[i]);
    }
  }

  // clear 3x4 rectangle around position
  function clearRectangleAround(r, c) {
    const height = 3;
    const width = 4;
    const startR = Math.max(0, r - Math.floor(height / 2));
    const endR = Math.min(ROWS - 1, startR + height - 1);
    const startC = Math.max(0, c - Math.floor(width / 2));
    const endC = Math.min(COLS - 1, startC + width - 1);
    for (let rr = startR; rr <= endR; rr++) {
      for (let cc = startC; cc <= endC; cc++) {
        clearTile(rr, cc, 6);
      }
    }
  }

  // small utility to get neighbors
  function getNeighborsCoords(r, c, radius = 1) {
    const out = [];
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) out.push([rr, cc]);
      }
    }
    return out;
  }

  // attach tiny badge to tile (super/mega)
  function attachBadge(tileEl, text) {
    const existing = tileEl.querySelector(".badge");
    if (existing) existing.remove();
    const b = document.createElement("div");
    b.className = "badge";
    b.textContent = text;
    tileEl.appendChild(b);
  }

  // sparkle effect at tile with chain color and type
  function triggerSparkleAt(r, c, baseName, type) {
    const tile = board[r][c].el;
    const sp = document.createElement("div");
    sp.className = `sparkle ${baseName} ${type}`;
    tile.appendChild(sp);
    setTimeout(() => sp.remove(), 1500);
  }

  // apply gravity
  function collapseAndRefill() {
    for (let c = 0; c < COLS; c++) {
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][c].img.src.endsWith("blank.png")) {
          let found = -1;
          for (let k = r - 1; k >= 0; k--) {
            if (!board[k][c].img.src.endsWith("blank.png")) {
              found = k;
              break;
            }
          }
          if (found >= 0) {
            board[r][c].img.src = board[found][c].img.src;
            board[found][c].img.src = blankFile();
          } else {
            board[r][c].img.src = chooseRandomNormal();
          }
        }
      }
    }
  }

  // process matches and gravity loop with combo tracking
  function processMatchesAndGravity() {
    let comboCount = 0;
    const loop = () => {
      const matches = findAllMatches({apply: true});
      if (matches.length > 0) {
        comboCount++;
        setTimeout(() => {
          collapseAndRefill();
          setTimeout(loop, 120);
        }, 160);
      } else {
        // No more matches - apply combo bonus
        if (comboCount > 1) {
          const bonus = (comboCount - 1) * 50;
          score += bonus;
          showComboText(`${comboCount}x COMBO! +${bonus}`);
          playSound('combo');
          updateScore();
        }
        isProcessing = false;
        checkDeadlock();
      }
    };
    loop();
  }

  // Show combo text
  function showComboText(text) {
    const comboEl = document.createElement('div');
    comboEl.className = 'combo-text';
    comboEl.textContent = text;
    gameBoardContainer.appendChild(comboEl);
    setTimeout(() => comboEl.remove(), 1500);
  }

  // update score display
  function updateScore() {
    scoreEl.textContent = String(score);
  }

  // scale board to fit
  function scaleBoard() {
    const containerPadding = 18 * 2;
    const topbarHeight = topbar ? topbar.getBoundingClientRect().height : 0;
    const margin = 8;
    const availableHeight = window.innerHeight - containerPadding - topbarHeight - margin;
    const boardRect = gameBoard.getBoundingClientRect();
    let scale = 1;
    if (boardRect.height > availableHeight) {
      scale = Math.min(scale, availableHeight / boardRect.height);
    }
    if (boardRect.width > window.innerWidth * 0.9) {
      scale = Math.min(scale, (window.innerWidth * 0.9) / boardRect.width);
    }
    gameBoard.style.transform = `scale(${scale})`;
    gameBoard.style.transformOrigin = 'top center';
  }

  // Deadlock detection
  function hasValidMoves() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        // Try right
        if (c < COLS - 1) {
          swapTiles(r, c, r, c+1);
          if (findAllMatches({apply: false, checkPositions: [[r,c], [r,c+1]]}).length > 0) {
            swapTiles(r, c, r, c+1);
            return true;
          }
          swapTiles(r, c, r, c+1);
        }
        // Try down
        if (r < ROWS - 1) {
          swapTiles(r, c, r+1, c);
          if (findAllMatches({apply: false, checkPositions: [[r,c], [r+1,c]]}).length > 0) {
            swapTiles(r, c, r+1, c);
            return true;
          }
          swapTiles(r, c, r+1, c);
        }
      }
    }
    return false;
  }

  function checkDeadlock() {
    if (!hasValidMoves()) {
      showMessage("No moves available! Shuffling...");
      setTimeout(() => {
        shuffleBoard();
        isProcessing = false;
      }, 1500);
    }
  }

  function shuffleBoard() {
    const allTiles = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!board[r][c].img.src.endsWith("blank.png")) {
          allTiles.push(board[r][c].img.src);
        }
      }
    }
    
    let attempts = 0;
    do {
      shuffle(allTiles);
      let idx = 0;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!board[r][c].img.src.endsWith("blank.png")) {
            board[r][c].img.src = allTiles[idx++];
          }
        }
      }
      attempts++;
      if (attempts > 50) break;
    } while (hasAnyMatches());
  }

  function showMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'message-overlay';
    msg.textContent = text;
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 2000);
  }

  // Hint system
  function startHintTimer() {
    clearTimeout(hintTimeout);
    hintTimeout = setTimeout(showHint, 5000);
  }

  function showHint() {
    if (isPaused || isProcessing) return;
    
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (c < COLS - 1) {
          swapTiles(r, c, r, c+1);
          if (findAllMatches({apply: false, checkPositions: [[r,c], [r,c+1]]}).length > 0) {
            swapTiles(r, c, r, c+1);
            highlightTile(r, c);
            highlightTile(r, c+1);
            return;
          }
          swapTiles(r, c, r, c+1);
        }
        if (r < ROWS - 1) {
          swapTiles(r, c, r+1, c);
          if (findAllMatches({apply: false, checkPositions: [[r,c], [r+1,c]]}).length > 0) {
            swapTiles(r, c, r+1, c);
            highlightTile(r, c);
            highlightTile(r+1, c);
            return;
          }
          swapTiles(r, c, r+1, c);
        }
      }
    }
  }

  function highlightTile(r, c) {
    board[r][c].el.classList.add('hint');
    setTimeout(() => {
      board[r][c].el.classList.remove('hint');
    }, 2000);
  }

  // Leaderboard functions
  function saveScore(scoreValue, name) {
    const scores = JSON.parse(localStorage.getItem('baseCandyScores') || '[]');
    const entry = { 
      score: scoreValue,
      name: name || 'Anonymous',
      date: new Date().toISOString(),
      timestamp: Date.now()
    };
    scores.push(entry);
    scores.sort((a, b) => b.score - a.score);
    scores.splice(100); // Keep top 100
    localStorage.setItem('baseCandyScores', JSON.stringify(scores));
    return scores.findIndex(s => s.timestamp === entry.timestamp) + 1;
  }

  function displayLeaderboard(container) {
    const scores = JSON.parse(localStorage.getItem('baseCandyScores') || '[]');
    if (scores.length === 0) {
      container.innerHTML = '<p style="text-align:center; opacity:0.7; margin-top:20px;">No scores yet. Be the first!</p>';
      return;
    }

    let html = '<h3>🏆 Top Scores</h3><ol>';
    scores.slice(0, 10).forEach((s, idx) => {
      const date = new Date(s.date).toLocaleDateString();
      html += `<li><span class="rank">#${idx + 1}</span> <span class="player-name">${s.name}</span> ${s.score} <span style="opacity:0.6; font-size:0.8rem;">${date}</span></li>`;
    });
    html += '</ol>';
    container.innerHTML = html;
  }

  // Get trophy emoji based on rank
  function getTrophyEmoji(rank) {
    if (rank === 1) return '🏆';
    if (rank <= 3) return '🥇';
    if (rank <= 10) return '🥈';
    if (rank <= 50) return '🥉';
    return '🍬';
  }

  // COUNTDOWN FUNCTION - SHOWS 3, 2, 1, GO! BEFORE STARTING TIMER
  function showCountdown(callback) {
    countdownOverlay.classList.remove("hidden");
    let count = 3;
    
    countdownNumber.textContent = count;
    countdownNumber.style.animation = 'none';
    setTimeout(() => countdownNumber.style.animation = '', 10);
    
    const countInterval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownNumber.textContent = count;
        countdownNumber.style.animation = 'none';
        setTimeout(() => countdownNumber.style.animation = '', 10);
      } else {
        countdownNumber.textContent = 'GO!';
        countdownNumber.style.animation = 'none';
        setTimeout(() => countdownNumber.style.animation = '', 10);
        clearInterval(countInterval);
        
        setTimeout(() => {
          countdownOverlay.classList.add("hidden");
          if (callback) callback();
        }, 1000);
      }
    }, 1000);
  }

  // end game
  function endGame() {
    clearInterval(timerInterval);
    clearTimeout(hintTimeout);
    stopBackgroundMusic();
    gameBoardContainer.classList.add("hidden");
    endScreen.classList.remove("hidden");
    finalScoreEl.textContent = score;
    
    // Generate compliment
    let compliment = "";
    if (score < 200) {
      compliment = "Nice try! Keep practicing.";
    } else if (score < 500) {
      compliment = "Good job! You're getting the hang of it.";
    } else if (score < 1000) {
      compliment = "Impressive! You're a Base Candy master.";
    } else {
      compliment = "Legendary score! You're crushing it.";
    }
    
    currentCompliment = compliment;
    complimentEl.textContent = compliment;
    
    // Show name input section
    nameInputSection.classList.remove("hidden");
    actionButtons.classList.add("hidden");
    playerNameInput.value = "";
    playerNameInput.focus();
  }

  // Pause functionality
  function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
      clearInterval(timerInterval);
      gameBoard.style.pointerEvents = 'none';
      pauseBtn.textContent = 'Resume';
      showPauseOverlay();
      if (!isMuted) bgMusic.pause();
    } else {
      startTimer();
      gameBoard.style.pointerEvents = 'auto';
      pauseBtn.textContent = 'Pause';
      hidePauseOverlay();
      startHintTimer();
      if (!isMuted) bgMusic.play().catch(e => {});
    }
  }

  function showPauseOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'pauseOverlay';
    overlay.innerHTML = '<h2>PAUSED</h2>';
    document.body.appendChild(overlay);
  }

  function hidePauseOverlay() {
    const overlay = document.getElementById('pauseOverlay');
    if (overlay) overlay.remove();
  }

  function startTimer() {
    timerInterval = setInterval(() => {
      timeLeft--;
      timeEl.textContent = timeLeft;
      if (timeLeft <= 0) endGame();
    }, 1000);
  }

  // Mute functionality
  function toggleMute() {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
    
    if (isMuted) {
      bgMusic.pause();
    } else {
      if (!isPaused && gameBoardContainer.classList.contains('hidden') === false) {
        bgMusic.play().catch(e => {});
      }
    }
  }

  // ============================================
  // WALLET CONNECTION & NFT MINTING FUNCTIONS
  // ============================================

  async function connectWallet() {
    try {
      // Check if ethers is available
      if (typeof window.ethers === 'undefined') {
        showStatusMessage('Ethers.js library not loaded. Please refresh the page.', 'error');
        return false;
      }

      walletStatus.className = 'wallet-status loading';
      walletStatus.innerHTML = 'Connecting wallet...<span class="spinner"></span>';

      let ethereum = null;

      // Check if running in Farcaster context
      if (isFarcasterContext && window.farcasterSDK && window.farcasterSDK.wallet) {
        console.log('Using Farcaster wallet');
        ethereum = window.farcasterSDK.wallet.ethereum;
      } else if (typeof window.ethereum !== 'undefined') {
        console.log('Using MetaMask or injected wallet');
        ethereum = window.ethereum;
      } else {
        showStatusMessage('Please install MetaMask or open in Farcaster!', 'error');
        walletStatus.className = 'wallet-status disconnected';
        walletStatus.textContent = 'No wallet found';
        return false;
      }

      // Request account access
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      
      // Check if on Base mainnet (Chain ID: 8453)
      const chainId = await ethereum.request({ method: 'eth_chainId' });
      
      if (chainId !== '0x2105') { // 8453 in hex
        // Try to switch to Base mainnet
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x2105' }],
          });
        } catch (switchError) {
          // Chain not added, try to add it
          if (switchError.code === 4902) {
            try {
              await ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x2105',
                  chainName: 'Base',
                  nativeCurrency: {
                    name: 'Ethereum',
                    symbol: 'ETH',
                    decimals: 18
                  },
                  rpcUrls: ['https://mainnet.base.org'],
                  blockExplorerUrls: ['https://basescan.org']
                }],
              });
            } catch (addError) {
              showStatusMessage('Failed to add Base network. Please add it manually.', 'error');
              walletStatus.className = 'wallet-status disconnected';
              walletStatus.textContent = 'Please switch to Base network';
              return false;
            }
          } else {
            throw switchError;
          }
        }
      }

      // Create ethers provider and signer using window.ethers
      provider = new window.ethers.providers.Web3Provider(ethereum);
      signer = provider.getSigner();
      userAddress = accounts[0];
      walletConnected = true;

      walletStatus.className = 'wallet-status connected';
      walletStatus.textContent = `Connected: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
      
      return true;
    } catch (error) {
      console.error('Wallet connection error:', error);
      showStatusMessage('Failed to connect wallet: ' + error.message, 'error');
      walletStatus.className = 'wallet-status disconnected';
      walletStatus.textContent = 'Wallet connection failed';
      return false;
    }
  }

  async function mintScorecard() {
    if (!walletConnected) {
      const connected = await connectWallet();
      if (!connected) return;
    }

    try {
      mintNFTBtn.disabled = true;
      mintNFTBtn.innerHTML = 'Minting...<span class="spinner"></span>';

      // Create contract instance using window.ethers
      const contract = new window.ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      // Call mintScorecard function
      const tx = await contract.mintScorecard(
        score,
        playerName,
        playerRank,
        currentCompliment
      );

      showStatusMessage('Transaction submitted! Waiting for confirmation...', 'success');

      // Wait for transaction to be mined
      const receipt = await tx.wait();

      // Get token ID from event
      const event = receipt.events?.find(e => e.event === 'ScorecardMinted');
      const tokenId = event?.args?.tokenId?.toString() || 'Unknown';

      showStatusMessage(
        `🎉 Successfully minted! <a href="https://basescan.org/tx/${receipt.transactionHash}" target="_blank">View on BaseScan</a>`,
        'success'
      );

      mintNFTBtn.innerHTML = '✅ Minted!';
      mintNFTBtn.disabled = true;

    } catch (error) {
      console.error('Minting error:', error);
      let errorMsg = 'Failed to mint NFT: ';
      
      if (error.code === 4001) {
        errorMsg += 'Transaction rejected by user';
      } else if (error.code === -32603) {
        errorMsg += 'Insufficient funds for gas';
      } else {
        errorMsg += error.message;
      }
      
      showStatusMessage(errorMsg, 'error');
      mintNFTBtn.disabled = false;
      mintNFTBtn.textContent = '🎨 Mint Scorecard NFT';
    }
  }

  // ============================================
  // SCORECARD IMAGE GENERATION
  // ============================================

  function generateScorecardImage() {
    const canvas = scorecardCanvas;
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 1400);
    gradient.addColorStop(0, '#001133');
    gradient.addColorStop(1, '#0033aa');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1000, 1400);
    
    // Trophy emoji at top
    const trophy = getTrophyEmoji(playerRank);
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(trophy, 500, 150);
    
    // Title
    ctx.font = 'bold 96px Arial';
    ctx.fillStyle = '#00d4ff';
    ctx.fillText('Base Candy', 500, 280);
    
    // Card box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 4;
    roundRect(ctx, 100, 350, 800, 800, 30);
    ctx.fill();
    ctx.stroke();
    
    // Player label
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PLAYER', 500, 480);
    
    // Player name
    ctx.font = 'bold 56px Arial';
    ctx.fillStyle = '#00d4ff';
    ctx.fillText(playerName, 500, 560);
    
    // Score label
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('SCORE', 500, 680);
    
    // Score value
    ctx.font = 'bold 112px Arial';
    ctx.fillStyle = '#00d4ff';
    ctx.fillText(score.toString(), 500, 820);
    
    // Rank label
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('RANK', 500, 920);
    
    // Rank value
    ctx.font = 'bold 72px Arial';
    ctx.fillStyle = '#ffd700';
    ctx.fillText(`#${playerRank}`, 500, 1020);
    
    // Compliment
    ctx.font = '32px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(currentCompliment, 500, 1100);
    
    // Footer
    ctx.font = '28px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('Base Candy Scorecard', 500, 1280);
    
    return canvas.toDataURL('image/png');
  }

  // Helper function to draw rounded rectangles
  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // ============================================
  // FARCASTER SHARING
  // ============================================

  async function shareToFarcaster() {
    try {
      shareToFarcasterBtn.disabled = true;
      shareToFarcasterBtn.innerHTML = 'Preparing...<span class="spinner"></span>';

      // Generate scorecard image
      const scorecardDataUrl = generateScorecardImage();
      
      // Download the image for user to upload
      const link = document.createElement('a');
      link.download = 'base-candy-scorecard.png';
      link.href = scorecardDataUrl;
      link.click();
      
      showStatusMessage('Scorecard downloaded! Opening Farcaster...', 'success');
      
      // Wait a moment for download to start
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create share text with app link
      const shareText = encodeURIComponent(
        `🍬 I just scored ${score} points in Base Candy!\n\n${currentCompliment}\n\nRank: #${playerRank}\n\nPlay now and beat my score! 🚀\n${APP_URL}`
      );
      
      // Open Farcaster composer
      const farcasterUrl = `https://warpcast.com/~/compose?text=${shareText}`;
      
      // Open in new window
      window.open(farcasterUrl, '_blank');
      
      showStatusMessage('✅ Opened Farcaster! Please attach the downloaded scorecard image to your cast.', 'success');
      
      shareToFarcasterBtn.disabled = false;
      shareToFarcasterBtn.textContent = '📢 Share on Farcaster';
      
    } catch (error) {
      console.error('Share error:', error);
      showStatusMessage('Failed to share: ' + error.message, 'error');
      shareToFarcasterBtn.disabled = false;
      shareToFarcasterBtn.textContent = '📢 Share on Farcaster';
    }
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function showStatusMessage(message, type) {
    const existing = document.querySelector('.status-message');
    if (existing) existing.remove();
    
    const msg = document.createElement('div');
    msg.className = `status-message ${type}`;
    msg.innerHTML = message;
    
    actionButtons.appendChild(msg);
    
    setTimeout(() => msg.remove(), 5000);
  }

  // ============================================
  // EVENT LISTENERS
  // ============================================

  // Save name button
  saveNameBtn.addEventListener("click", () => {
    const name = playerNameInput.value.trim();
    
    if (!name) {
      playerNameInput.focus();
      playerNameInput.style.borderColor = '#ff6b6b';
      return;
    }
    
    playerName = name;
    playerRank = saveScore(score, playerName);
    
    // Update compliment based on rank
    if (playerRank === 1) {
      currentCompliment = "🏆 NEW HIGH SCORE! You're a legend!";
      playSound('win');
    } else if (playerRank <= 3) {
      currentCompliment = `🌟 Top ${playerRank}! Absolutely crushing it!`;
      playSound('win');
    }
    
    complimentEl.textContent = currentCompliment;
    
    // Hide name input, show action buttons
    nameInputSection.classList.add("hidden");
    actionButtons.classList.remove("hidden");
    
    // Display updated leaderboard
    displayLeaderboard(leaderboardEl);
    
    // Auto-connect wallet for easier flow
    connectWallet();
  });

  // Mint NFT button
  mintNFTBtn.addEventListener("click", mintScorecard);

  // Share to Farcaster button
  shareToFarcasterBtn.addEventListener("click", shareToFarcaster);

  // start button - WITH COUNTDOWN
  startButton.addEventListener("click", () => {
    startScreen.classList.add("hidden");
    gameBoardContainer.classList.remove("hidden");
    initBoard();
    scaleBoard();
    
    // Show countdown before starting timer
    showCountdown(() => {
      startTimer();
      startBackgroundMusic();
    });
  });

  // pause button
  pauseBtn.addEventListener("click", togglePause);

  // mute button
  muteBtn.addEventListener("click", toggleMute);

  // reset button
  resetBtn.addEventListener("click", () => {
    clearInterval(timerInterval);
    clearTimeout(hintTimeout);
    initBoard();
    scaleBoard();
    
    // Show countdown before starting timer
    showCountdown(() => {
      startTimer();
    });
  });

  // restart button
  restartButton.addEventListener("click", () => {
    endScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
    displayLeaderboard(leaderboardPreviewEl);
    
    // Reset state
    playerName = "";
    playerRank = 0;
    walletConnected = false;
    userAddress = null;
    mintNFTBtn.disabled = false;
    mintNFTBtn.textContent = '🎨 Mint Scorecard NFT';
    shareToFarcasterBtn.disabled = false;
    shareToFarcasterBtn.textContent = '📢 Share on Farcaster';
    walletStatus.textContent = '';
    walletStatus.className = 'wallet-status';
  });

  window.addEventListener('resize', scaleBoard);

  // Initialize
  preloadImages();
  displayLeaderboard(leaderboardPreviewEl);
});