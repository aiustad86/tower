const board = document.getElementById('board');
const diskCountSelect = document.getElementById('disk-count');
const moveCountDisplay = document.getElementById('move-count');
const minimumMovesDisplay = document.getElementById('minimum-moves');
const elapsedTimeDisplay = document.getElementById('elapsed-time');
const gameStatus = document.getElementById('game-status');
const solveButton = document.getElementById('solve-button');
const pauseButton = document.getElementById('pause-button');
const stepButton = document.getElementById('step-button');
const speedRange = document.getElementById('speed-range');
const speedValue = document.getElementById('speed-value');

const diskColors = ['#e8755b', '#e9a23b', '#d2bc45', '#70a66f', '#42a5a0', '#5888c7', '#8e70b2', '#d6769b'];
const speedNames = ['Slow', 'Easy', 'Normal', 'Quick', 'Fast'];
let towers = [];
let selectedPeg = null;
let moveCount = 0;
let elapsedSeconds = 0;
let timerStartedAt = null;
let timerInterval = null;
let solutionMoves = [];
let solverInterval = null;
let isAutoPlaying = false;
let gameComplete = false;

function diskCount() {
    return Number(diskCountSelect.value);
}

function setStatus(message, tone = 'default') {
    gameStatus.lastChild.textContent = ` ${message}`;
    gameStatus.classList.toggle('is-error', tone === 'error');
    gameStatus.classList.toggle('is-success', tone === 'success');
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remainder = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
}

function updateTimer() {
    if (timerStartedAt !== null) {
        elapsedSeconds = Math.floor((Date.now() - timerStartedAt) / 1000);
        elapsedTimeDisplay.textContent = formatTime(elapsedSeconds);
    }
}

function startTimer() {
    if (timerStartedAt !== null) return;
    timerStartedAt = Date.now() - elapsedSeconds * 1000;
    timerInterval = window.setInterval(updateTimer, 250);
}

function stopSolver() {
    if (solverInterval !== null) {
        window.clearInterval(solverInterval);
        solverInterval = null;
    }
    isAutoPlaying = false;
    updateControls();
}

function updateControls() {
    solveButton.disabled = gameComplete || isAutoPlaying;
    pauseButton.disabled = !isAutoPlaying;
    stepButton.disabled = gameComplete || isAutoPlaying;
}

function renderBoard() {
    const pegNames = ['Tower 1', 'Tower 2', 'Tower 3'];
    const pegButtons = towers.map((tower, pegIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'peg';
        button.dataset.peg = String(pegIndex);
        button.setAttribute('aria-pressed', String(selectedPeg === pegIndex));
        if (selectedPeg === pegIndex) button.classList.add('is-selected');
        if (selectedPeg !== null && selectedPeg !== pegIndex) button.classList.add('is-target');

        const label = document.createElement('span');
        label.className = 'peg-label';
        label.textContent = `TOWER 0${pegIndex + 1}`;
        button.append(label);

        const scene = document.createElement('span');
        scene.className = 'peg-scene';
        scene.setAttribute('aria-hidden', 'true');

        const rod = document.createElement('span');
        rod.className = 'peg-rod';
        scene.append(rod);

        const stack = document.createElement('span');
        stack.className = 'disk-stack';
        tower.forEach((disk) => {
            const diskElement = document.createElement('span');
            const width = 30 + (disk / diskCount()) * 64;
            diskElement.className = 'disk';
            diskElement.style.width = `${width}%`;
            diskElement.style.backgroundColor = diskColors[(disk - 1) % diskColors.length];
            stack.append(diskElement);
        });
        scene.append(stack);

        const base = document.createElement('span');
        base.className = 'peg-base';
        scene.append(base);
        button.append(scene);

        const topToBottom = tower.slice().reverse();
        const diskDescription = topToBottom.length
            ? ` Disks from top: ${topToBottom.join(', ')}.`
            : ' Empty.';
        const selectionDescription = selectedPeg === pegIndex ? ' Selected as the source tower.' : '';
        button.setAttribute('aria-label', `${pegNames[pegIndex]}, ${tower.length} ${tower.length === 1 ? 'disk' : 'disks'}.${diskDescription}${selectionDescription}`);
        return button;
    });

    board.replaceChildren(...pegButtons);
}

function updateStats() {
    moveCountDisplay.textContent = String(moveCount);
    minimumMovesDisplay.textContent = String(2 ** diskCount() - 1);
    elapsedTimeDisplay.textContent = formatTime(elapsedSeconds);
}

function resetGame() {
    stopSolver();
    if (timerInterval !== null) {
        window.clearInterval(timerInterval);
        timerInterval = null;
    }
    towers = [Array.from({ length: diskCount() }, (_, index) => diskCount() - index), [], []];
    selectedPeg = null;
    moveCount = 0;
    elapsedSeconds = 0;
    timerStartedAt = null;
    solutionMoves = [];
    gameComplete = false;
    updateStats();
    renderBoard();
    updateControls();
    setStatus('Pick a tower, then choose where to place its top disk.');
}

