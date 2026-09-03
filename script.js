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
  completionRate: $("completionRate"),
  usedTime: $("usedTime"),
  resultTitle: $("resultTitle"),
  missedCount: $("missedCount"),
  missedList: $("missedList"),
  againBtn: $("againBtn"),
  resetBtn: $("resetBtn"),
  backBtn: $("backBtn")
};

let allStations = [];
let remainingStations = [];
let foundStations = [];
let gameTimer = null;
let remainingSeconds = CONFIG.gameSeconds;
let gameStartedAt = null;
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

    // 支持 Windows / Linux / Mac 换行，并忽略空行。
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

    els.loadStatus.textContent = `已加载 ${allStations.length} 个公交站名，可以开始。`;
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
  gameStartedAt = Date.now();
  paused = false;
  gameState = "playing";

  els.startPanel.classList.add("hidden");
  els.resultPanel.classList.add("hidden");
  els.gamePanel.classList.remove("hidden");
  els.pauseBtn.textContent = "暂停";
  els.foundList.innerHTML = "";
  els.foundList.classList.add("empty");
  els.foundList.textContent = "还没有猜出任何站名";
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
  // 一次只处理一个字符；如果粘贴了多个字符，只取最后一个有效字符。
  const chars = [...value];
  if (!chars.length) return "";

  // 中文、阿拉伯数字。括号虽然允许出现在站名中，但不作为猜题输入。
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

  // 不匹配时完全不改变游戏状态。
  if (!matched.length) {
    return;
  }

  remainingStations = unmatched;
  foundStations.push(...matched);

  renderFoundStations(matched);
  updateGameStats();

  if (remainingStations.length === 0) {
    finishGame("全部猜出！");
  }
}

function renderFoundStations(newStations) {
  els.foundList.classList.remove("empty");

  if (els.foundList.textContent === "还没有猜出任何站名") {
    els.foundList.textContent = "";
  }

  for (const station of newStations) {
    const span = document.createElement("span");
    span.className = "station new";
    span.textContent = station;
    els.foundList.appendChild(span);
    els.foundList.appendChild(document.createTextNode(" "));
  }

  els.foundHint.textContent = `本次找到 ${newStations.length} 个`;
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
    els.answerInput.placeholder = "输入一个字或数字";
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
  els.completionRate.textContent = `${rate.toFixed(0)}%`;
  els.usedTime.textContent = formatTime(used);
  els.missedCount.textContent = remainingStations.length;

  const progress = Math.max(0, Math.min(100, rate));
  document.querySelector(".circle-progress").style.setProperty("--progress", `${progress}%`);

  els.missedList.innerHTML = "";

  if (!remainingStations.length) {
    els.missedList.innerHTML = '<div class="station">全部猜出，没有遗漏！</div>';
  } else {
    for (const station of remainingStations) {
      const span = document.createElement("span");
      span.className = "station";
      span.textContent = station;
      els.missedList.appendChild(span);
      els.missedList.appendChild(document.createTextNode(" "));
    }
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetToReady() {
  clearInterval(gameTimer);
  gameTimer = null;
  remainingStations = [...allStations];
  foundStations = [];
  remainingSeconds = CONFIG.gameSeconds;
  paused = false;
  gameState = "ready";

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
    finishGame("已放弃");
  }
});
els.resetBtn.addEventListener("click", () => {
  if (gameState === "playing" || gameState === "paused") {
    if (!confirm("确定要退出本局并重新加载站名数据吗？")) return;
  }
  loadStations();
  resetToReady();
});
els.backBtn.addEventListener("click", () => {
  if (history.length > 1) history.back();
  else window.scrollTo({ top: 0, behavior: "smooth" });
});

els.answerInput.addEventListener("input", (event) => {
  const character = normalizeInput(event.target.value);
  event.target.value = "";
  if (character) submitCharacter(character);
});

els.answerInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.target.value = "";
  }
});

// 防止手机浏览器页面滑动时误失焦后无法继续输入。
document.addEventListener("click", (event) => {
  if (
    gameState === "playing" &&
    !paused &&
    !event.target.closest("button") &&
    !event.target.closest(".station-list")
  ) {
    els.answerInput.focus();
  }
});

loadStations();
