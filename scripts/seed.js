// Adds 5 demo players with a few graded answers each, so the leaderboard isn't empty.
// Safe to run more than once: existing demo players are replaced.

const crypto = require("crypto");
const pool = require("../db");

const DEMO_QUESTIONS = [
  ["Geography", "What is the longest river in South America?", "The Amazon"],
  ["Science", "What is the chemical symbol for gold?", "Au"],
  ["Space", "Which planet is known as the Red Planet?", "Mars"],
  ["Art", "Who painted the ceiling of the Sistine Chapel?", "Michelangelo"],
  ["Music", "How many keys are on a standard modern piano?", "88"],
  ["World History", "In which city was the Magna Carta sealed in 1215? (Name the meadow.)", "Runnymede"],
  ["Nature & Animals", "What is the largest species of penguin?", "Emperor penguin"],
  ["Literature", "Who wrote the novel 'Frankenstein'?", "Mary Shelley"],
  ["The Human Body", "What is the largest organ of the human body?", "The skin"],
  ["Inventions", "Who is credited with inventing the World Wide Web?", "Tim Berners-Lee"],
  ["Mythology", "In Greek mythology, who flew too close to the sun?", "Icarus"],
  ["Food & Drink", "Which country is the origin of the cheese Gouda?", "The Netherlands"],
  ["Language & Words", "What is a word that reads the same backwards called?", "A palindrome"],
  ["Sport", "How many players are on the field for one team in a rugby union match?", "15"],
  ["Geography", "What is the capital city of Australia?", "Canberra"],
  ["Science", "What gas do plants absorb from the air for photosynthesis?", "Carbon dioxide"],
  ["Space", "What is the name of the galaxy that contains our Solar System?", "The Milky Way"],
  ["Film & TV", "Which 1939 film features the song 'Over the Rainbow'?", "The Wizard of Oz"],
  ["World History", "Which ancient wonder stood in the harbour of Rhodes?", "The Colossus of Rhodes"],
  ["Inventions", "Which Scottish inventor is credited with the first practical telephone patent?", "Alexander Graham Bell"],
  ["Nature & Animals", "What is a group of crows called?", "A murder"],
  ["Mythology", "Who is the Norse god of thunder?", "Thor"],
];

// [display name, scores for their past days, newest first]
const DEMO_PLAYERS = [
  ["Quizzy McQuizface", [10, 9, 10, 8, 9]],
  ["Ada", [7, 10, 6, 9]],
  ["Trivia Tom", [5, 8, 4, 7, 6]],
  ["Priya", [9, 6, 8]],
  ["Night Owl", [3, 6, 2, 5]],
];

const VERDICTS = {
  high: ["Spot on", "Nailed it", "Perfect recall"],
  mid: ["Close, but not quite", "Half right"],
  low: ["Not this time", "Wrong, but warm"],
};

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

(async () => {
  await pool.query("delete from players where is_demo = true");

  let q = 0;
  for (const [name, scores] of DEMO_PLAYERS) {
    const { rows } = await pool.query(
      `insert into players (display_name, session_hash, is_demo)
       values ($1, $2, true) returning id`,
      [name, crypto.randomBytes(32).toString("hex")] // a random hash nobody can sign in with
    );
    const playerId = rows[0].id;

    for (let i = 0; i < scores.length; i++) {
      const [category, question, answer] = DEMO_QUESTIONS[q++];
      const score = scores[i];
      const band = score >= 7 ? "high" : score >= 4 ? "mid" : "low";
      const day = daysAgo(i + 1);

      const { rows: qRows } = await pool.query(
        `insert into questions (player_id, day, category, difficulty, question, answer, summary, revealed_at)
         values ($1, $2, $3, 'medium', $4, $5, 'Demo question.', $2::date + time '09:00')
         returning id`,
        [playerId, day, category, question, answer]
      );
      await pool.query(
        `insert into answers (question_id, player_id, user_answer, score, verdict, feedback, seconds_taken, submitted_at)
         values ($1, $2, $3, $4, $5, 'Demo answer.', $6, $7::date + time '09:01')`,
        [qRows[0].id, playerId, score >= 7 ? answer : "(demo guess)", score,
         VERDICTS[band][i % VERDICTS[band].length], 30 + i * 11, day]
      );
    }
    console.log(`Added ${name} with ${scores.length} answers.`);
  }

  console.log("Demo players are ready.");
  await pool.end();
})().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});
