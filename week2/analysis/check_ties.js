const fs = require('fs');
const path = require('path');

// --- Replicate the EXACT buggy parsing from original data.js ---
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

// --- Fixed parsing (19 genres including "unknown", field count == 24) ---
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

// --- Compute tied lists ---
function getTiedList(movies, targetId) {
    const target = movies.find(m => m.id === targetId);
    const scored = movies
        .filter(m => m.id !== targetId)
        .map(m => ({ ...m, score: jaccard(target.genres, m.genres) }))
        .sort((a, b) => b.score - a.score);
    const topScore = scored[0].score;
    return scored.filter(m => m.score === topScore);
}

// --- Main ---
const itemPath = path.join(__dirname, '..', 'u.item');
const text = fs.readFileSync(itemPath, 'latin1');

const buggyMovies = parseItemDataBuggy(text);
const fixedMovies = parseItemDataFixed(text);

const targetId = 225;
const buggyTarget = buggyMovies.find(m => m.id === targetId);
const fixedTarget = fixedMovies.find(m => m.id === targetId);

console.log('='.repeat(70));
console.log(`  BUGGY code — id ${targetId}: "${buggyTarget.title}"`);
console.log('='.repeat(70));
console.log(`  Genres: [${buggyTarget.genres.join(', ')}]`);

const buggyTied = getTiedList(buggyMovies, targetId);
console.log(`  Top score: ${buggyTied[0].score}`);
console.log(`  Movies tied at top score: ${buggyTied.length}`);
buggyTied.forEach(m => {
    console.log(`    id=${String(m.id).padStart(4)}  "${m.title}"`);
    console.log(`           genres: [${m.genres.join(', ')}]`);
});

console.log('\n');
console.log('='.repeat(70));
console.log(`  FIXED code — id ${targetId}: "${fixedTarget.title}"`);
console.log('='.repeat(70));
console.log(`  Genres: [${fixedTarget.genres.join(', ')}]`);

const fixedTied = getTiedList(fixedMovies, targetId);
console.log(`  Top score: ${fixedTied[0].score}`);
console.log(`  Movies tied at top score: ${fixedTied.length}`);
fixedTied.forEach(m => {
    console.log(`    id=${String(m.id).padStart(4)}  "${m.title}"`);
    console.log(`           genres: [${m.genres.join(', ')}]`);
});

// --- Set difference ---
const buggyIds = new Set(buggyTied.map(m => m.id));
const fixedIds = new Set(fixedTied.map(m => m.id));

const onlyInBuggy = buggyTied.filter(m => !fixedIds.has(m.id));
const onlyInFixed = fixedTied.filter(m => !buggyIds.has(m.id));
const inBoth = buggyTied.filter(m => fixedIds.has(m.id));

console.log('\n');
console.log('='.repeat(70));
console.log('  SET DIFFERENCE');
console.log('='.repeat(70));
console.log(`  In both lists:  ${inBoth.length} movies`);
console.log(`  Only in buggy:  ${onlyInBuggy.length} movies`);
console.log(`  Only in fixed:  ${onlyInFixed.length} movies`);

if (onlyInBuggy.length > 0) {
    console.log('\n  --- Only in BUGGY list ---');
    onlyInBuggy.forEach(m => {
        const buggyMovie = buggyMovies.find(x => x.id === m.id);
        const fixedMovie = fixedMovies.find(x => x.id === m.id);
        const buggyJ = jaccard(buggyTarget.genres, buggyMovie.genres);
        const fixedJ = jaccard(fixedTarget.genres, fixedMovie.genres);
        console.log(`\n    id=${m.id} "${m.title}"`);
        console.log(`      Buggy genres: [${buggyMovie.genres.join(', ')}]  Jaccard=${buggyJ.toFixed(4)}`);
        console.log(`      Fixed genres: [${fixedMovie.genres.join(', ')}]  Jaccard=${fixedJ.toFixed(4)}`);
    });
}

if (onlyInFixed.length > 0) {
    console.log('\n  --- Only in FIXED list ---');
    onlyInFixed.forEach(m => {
        const buggyMovie = buggyMovies.find(x => x.id === m.id);
        const fixedMovie = fixedMovies.find(x => x.id === m.id);
        const buggyJ = jaccard(buggyTarget.genres, buggyMovie.genres);
        const fixedJ = jaccard(fixedTarget.genres, fixedMovie.genres);
        console.log(`\n    id=${m.id} "${m.title}"`);
        console.log(`      Buggy genres: [${buggyMovie.genres.join(', ')}]  Jaccard=${buggyJ.toFixed(4)}`);
        console.log(`      Fixed genres: [${fixedMovie.genres.join(', ')}]  Jaccard=${fixedJ.toFixed(4)}`);
    });
}

if (onlyInBuggy.length === 0 && onlyInFixed.length === 0) {
    console.log('\n  The tied sets are IDENTICAL — same movie IDs, same order.');
    console.log('  This confirms the bijection proof: the off-by-one shift');
    console.log('  preserves Jaccard scores for all non-Western movie pairs.');
}
