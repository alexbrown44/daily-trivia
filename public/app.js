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

// ---------- Leaderboard ----------

function leaderboardRow(entry) {
  const tr = document.createElement("tr");
  if (entry.isMe) tr.className = "me";
  const cells = [entry.rank, entry.displayName, entry.average.toFixed(1), entry.answered, entry.streak];
  cells.forEach((value, i) => {
    const td = document.createElement("td");
    td.textContent = value;
    if (i === 1) td.className = "name";
    tr.appendChild(td);
  });
  return tr;
}

async function loadLeaderboard() {
  try {
    const { top, pinned, needed } = await api("/api/leaderboard");
    $("lb-body").replaceChildren(...top.map(leaderboardRow));
    $("lb-pinned").replaceChildren(...(pinned ? [leaderboardRow(pinned)] : []));
    $("lb-empty").classList.toggle("hidden", top.length > 0);
    $("lb-needed").classList.toggle("hidden", !needed);
    $("lb-needed").textContent = `Answer ${needed} more question${needed === 1 ? "" : "s"} to join the leaderboard.`;
  } catch (err) {
    $("lb-empty").textContent = err.message;
    $("lb-empty").classList.remove("hidden");
  }
}

// ---------- Sign-in ----------

let me = null;

async function join(event) {
  event.preventDefault();
  $("join-error").classList.add("hidden");
  $("join-btn").disabled = true;
  try {
    const { player } = await api("/api/join", {
      method: "POST",
      body: JSON.stringify({
        name: $("name-input").value,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
    me = player;
    $("signed-in-as").textContent = `Playing as ${me.displayName}`;
    location.hash = "#today";
    route();
  } catch (err) {
    $("join-error").textContent = err.message;
    $("join-error").classList.remove("hidden");
  } finally {
    $("join-btn").disabled = false;
  }
}

// ---------- Navigation ----------

const VIEWS = ["join", "today", "leaderboard", "history"];

function route() {
  let view = location.hash.slice(1);
  if (!VIEWS.includes(view) || view === "join") view = "today";
  // The leaderboard is public; everything else needs a display name first.
  if (!me && view !== "leaderboard") view = "join";

  for (const v of VIEWS) $("view-" + v).classList.toggle("hidden", v !== view);
  document.querySelectorAll("nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.view === view);
  });

  if (view === "join") $("name-input").focus();
  else if (view === "leaderboard") loadLeaderboard();
  else if (view === "history") loadHistory();
  else loadToday();
}

async function start() {
  try {
    ({ player: me } = await api("/api/me"));
  } catch {
    me = null;
  }
  if (me) $("signed-in-as").textContent = `Playing as ${me.displayName}`;
  route();
}

$("join-form").addEventListener("submit", join);
$("reveal-btn").addEventListener("click", reveal);
$("answer-form").addEventListener("submit", submitAnswer);
window.addEventListener("hashchange", route);
start();
