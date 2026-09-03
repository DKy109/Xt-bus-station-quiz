const CONFIG = {
  dataFile: "stations.txt",
  gameSeconds: 60 * 60
};

const $ = (id) => document.getElementById(id);

const els = {
  loadStatus: $("loadStatus"),
  startPanel: $("startPanel"),
  gamePanel: $("gamePanel"),
  resultPanel: $("resultPanel"),
  startBtn: $("startBtn"),
  startTimer: $("startTimer"),
  startFound: $("startFound"),
  startRemaining: $("startRemaining"),
  startTotal: $("startTotal"),
  timer: $("timer"),
  foundCount: $("foundCount"),
  remainingCount: $("remainingCount"),
  totalCount: $("totalCount"),
  answerInput: $("answerInput"),
  foundList: $("foundList"),
  foundHint: $("foundHint"),
  giveUpBtn: $("giveUpBtn"),
  pauseBtn: $("pauseBtn"),
  resultFound: $("resultFound"),
  resultTotal: $("resultTotal"),
  resultFoundCount: $("resultFoundCount"),
  resultFoundList: $("resultFoundList"),
  completionRate: $("completionRate"),
  usedTime: $("usedTime"),
  resultTitle: $("resultTitle"),
  missedCount: $("missedCount"),
  missedList: $("missedList"),
  againBtn: $("againBtn"),
  resetBtn: $("resetBtn")
};

let allStations = [];
let remainingStations = [];
let foundStations = [];
let gameTimer = null;
let remainingSeconds = CONFIG.gameSeconds;
let paused = false;
let gameState = "loading"; // loading | ready | playing | paused | finished

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateStartStats() {
  els.startFound.textContent = foundStations.length;
  els.startRemaining.textContent = allStations.length ? remainingStations.length : "—";
  els.startTotal.textContent = allStations.length || "—";
  els.startTimer.textContent = formatTime(CONFIG.gameSeconds);
}

function updateGameStats() {
  els.timer.textContent = formatTime(remainingSeconds);
  els.foundCount.textContent = foundStations.length;
  els.remainingCount.textContent = remainingStations.length;
  els.totalCount.textContent = allStations.length;

  els.timer.classList.toggle("warning", remainingSeconds <= 300 && remainingSeconds > 60);
  els.timer.classList.toggle("danger", remainingSeconds <= 60);
}

async function loadStations() {
  try {
    const response = await fetch(CONFIG.dataFile, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const stations = text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    if (!stations.length) {
      throw new Error("stations.txt 中没有有效站名");
    }

    allStations = stations;
    remainingStations = [...allStations];
    foundStations = [];

    els.loadStatus.textContent = `已载入 ${allStations.length} 个站名 · 数据准备完成`;
    els.loadStatus.className = "status ok";
    els.startBtn.disabled = false;
    gameState = "ready";
    updateStartStats();
  } catch (error) {
    console.error(error);
    els.loadStatus.className = "status error";
    els.loadStatus.innerHTML =
      `读取 <code>${CONFIG.dataFile}</code> 失败。请确认它和 index.html 位于同一目录，` +
      `并通过 GitHub Pages / 本地 HTTP 服务器打开，而不是直接双击 index.html。`;
    els.startBtn.disabled = true;
    gameState = "loading";
  }
}

function startGame() {
  if (!allStations.length) return;

  clearInterval(gameTimer);
  remainingStations = [...allStations];
  foundStations = [];
  remainingSeconds = CONFIG.gameSeconds;
  paused = false;
  gameState = "playing";

  els.startPanel.classList.add("hidden");
  els.resultPanel.classList.add("hidden");
  els.gamePanel.classList.remove("hidden");
  els.pauseBtn.textContent = "暂停";
  els.answerInput.value = "";
  els.answerInput.placeholder = "例：中";
  els.foundList.innerHTML = "";
  els.foundList.classList.add("empty");
  els.foundList.textContent = "还没有发现站名";
  els.foundHint.textContent = "输入字符开始";
  updateGameStats();

  gameTimer = setInterval(() => {
    if (paused) return;

    remainingSeconds -= 1;
    updateGameStats();

    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      finishGame("时间到");
    }
  }, 1000);

  setTimeout(() => els.answerInput.focus(), 50);
}

function normalizeInput(value) {
  const chars = [...value];
  if (!chars.length) return "";

  const valid = chars.filter(char => /[\u3400-\u9fff0-9]/.test(char));
  return valid.length ? valid[valid.length - 1] : "";
}