function finishGame() {
    gameComplete = true;
    stopSolver();
    setStatus(`Solved in ${moveCount} moves. Nicely done!`, 'success');
    updateControls();
}

function moveDisk(from, to) {
    const source = towers[from];
    const destination = towers[to];
    const disk = source[source.length - 1];
    const destinationTop = destination[destination.length - 1];

    if (disk === undefined) {
        setStatus('That tower is empty. Choose a tower with a disk.', 'error');
        return false;
    }
    if (destinationTop !== undefined && destinationTop < disk) {
        setStatus('That move is not allowed. A larger disk cannot sit on a smaller one.', 'error');
        return false;
    }

    source.pop();
    destination.push(disk);
    moveCount += 1;
    selectedPeg = null;
    startTimer();
    updateStats();
    renderBoard();

    if (towers[2].length === diskCount()) {
        finishGame();
    } else if (!isAutoPlaying) {
        setStatus(`Disk ${disk} moved to Tower ${to + 1}.`);
    }
    return true;
}

function findSolution() {
    const start = Array(diskCount()).fill(-1);
    towers.forEach((tower, pegIndex) => {
        tower.forEach((disk) => { start[disk - 1] = pegIndex; });
    });

    const goal = Array(diskCount()).fill(2);
    const keyOf = (state) => state.join('');
    const startKey = keyOf(start);
    const goalKey = keyOf(goal);
    const queue = [start];
    const previous = new Map([[startKey, null]]);

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const state = queue[cursor];
        const stateKey = keyOf(state);
        if (stateKey === goalKey) break;

        const tops = [null, null, null];
        state.forEach((peg, diskIndex) => {
            if (tops[peg] === null) tops[peg] = diskIndex + 1;
        });

        for (let from = 0; from < 3; from += 1) {
            const disk = tops[from];
            if (disk === null) continue;
            for (let to = 0; to < 3; to += 1) {
                if (to === from || (tops[to] !== null && tops[to] < disk)) continue;
                const next = state.slice();
                next[disk - 1] = to;
                const nextKey = keyOf(next);
                if (previous.has(nextKey)) continue;
                previous.set(nextKey, { key: stateKey, from, to });
                queue.push(next);
            }
        }
    }

    const moves = [];
    let key = goalKey;
    while (key !== startKey) {
        const entry = previous.get(key);
        if (!entry) return [];
        moves.push({ from: entry.from, to: entry.to });
        key = entry.key;
    }
    return moves.reverse();
}

function playNextSolutionMove() {
    if (solutionMoves.length === 0 || gameComplete) {
        stopSolver();
        return;
    }
    const nextMove = solutionMoves.shift();
    moveDisk(nextMove.from, nextMove.to);
}

function startSolver() {
    if (gameComplete) return;
    solutionMoves = findSolution();
    if (solutionMoves.length === 0) {
        setStatus('The puzzle is already solved.', 'success');
        return;
    }
    isAutoPlaying = true;
    updateControls();
    playNextSolutionMove();
    if (!gameComplete) {
        const delay = 1100 - (Number(speedRange.value) - 1) * 180;
        solverInterval = window.setInterval(playNextSolutionMove, delay);
    }
}

function stepSolution() {
    if (gameComplete) return;
    solutionMoves = findSolution();
    if (solutionMoves.length === 0) {
        setStatus('The puzzle is already solved.', 'success');
        return;
    }
    const nextMove = solutionMoves[0];
    moveDisk(nextMove.from, nextMove.to);
}

board.addEventListener('click', (event) => {
    const pegButton = event.target.closest('[data-peg]');
    if (!pegButton || gameComplete || isAutoPlaying) return;
    const pegIndex = Number(pegButton.dataset.peg);

    if (selectedPeg === null) {
        if (towers[pegIndex].length === 0) {
            setStatus('That tower is empty. Choose a tower with a disk.', 'error');
            return;
        }
        selectedPeg = pegIndex;
        renderBoard();
        setStatus(`Tower ${pegIndex + 1} selected. Choose a destination tower.`);
        return;
    }

    if (selectedPeg === pegIndex) {
        selectedPeg = null;
        renderBoard();
        setStatus('Selection cleared. Pick a tower to move from.');
        return;
    }

    const moved = moveDisk(selectedPeg, pegIndex);
    if (!moved) {
        selectedPeg = null;
        renderBoard();
    }
});

document.getElementById('reset-button').addEventListener('click', resetGame);
diskCountSelect.addEventListener('change', resetGame);
solveButton.addEventListener('click', startSolver);
pauseButton.addEventListener('click', stopSolver);
stepButton.addEventListener('click', stepSolution);
speedRange.addEventListener('input', () => {
    speedValue.textContent = speedNames[Number(speedRange.value) - 1];
});

resetGame();
