const fs = require('fs');
const path = require('path');

// --- Fixed parsing (19 genres including "unknown") ---
const GENRE_NAMES = [
    "unknown", "Action", "Adventure", "Animation", "Children's", "Comedy",
    "Crime", "Documentary", "Drama", "Fantasy", "Film-Noir",
    "Horror", "Musical", "Mystery", "Romance", "Sci-Fi",
    "Thriller", "War", "Western"
];

function parseItemData(text) {
    const movies = [];
    const lines = text.split('\n');
    for (const line of lines) {
        if (line.trim() === '') continue;
        const fields = line.split('|');
        if (fields.length < 24) continue;
        const id = parseInt(fields[0]);
        const title = fields[1];
        const vector = fields.slice(5, 24).map(v => parseInt(v));
        const genres = GENRE_NAMES.filter((_, i) => vector[i] === 1);
        movies.push({ id, title, genres, vector });
    }
    return movies;
}

// --- Cosine similarity ---
function cosine(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return (normA > 0 && normB > 0) ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

// --- Jaccard similarity (for comparison) ---
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
const movies = parseItemData(text);

function fmtGenres(m) {
    return m.genres.length > 0 ? `[${m.genres.join(', ')}]` : '[]';
}

// ============================================================
// 1. Top-5 item-to-item for id 225 (101 Dalmatians)
// ============================================================
console.log('='.repeat(70));
console.log('  Top-5 item-to-item for id 225');
console.log('='.repeat(70));

const target225 = movies.find(m => m.id === 225);
console.log(`\n  Target: id=${target225.id} "${target225.title}"`);
console.log(`  Vector: [${target225.vector.join(', ')}]`);
console.log(`  Genres: ${fmtGenres(target225)}\n`);

const scored225 = movies
    .filter(m => m.id !== 225)
    .map(m => ({ ...m, score: cosine(target225.vector, m.vector) }))
    .sort((a, b) => b.score - a.score || a.id - b.id);

scored225.slice(0, 5).forEach((m, i) => {
    console.log(`  ${i + 1}. id=${String(m.id).padStart(4)}  score=${m.score.toFixed(4)}  "${m.title}"`);
    console.log(`         genres: ${fmtGenres(m)}`);
});

// ============================================================
// 2. Cosine and Jaccard between id 225 and id 415
// ============================================================
console.log('\n');
console.log('='.repeat(70));
console.log('  Similarity between id 225 and id 415');
console.log('='.repeat(70));

const m225 = movies.find(m => m.id === 225);
const m415 = movies.find(m => m.id === 415);

console.log(`\n  id=225 "${m225.title}"`);
console.log(`    vector: [${m225.vector.join(', ')}]`);
console.log(`    genres: ${fmtGenres(m225)}`);
console.log(`\n  id=415 "${m415.title}"`);
console.log(`    vector: [${m415.vector.join(', ')}]`);
console.log(`    genres: ${fmtGenres(m415)}`);
console.log(`\n  cosine(225, 415)  = ${cosine(m225.vector, m415.vector).toFixed(4)}`);
console.log(`  jaccard(225, 415) = ${jaccard(m225.genres, m415.genres).toFixed(4)}`);

// ============================================================
// 3. Top-5 profile-based for ids 50, 172, 181 (Star Wars trilogy)
// ============================================================
console.log('\n');
console.log('='.repeat(70));
console.log('  Top-5 profile-based for Star Wars trilogy (50, 172, 181)');
console.log('='.repeat(70));

const trilogy = [50, 172, 181].map(id => movies.find(m => m.id === id));
trilogy.forEach(m => {
    console.log(`\n  id=${m.id} "${m.title}"`);
    console.log(`    vector: [${m.vector.join(', ')}]`);
    console.log(`    genres: ${fmtGenres(m)}`);
});

// Build profile vector (element-wise mean)
const vecLen = trilogy[0].vector.length;
const profile = new Array(vecLen).fill(0);
for (const m of trilogy) {
    for (let i = 0; i < vecLen; i++) {
        profile[i] += m.vector[i];
    }
}
for (let i = 0; i < vecLen; i++) {
    profile[i] /= trilogy.length;
}

console.log(`\n  Profile vector (mean):`);
console.log(`    [${profile.map(v => v.toFixed(4)).join(', ')}]`);

const trilogyIds = new Set(trilogy.map(m => m.id));
const scoredProfile = movies
    .filter(m => !trilogyIds.has(m.id))
    .map(m => ({ ...m, score: cosine(profile, m.vector) }))
    .sort((a, b) => b.score - a.score || a.id - b.id);

console.log(`\n  Top-5 recommendations:`);
scoredProfile.slice(0, 5).forEach((m, i) => {
    console.log(`  ${i + 1}. id=${String(m.id).padStart(4)}  score=${m.score.toFixed(4)}  "${m.title}"`);
    console.log(`         genres: ${fmtGenres(m)}`);
});
