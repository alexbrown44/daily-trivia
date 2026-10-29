// Daily Trivia - the browser side. It shows the pages and talks to the server.

const $ = (id) => document.getElementById(id);
let timerInterval = null;
let todayData = null;

// ---------- Helpers ----------

function show(stateId) {
  for (const id of ["state-intro", "state-loading", "state-question", "state-result"]) {
    $(id).classList.toggle("hidden", id !== stateId);
  }
}

function showError(message) {
  $("error").textContent = message;
  $("error").classList.toggle("hidden", !message);
}

function scoreBand(score) {
  if (score >= 7) return "good";
  if (score >= 4) return "mid";
  return "bad";
}

function formatDate(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Something went wrong.");
  return body;
}

// ---------- Today ----------

async function loadToday() {
  showError("");
  try {
    todayData = await api("/api/today");
    $("today-date").textContent = formatDate(todayData.date);
    if (!todayData.question) show("state-intro");
    else if (todayData.graded) showResult(todayData);
    else showQuestion(todayData);
  } catch (err) {
    showError(err.message);
  }
}

async function reveal() {
  showError("");
  show("state-loading");
  $("loading-text").textContent = "Generating your question…";
  try {
    todayData = await api("/api/reveal", { method: "POST" });
    showQuestion(todayData);
  } catch (err) {
    show("state-intro");
    showError(err.message);
  }
}

function showQuestion(data) {
  $("q-category").textContent = data.category;
  $("q-text").textContent = data.question;
  show("state-question");
  $("answer-input").focus();
  startTimer(data);
}

function startTimer(data) {
  clearInterval(timerInterval);
  const revealedAt = new Date(data.revealedAt).getTime();

  const tick = () => {
    const elapsed = Math.floor((Date.now() - revealedAt) / 1000);
    const remaining = Math.max(0, data.timeLimit - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = String(remaining % 60).padStart(2, "0");
    $("timer").textContent = `${mins}:${secs}`;
    $("timer").classList.toggle("low", remaining <= 15);
    $("late-note").classList.toggle("hidden", remaining > 0);
    if (remaining === 0) clearInterval(timerInterval);
  };
  tick();
  timerInterval = setInterval(tick, 1000);
}

async function submitAnswer(event) {
  event.preventDefault();
  const answer = $("answer-input").value.trim();
  if (!answer) return;

  showError("");
  clearInterval(timerInterval);
  show("state-loading");
  $("loading-text").textContent = "Grading your answer…";
  try {
    const result = await api("/api/answer", {
      method: "POST",
      body: JSON.stringify({ answer }),
    });
    showResult(result);
  } catch (err) {
    // Reload in case today's question was already answered in another tab.
    await loadToday();
    showError(err.message);
  }
}

function showResult(data) {
  clearInterval(timerInterval);
  $("r-category").textContent = data.category;
  $("r-score").textContent = data.score;
  $("r-verdict").textContent = data.verdict;
  $("r-feedback").textContent = data.feedback;
  $("r-question").textContent = data.question;
  $("r-user-answer").textContent = data.userAnswer;
  $("r-answer").textContent = data.answer;
  $("r-summary").textContent = data.summary;

  const mins = Math.floor(data.secondsTaken / 60);
  const secs = data.secondsTaken % 60;
  const late = data.secondsTaken > data.timeLimit ? " (after the time limit)" : "";
  $("r-time").textContent = `Answered in ${mins ? mins + "m " : ""}${secs}s${late}`;

  const meter = $("r-meter");
  meter.className = "meter " + scoreBand(data.score);
  meter.innerHTML = "";
  for (let i = 1; i <= 10; i++) {
    const segment = document.createElement("span");
    if (i <= data.score) segment.className = "on";
    meter.appendChild(segment);
  }
  show("state-result");
}

// ---------- History ----------

async function loadHistory() {
  try {
    const { stats, items } = await api("/api/history");
    $("s-total").textContent = stats.total;
    $("s-average").textContent = stats.average === null ? "-" : stats.average.toFixed(1);
    $("s-streak").textContent = stats.streak;

    const list = $("history-list");
    list.innerHTML = "";
    $("history-empty").classList.toggle("hidden", items.length > 0);

    for (const item of items) {
      const li = document.createElement("li");

      const score = document.createElement("div");
      score.className = "h-score " + scoreBand(item.score);
      score.textContent = item.score;

      const body = document.createElement("div");
      const meta = document.createElement("p");
      meta.className = "h-meta";
      meta.textContent = `${formatDate(item.date)} · ${item.category}`;
      const question = document.createElement("p");
      question.className = "h-q";
      question.textContent = item.question;
      const answers = document.createElement("p");
      answers.className = "h-meta";
      answers.textContent = `You said: ${item.userAnswer} · Answer: ${item.answer}`;
      body.append(meta, question, answers);

      li.append(score, body);
      list.appendChild(li);
    }
  } catch (err) {
    $("history-empty").textContent = err.message;
    $("history-empty").classList.remove("hidden");
  }
}

// ---------- Navigation ----------

function route() {
  const view = location.hash === "#history" ? "history" : "today";
  $("view-today").classList.toggle("hidden", view !== "today");
  $("view-history").classList.toggle("hidden", view !== "history");
  document.querySelectorAll("nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.view === view);
  });
  if (view === "history") loadHistory();
  else loadToday();
}

$("reveal-btn").addEventListener("click", reveal);
$("answer-form").addEventListener("submit", submitAnswer);
window.addEventListener("hashchange", route);
route();