function submitCharacter(character) {
  if (gameState !== "playing" || paused || !character) return;

  const matched = [];
  const unmatched = [];

  for (const station of remainingStations) {
    if (station.includes(character)) {
      matched.push(station);
    } else {
      unmatched.push(station);
    }
  }

  // 没猜中：保留输入内容，让玩家能看到刚才输入了什么；游戏状态不变。
  if (!matched.length) {
    els.answerInput.value = character;
    els.answerInput.select();
    els.foundHint.textContent = `“${character}”没有匹配到站名`;
    return;
  }

  remainingStations = unmatched;

  // 新猜出的站名插到最前面，而不是追加到列表末尾。
  foundStations = [...matched, ...foundStations];
  renderFoundStations();
  updateGameStats();

  // 猜中后清空输入框，方便继续输入下一个字符。
  els.answerInput.value = "";

  if (remainingStations.length === 0) {
    finishGame("全部猜出！");
  }
}

function createStationElement(station, extraClass = "") {
  const span = document.createElement("span");
  span.className = `station ${extraClass}`.trim();
  span.textContent = station;
  return span;
}

function renderFoundStations() {
  els.foundList.classList.remove("empty");
  els.foundList.innerHTML = "";

  if (!foundStations.length) {
    els.foundList.classList.add("empty");
    els.foundList.textContent = "还没有发现站名";
    return;
  }

  for (const station of foundStations) {
    els.foundList.appendChild(createStationElement(station));
  }

  els.foundHint.textContent = `已发现 ${foundStations.length} 个 · 最新结果在最前`;
}

function renderResultList(container, stations, emptyText, className = "") {
  container.innerHTML = "";
  container.className = `station-list ${className}`.trim();

  if (!stations.length) {
    container.innerHTML = `<div class="list-empty">${emptyText}</div>`;
    return;
  }

  for (const station of stations) {
    container.appendChild(createStationElement(station));
  }
}

function togglePause() {
  if (gameState !== "playing" && gameState !== "paused") return;

  paused = !paused;
  gameState = paused ? "paused" : "playing";
  els.pauseBtn.textContent = paused ? "继续" : "暂停";

  if (paused) {
    els.answerInput.blur();
    els.answerInput.placeholder = "游戏已暂停";
  } else {
    els.answerInput.placeholder = "例：中";
    els.answerInput.focus();
  }
}

function finishGame(reason) {
  if (gameState === "finished") return;

  clearInterval(gameTimer);
  gameTimer = null;
  gameState = "finished";
  paused = false;

  const found = foundStations.length;
  const total = allStations.length;
  const rate = total ? (found / total) * 100 : 0;
  const used = CONFIG.gameSeconds - remainingSeconds;

  els.gamePanel.classList.add("hidden");
  els.resultPanel.classList.remove("hidden");

  els.resultTitle.textContent = reason;
  els.resultFound.textContent = found;
  els.resultTotal.textContent = total;
  els.resultFoundCount.textContent = found;
  els.completionRate.textContent = `${rate.toFixed(0)}%`;
  els.usedTime.textContent = formatTime(used);
  els.missedCount.textContent = remainingStations.length;

  // 结果页先显示未猜出，再显示已猜出；两部分分别保留。
  renderResultList(
    els.missedList,
    remainingStations,
    "全部猜出，没有遗漏！",
    "missed"
  );
  renderResultList(
    els.resultFoundList,
    foundStations,
    "本局没有猜出站名。",
    "result-found"
  );

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetToReady() {
  clearInterval(gameTimer);
  gameTimer = null;
  remainingStations = [...allStations];
  foundStations = [];
  remainingSeconds = CONFIG.gameSeconds;
  paused = false;
  gameState = allStations.length ? "ready" : "loading";

  els.gamePanel.classList.add("hidden");
  els.resultPanel.classList.add("hidden");
  els.startPanel.classList.remove("hidden");
  els.answerInput.value = "";
  updateStartStats();
}

els.startBtn.addEventListener("click", startGame);
els.againBtn.addEventListener("click", resetToReady);
els.pauseBtn.addEventListener("click", togglePause);
els.giveUpBtn.addEventListener("click", () => {
  if (gameState === "playing" || gameState === "paused") {
    finishGame("本局结束");
  }
});
els.resetBtn.addEventListener("click", () => {
  if (gameState === "playing" || gameState === "paused") {
    if (!confirm("确定要退出本局并重新加载站名数据吗？")) return;
  }
  loadStations();
  resetToReady();
});

els.answerInput.addEventListener("input", (event) => {
  const character = normalizeInput(event.target.value);
  if (!character) return;
  submitCharacter(character);
});

els.answerInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.target.value = "";
  }
});

// 点击非按钮区域时，让输入框继续保持可用。
document.addEventListener("click", (event) => {
  if (
    gameState === "playing" &&
    !paused &&
    !event.target.closest("button") &&
    !event.target.closest(".station-list") &&
    !event.target.closest(".answer-input")
  ) {
    els.answerInput.focus();
  }
});

loadStations();
