const fs = require('fs');
const path = require('path');

// --- Replicate the EXACT buggy parsing from data.js ---
const BUGGY_GENRE_NAMES = [
    "Action", "Adventure", "Animation", "Children's", "Comedy",
    "Crime", "Documentary", "Drama", "Fantasy", "Film-Noir",
    "Horror", "Musical", "Mystery", "Romance", "Sci-Fi",
    "Thriller", "War", "Western"
];

function parseItemDataBuggy(text) {
    const movies = [];
    const lines = text.split('\n');
    for (const line of lines) {
        if (line.trim() === '') continue;
        const fields = line.split('|');
        if (fields.length < 5) continue;
        const id = parseInt(fields[0]);
        const title = fields[1];
        const genreValues = fields.slice(5, 24).map(v => parseInt(v));
        const genres = BUGGY_GENRE_NAMES.filter((_, i) => genreValues[i] === 1);
        movies.push({ id, title, genres });
    }
    return movies;
}

// --- Fixed parsing (19 genres including "unknown") ---
const FIXED_GENRE_NAMES = [
    "unknown", "Action", "Adventure", "Animation", "Children's", "Comedy",
    "Crime", "Documentary", "Drama", "Fantasy", "Film-Noir",
    "Horror", "Musical", "Mystery", "Romance", "Sci-Fi",
    "Thriller", "War", "Western"
];

function parseItemDataFixed(text) {
    const movies = [];
    const lines = text.split('\n');
    for (const line of lines) {
        if (line.trim() === '') continue;
        const fields = line.split('|');
        if (fields.length < 24) continue;
        const id = parseInt(fields[0]);
        const title = fields[1];
        const genreValues = fields.slice(5, 24).map(v => parseInt(v));
        const genres = FIXED_GENRE_NAMES.filter((_, i) => genreValues[i] === 1);
        movies.push({ id, title, genres });
    }
    return movies;
}

// --- Jaccard similarity (same as script.js) ---
function jaccard(a, b) {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size > 0 ? intersection.size / union.size : 0;
}

// --- Main ---
const itemPath = path.join(__dirname, '..', 'u.item');
const text = fs.readFileSync(itemPath, 'latin1');

const buggyMovies = parseItemDataBuggy(text);
const fixedMovies = parseItemDataFixed(text);

function analyze(movies, label, targetId) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${label}`);
    console.log(`${'='.repeat(60)}`);

    const target = movies.find(m => m.id === targetId);
    if (!target) { console.log(`  id ${targetId} not found!`); return; }

    console.log(`\n  Target: id=${target.id} "${target.title}"`);
    console.log(`  Genres: [${target.genres.join(', ')}]`);

    const scored = movies
        .filter(m => m.id !== targetId)
        .map(m => ({ ...m, score: jaccard(target.genres, m.genres) }))
        .sort((a, b) => b.score - a.score);

    const topScore = scored[0].score;
    const tied = scored.filter(m => m.score === topScore);

    console.log(`\n  Top score: ${topScore}`);
    console.log(`  Movies tied at top score: ${tied.length}`);
    console.log(`  (out of ${scored.length} candidates)\n`);

    tied.forEach(m => {
        console.log(`    id=${String(m.id).padStart(4)}  score=${m.score.toFixed(4)}  "${m.title}"`);
        console.log(`           genres: [${m.genres.join(', ')}]`);
    });
}

const targetId = 255;
analyze(buggyMovies, `BUGGY code (current) — id ${targetId}`, targetId);
analyze(fixedMovies, `FIXED code — id ${targetId}`, targetId);
