const CONFIG = {
  dataFile: "stations.txt",
  gameSeconds: 60 * 60
};

const $ = (id) => document.getElementById(id);
const els = {
  loadStatus: $("loadStatus"), startPanel: $("startPanel"), gamePanel: $("gamePanel"), resultPanel: $("resultPanel"),
  startBtn: $("startBtn"), startTimer: $("startTimer"), startFound: $("startFound"), startRemaining: $("startRemaining"), startTotal: $("startTotal"),
  timer: $("timer"), foundCount: $("foundCount"), remainingCount: $("remainingCount"), totalCount: $("totalCount"),
  answerInput: $("answerInput"), foundList: $("foundList"), foundHint: $("foundHint"), giveUpBtn: $("giveUpBtn"), pauseBtn: $("pauseBtn"),
  resultFound: $("resultFound"), resultTotal: $("resultTotal"), resultFoundCount: $("resultFoundCount"), resultFoundList: $("resultFoundList"),
  completionRate: $("completionRate"), usedTime: $("usedTime"), resultTitle: $("resultTitle"), missedCount: $("missedCount"), missedList: $("missedList"),
  againBtn: $("againBtn"), resetBtn: $("resetBtn"), inputState: $("inputState")
};

let allStations = [];
let remainingStations = [];
let foundStations = [];
let gameTimer = null;
let remainingSeconds = CONFIG.gameSeconds;
let paused = false;
let gameState = "loading";
let composing = false;

function formatTime(totalSeconds) {
  const m = Math.floor(Math.max(0, totalSeconds) / 60).toString().padStart(2, "0");
  const s = (Math.max(0, totalSeconds) % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
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
    const response = await fetch(`${CONFIG.dataFile}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const stations = text.replace(/^\uFEFF/, "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!stations.length) throw new Error("stations.txt 中没有有效站名");

    allStations = stations;
    remainingStations = [...stations];
    foundStations = [];
    gameState = "ready";
    els.loadStatus.textContent = `DATA READY  ·  ${allStations.length} 个站名已载入`;
    els.loadStatus.className = "status ok";
    els.startBtn.disabled = false;
    updateStartStats();
  } catch (error) {
    console.error("Station data load failed:", error);
    gameState = "loading";
    els.loadStatus.className = "status error";
    els.loadStatus.innerHTML = `无法读取 <code>${CONFIG.dataFile}</code>。请使用本地 HTTP 服务器或 GitHub Pages 打开。`;
    els.startBtn.disabled = true;
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
  els.pauseBtn.textContent = "暂停游戏";
  els.answerInput.value = "";
  els.answerInput.disabled = false;
  els.answerInput.placeholder = "输入一个字";
  els.foundList.innerHTML = '<div class="list-empty">等待你的第一个答案</div>';
  els.foundList.classList.add("empty");
  els.foundHint.textContent = "新发现会出现在最前面";
  setInputState("READY", "请输入一个汉字或数字");
  updateGameStats();

  gameTimer = setInterval(() => {
    if (paused || gameState !== "playing") return;
    remainingSeconds -= 1;
    updateGameStats();
    if (remainingSeconds <= 0) {
      remainingSeconds = 0;
      finishGame("时间到");
    }
  }, 1000);

  requestAnimationFrame(() => els.answerInput.focus());
}

function getValidCharacter(value) {
  const chars = [...String(value || "")];
  const valid = chars.filter(ch => /[\u3400-\u9fff0-9]/u.test(ch));
  return valid.length ? valid[valid.length - 1] : "";
}

function setInputState(title, text, type = "") {
  if (!els.inputState) return;
  els.inputState.querySelector("strong").textContent = title;
  els.inputState.querySelector("span").textContent = text;
  els.inputState.className = `input-state ${type}`.trim();
}

function submitCharacter(character) {
  if (gameState !== "playing" || paused || !character) return;

  const matched = [];
  const unmatched = [];
  for (const station of remainingStations) {
    if (station.includes(character)) matched.push(station);
    else unmatched.push(station);
  }

  // 没有匹配：保留输入框中的字，并明确反馈。
  if (!matched.length) {
    els.answerInput.value = character;
    setInputState("NO MATCH", `“${character}” 暂未找到对应站名`, "bad");
    els.foundHint.textContent = `没有站名包含“${character}” · 继续尝试`;
    els.answerInput.focus();
    return;
  }

  remainingStations = unmatched;
  // 最新一批始终放在列表最前面。
  foundStations = [...matched, ...foundStations];
  renderFoundStations();
  updateGameStats();
  els.answerInput.value = "";
  setInputState("MATCHED", `找到 ${matched.length} 个站名`, "good");
  els.answerInput.focus();

  if (remainingStations.length === 0) finishGame("全部猜出");
}

function processInputValue() {
  if (composing || gameState !== "playing" || paused) return;
  const character = getValidCharacter(els.answerInput.value);
  if (!character) return;
  submitCharacter(character);
}

function createStationElement(station) {
  const span = document.createElement("span");
  span.className = "station";
  span.textContent = station;
  return span;
}

function renderFoundStations() {
  els.foundList.classList.remove("empty");
  els.foundList.innerHTML = "";
  if (!foundStations.length) {
    els.foundList.classList.add("empty");
    els.foundList.innerHTML = '<div class="list-empty">等待你的第一个答案</div>';
    return;
  }
  foundStations.forEach((station, index) => {
    const item = createStationElement(station);
    if (index < 3) item.classList.add("recent");
    els.foundList.appendChild(item);
  });
  els.foundHint.textContent = `已发现 ${foundStations.length} 个 · 最新结果在最前面`;
}

function renderResultList(container, stations, emptyText, className) {
  container.innerHTML = "";
  container.className = `station-list ${className}`.trim();
  if (!stations.length) {
    container.innerHTML = `<div class="list-empty">${emptyText}</div>`;
    return;
  }
  stations.forEach(station => container.appendChild(createStationElement(station)));
}

function togglePause() {
  if (gameState !== "playing" && gameState !== "paused") return;
  paused = !paused;
  gameState = paused ? "paused" : "playing";
  els.pauseBtn.textContent = paused ? "继续游戏" : "暂停游戏";
  els.answerInput.disabled = paused;
  if (paused) {
    els.answerInput.blur();
    setInputState("PAUSED", "计时已暂停", "pause");
  } else {
    setInputState("READY", "请输入一个汉字或数字");
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

  renderResultList(els.missedList, remainingStations, "没有遗漏，完美完成。", "missed");
  renderResultList(els.resultFoundList, foundStations, "本局没有猜出站名。", "result-found");
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
  if (gameState === "playing" || gameState === "paused") finishGame("本局结束");
});
els.resetBtn.addEventListener("click", async () => {
  if (gameState === "playing" || gameState === "paused") {
    if (!confirm("确定要退出本局并重新加载站名数据吗？")) return;
  }
  resetToReady();
  await loadStations();
});

// 中文输入法：compositionend 后再处理，避免拼音输入过程中被误判。
els.answerInput.addEventListener("compositionstart", () => { composing = true; });
els.answerInput.addEventListener("compositionend", () => {
  composing = false;
  setTimeout(processInputValue, 0);
});
els.answerInput.addEventListener("input", () => processInputValue());
els.answerInput.addEventListener("paste", () => setTimeout(processInputValue, 0));
els.answerInput.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    els.answerInput.value = "";
    setInputState("READY", "请输入一个汉字或数字");
  }
  // 作为输入法/浏览器兼容兜底：按 Enter 也会提交，但不要求用户按 Enter。
  if (event.key === "Enter") {
    event.preventDefault();
    processInputValue();
  }
});

loadStations();
