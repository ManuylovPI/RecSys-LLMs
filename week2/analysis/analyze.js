const fs = require('fs');
const path = require('path');

// ---------- Seeded PRNG (mulberry32) ----------
function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---------- Parsing (same as data.js) ----------
const GENRE_NAMES = [
    'unknown', 'Action', 'Adventure', "Animation", "Children's", 'Comedy',
    'Crime', 'Documentary', 'Drama', 'Fantasy', 'Film-Noir',
    'Horror', 'Musical', 'Mystery', 'Romance', 'Sci-Fi',
    'Thriller', 'War', 'Western'
];

function parseItemData(text) {
    const movies = [];
    for (const line of text.split('\n')) {
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

function parseRatingData(text) {
    const ratings = [];
    for (const line of text.split('\n')) {
        if (line.trim() === '') continue;
        const fields = line.split('\t');
        if (fields.length < 4) continue;
        ratings.push({
            userId: parseInt(fields[0]),
            itemId: parseInt(fields[1]),
            rating: parseFloat(fields[2]),
            timestamp: parseInt(fields[3])
        });
    }
    return ratings;
}

// ---------- Similarity ----------
function cosine(a, b) {
    let dotAB = 0, nA = 0, nB = 0;
    for (let i = 0; i < a.length; i++) {
        dotAB += a[i] * b[i];
        nA += a[i] * a[i];
        nB += b[i] * b[i];
    }
    return nA > 0 && nB > 0 ? dotAB / (Math.sqrt(nA) * Math.sqrt(nB)) : 0;
}

function dotProduct(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
}

function genreCount(m) {
    return m.vector.reduce((x, y) => x + y, 0);
}

// ---------- Top-k with tie-breaking ----------
// mode: 'id' => ascending id for ties; 'random' => ascending seeded-random key for ties
function topK(scoreFn, queryVec, candidates, excludeIds, k, mode, randomKeys) {
    const scored = [];
    for (const m of candidates) {
        if (excludeIds && excludeIds.has(m.id)) continue;
        scored.push({ id: m.id, movie: m, score: scoreFn(queryVec, m.vector) });
    }
    if (mode === 'random') {
        scored.sort((a, b) => b.score - a.score || randomKeys.get(a.id) - randomKeys.get(b.id));
    } else {
        scored.sort((a, b) => b.score - a.score || a.id - b.id);
    }
    return scored.slice(0, k);
}

// ---------- Load data ----------
const itemPath = path.join(__dirname, '..', 'u.item');
const dataPath = path.join(__dirname, '..', 'u.data');
const movies = parseItemData(fs.readFileSync(itemPath, 'latin1'));
const ratings = parseRatingData(fs.readFileSync(dataPath, 'latin1'));
const movieById = new Map(movies.map(m => [m.id, m]));
const NUM_MOVIES = movies.length;

// ---------- Popularity & head / long-tail ----------
const popularity = new Map();
for (const m of movies) popularity.set(m.id, 0);
for (const r of ratings) popularity.set(r.itemId, (popularity.get(r.itemId) || 0) + 1);

const totalRatings = ratings.length;
const byPop = [...movies].sort((a, b) => popularity.get(b.id) - popularity.get(a.id));
let cum = 0;
const headIds = new Set();
for (const m of byPop) {
    if (cum >= totalRatings * 0.5) break;
    headIds.add(m.id);
    cum += popularity.get(m.id);
}
const headSize = headIds.size;
const longTailIds = new Set(movies.filter(m => !headIds.has(m.id)).map(m => m.id));

// ---------- Random keys (seed 42) ----------
const rng = mulberry32(42);
const randomKeys = new Map();
for (const m of movies) randomKeys.set(m.id, rng());

// ---------- User profiles ----------
const byUser = new Map();
for (const r of ratings) {
    if (!byUser.has(r.userId)) byUser.set(r.userId, []);
    byUser.get(r.userId).push(r);
}

const userProfiles = [];
for (const [userId, rs] of byUser) {
    const good = rs.filter(r => r.rating >= 4).sort((a, b) => b.timestamp - a.timestamp);
    if (good.length >= 3) {
        userProfiles.push({
            userId,
            items: good.slice(0, 3).map(r => r.itemId),
            rated: new Set(rs.map(r => r.itemId))
        });
    }
}

function meanProfile(ids) {
    const v = new Array(19).fill(0);
    for (const id of ids) {
        const vec = movieById.get(id).vector;
        for (let i = 0; i < 19; i++) v[i] += vec[i];
    }
    for (let i = 0; i < 19; i++) v[i] /= ids.length;
    return v;
}

// ============================================================
// ANALYSIS 1 — item-to-item (A) vs profile (B) on real users
// ============================================================
let sumOverlap = 0;
let sumDivA = 0;
let sumDivB = 0;
let nUsers = 0;

for (const p of userProfiles) {
    const seedVec = movieById.get(p.items[0]).vector;
    const profVec = meanProfile(p.items);

    const topA = topK(cosine, seedVec, movies, p.rated, 5, 'id', randomKeys);
    const topB = topK(cosine, profVec, movies, p.rated, 5, 'id', randomKeys);

    const idsA = new Set(topA.map(x => x.id));
    const idsB = new Set(topB.map(x => x.id));
    let ov = 0;
    for (const id of idsA) if (idsB.has(id)) ov++;
    sumOverlap += ov / 5;

    const gA = new Set();
    for (const x of topA) for (const g of x.movie.genres) gA.add(g);
    const gB = new Set();
    for (const x of topB) for (const g of x.movie.genres) gB.add(g);
    sumDivA += gA.size;
    sumDivB += gB.size;
    nUsers++;
}

const a1_meanOverlap = sumOverlap / nUsers;
const a1_meanDivA = sumDivA / nUsers;
const a1_meanDivB = sumDivB / nUsers;

// Slide-17 scenario: profile = 50, 172, 1 vs item-to-item on 1 (Toy Story)
const slideProfileIds = [50, 172, 1];
const slideExclude = new Set(slideProfileIds);
const slideProfVec = meanProfile(slideProfileIds);
const slideTopB = topK(cosine, slideProfVec, movies, slideExclude, 5, 'id', randomKeys);
const slideTopA = topK(cosine, movieById.get(1).vector, movies, new Set([1]), 5, 'id', randomKeys);

// ============================================================
// ANALYSIS 2 — bias mitigation: A (cosine) vs C (dot product)
// ============================================================
let sumGenresA = 0, sumGenresC = 0;
let sumPopA = 0, sumPopC = 0;
let nRecsA = 0, nRecsC = 0;

for (const q of movies) {
    const ex = new Set([q.id]);
    const topA = topK(cosine, q.vector, movies, ex, 5, 'id', randomKeys);
    const topC = topK(dotProduct, q.vector, movies, ex, 5, 'id', randomKeys);

    for (const x of topA) { sumGenresA += genreCount(x.movie); sumPopA += popularity.get(x.id); nRecsA++; }
    for (const x of topC) { sumGenresC += genreCount(x.movie); sumPopC += popularity.get(x.id); nRecsC++; }
}

// STRICT inversion: dot(q,X) > dot(q,Y) AND cos(q,X) < cos(q,Y) AND genreCount(X) > genreCount(Y).
// Among all such (q,X,Y), pick the one with the largest cosine gap cos(q,Y) - cos(q,X).
function findStrictExample() {
    let best = null;
    const n = movies.length;
    const cosArr = new Float64Array(n);
    const dotArr = new Float64Array(n);
    const genArr = new Int32Array(n);
    const idxByCos = new Int32Array(n);

    for (let qi = 0; qi < n; qi++) {
        const q = movies[qi].vector;
        let qn = 0;
        for (let t = 0; t < 19; t++) qn += q[t] * q[t];
        qn = Math.sqrt(qn);
        if (qn === 0) continue;

        let m = 0;
        for (let ci = 0; ci < n; ci++) {
            if (ci === qi) continue;
            const v = movies[ci].vector;
            let d = 0, vn = 0;
            for (let t = 0; t < 19; t++) { d += q[t] * v[t]; vn += v[t] * v[t]; }
            if (vn === 0) continue;
            cosArr[m] = d / (qn * Math.sqrt(vn));
            dotArr[m] = d;
            genArr[m] = movies[ci].vector.reduce((a, b) => a + b, 0);
            idxByCos[m] = ci;
            m++;
        }

        // Sort candidate indices by cos ascending so X (lower cos) always has smaller index than Y.
        const order = Array.from({ length: m }, (_, i) => i);
        order.sort((a, b) => cosArr[a] - cosArr[b]);

        for (let yi = 1; yi < m; yi++) {
            const Y = order[yi];
            const cosY = cosArr[Y];
            for (let xi = 0; xi < yi; xi++) {
                const X = order[xi];
                if (cosArr[X] >= cosY) continue;
                if (dotArr[X] <= dotArr[Y]) continue;
                if (genArr[X] <= genArr[Y]) continue;
                const gap = cosY - cosArr[X];
                if (!best || gap > best.gap) {
                    best = {
                        gap,
                        query: movies[qi],
                        X: movies[idxByCos[X]],
                        Y: movies[idxByCos[Y]],
                        cosX: cosArr[X],
                        cosY: cosY,
                        dotX: dotArr[X],
                        dotY: dotArr[Y]
                    };
                }
            }
        }
    }
    return best;
}

const strictExample = findStrictExample();

const a2_meanGenresA = sumGenresA / nRecsA;
const a2_meanGenresC = sumGenresC / nRecsC;
const a2_meanPopA = sumPopA / nRecsA;
const a2_meanPopC = sumPopC / nRecsC;
const a2_catalogGenreAvg = movies.reduce((s, m) => s + genreCount(m), 0) / NUM_MOVIES;

// ---------- Id-range popularity (explains id-ascending tie-break bias) ----------
const le400 = movies.filter(m => m.id <= 400);
const gt800 = movies.filter(m => m.id > 800);
const meanPop = arr => arr.reduce((s, m) => s + popularity.get(m.id), 0) / arr.length;
const a3_meanPopLe400 = meanPop(le400);
const a3_meanPopGt800 = meanPop(gt800);
const a3_nLe400 = le400.length;
const a3_nGt800 = gt800.length;

// ============================================================
// ANALYSIS 3 — catalog discovery (A, B, C) with id-ascending ties
// ============================================================
function catalogStats(allTops) {
    const all = [];
    for (const t of allTops) for (const x of t) all.push(x);
    const distinct = new Set(all.map(x => x.id));
    const lt = all.filter(x => longTailIds.has(x.id)).length;
    const pop = all.reduce((s, x) => s + popularity.get(x.id), 0);
    return {
        coverage: distinct.size / NUM_MOVIES,
        ltShare: lt / all.length,
        meanPop: pop / all.length
    };
}

// All-movies query set: A & C only (comparable; B omitted — needs user profiles)
function runAllMovies(mode) {
    const topsA = [], topsC = [];
    for (const q of movies) {
        const ex = new Set([q.id]);
        topsA.push(topK(cosine, q.vector, movies, ex, 5, mode, randomKeys));
        topsC.push(topK(dotProduct, q.vector, movies, ex, 5, mode, randomKeys));
    }
    return { A: catalogStats(topsA), C: catalogStats(topsC) };
}

// User-based query set: SAME users, SAME exclusions for A, B, C.
// A & C query = most recent movie rated >= 4; B query = profile of 3 most recent.
// Exclusion = all movies the user rated.
function runUserBased(mode) {
    const topsA = [], topsB = [], topsC = [];
    for (const p of userProfiles) {
        const seedVec = movieById.get(p.items[0]).vector;
        const profVec = meanProfile(p.items);
        topsA.push(topK(cosine, seedVec, movies, p.rated, 5, mode, randomKeys));
        topsB.push(topK(cosine, profVec, movies, p.rated, 5, mode, randomKeys));
        topsC.push(topK(dotProduct, seedVec, movies, p.rated, 5, mode, randomKeys));
    }
    return { A: catalogStats(topsA), B: catalogStats(topsB), C: catalogStats(topsC) };
}

const r3_movies = runAllMovies('id');
const r3_users = runUserBased('id');

// ============================================================
// ANALYSIS 4 — tie-breaking confound: repeat 3 with random ties
// ============================================================
const r4_movies = runAllMovies('random');
const r4_users = runUserBased('random');

// ============================================================
// FORMAT OUTPUT
// ============================================================
const lines = [];
function h(level, text) { lines.push('', '#'.repeat(level) + ' ' + text, ''); }
function table(headers, rows) {
    lines.push('| ' + headers.join(' | ') + ' |');
    lines.push('|' + headers.map(() => '---').join('|') + '|');
    for (const r of rows) lines.push('| ' + r.join(' | ') + ' |');
    lines.push('');
}
function p(text) { lines.push(text); }
function fmt(n, d = 4) { return n.toFixed(d); }

h(1, 'Recommender Analysis Results');

h(2, 'Dataset Summary');
table(['Metric', 'Value'], [
    ['Movies', String(NUM_MOVIES)],
    ['Ratings', String(totalRatings)],
    ['Users', String(byUser.size)],
    ['Head size (50% of ratings)', `${headSize} movies`],
    ['Long tail', `${NUM_MOVIES - headSize} movies`],
    ['Catalog avg genre count', fmt(a2_catalogGenreAvg, 2)]
]);

h(2, 'Analysis 1 — Item-to-Item (A) vs Profile (B) on Real Users');
p(`Users evaluated: ${nUsers} (each with >= 3 movies rated >= 4, using 3 most recent).`);
p('**Query set:** same users as Analysis 3b/3c. A query = most recent movie rated >= 4; B query = profile of the 3 most recent; exclusion = all movies the user rated.');
p('');
table(['Metric', 'Item-to-Item (A)', 'Profile (B)'], [
    ['Mean overlap@5 (A \u2229 B) / 5', fmt(a1_meanOverlap), '\u2014'],
    ['Mean distinct genres in Top-5', fmt(a1_meanDivA, 2), fmt(a1_meanDivB, 2)]
]);

p('**Slide-17 scenario:** profile = Star Wars (50), Empire (172), Toy Story (1); item-to-item = Toy Story alone.');
p('');
p('*Item-to-item (Toy Story alone):*');
table(['#', 'ID', 'Title', 'Score', 'Genres'], slideTopA.map((x, i) =>
    [String(i + 1), String(x.id), x.movie.title, fmt(x.score), x.movie.genres.join(', ')]
));
p('*Profile (mean of 50, 172, 1):*');
table(['#', 'ID', 'Title', 'Score', 'Genres'], slideTopB.map((x, i) =>
    [String(i + 1), String(x.id), x.movie.title, fmt(x.score), x.movie.genres.join(', ')]
));

h(2, 'Analysis 2 — Bias Mitigation: Cosine (A) vs Dot Product (C)');
p('**Query set:** all 1682 movies as queries (exclusion: the query itself); Top-5 each; ties broken by id ascending.');
p('');
table(['Metric', 'Cosine (A)', 'Dot Product (C)', 'Catalog Reference'], [
    ['Mean genre count of recommended movies', fmt(a2_meanGenresA, 3), fmt(a2_meanGenresC, 3), fmt(a2_catalogGenreAvg, 3)],
    ['Mean popularity of recommended movies', fmt(a2_meanPopA, 2), fmt(a2_meanPopC, 2), fmt(totalRatings / NUM_MOVIES, 2)]
]);

if (strictExample) {
    const e = strictExample;
    const qv = e.query.vector, xv = e.X.vector, yv = e.Y.vector;
    const qn = Math.sqrt(qv.reduce((s, b) => s + b * b, 0));
    const xn = Math.sqrt(xv.reduce((s, b) => s + b * b, 0));
    const yn = Math.sqrt(yv.reduce((s, b) => s + b * b, 0));
    const qGen = genreCount(e.query), xGen = genreCount(e.X), yGen = genreCount(e.Y);
    p('**Strict inversion example (largest cosine gap over all query/candidate pairs):**');
    p('');
    p('Constraints: `dot(q,X) > dot(q,Y)` AND `cos(q,X) < cos(q,Y)` AND `genreCount(X) > genreCount(Y)`.');
    p('');
    table(['Role', 'ID', 'Title', 'Genres', 'Genre count', 'Vector norm', 'Dot(q,v)', 'Cos(q,v)'], [
        ['Query q', String(e.query.id), e.query.title, e.query.genres.join(', '), String(qGen), fmt(qn, 4), '\u2014', '\u2014'],
        ['X (dot prefers)', String(e.X.id), e.X.title, e.X.genres.join(', '), String(xGen), fmt(xn, 4), fmt(e.dotX), fmt(e.cosX)],
        ['Y (cosine prefers)', String(e.Y.id), e.Y.title, e.Y.genres.join(', '), String(yGen), fmt(yn, 4), fmt(e.dotY), fmt(e.cosY)]
    ]);
    p('Hand-checkable numbers:');
    p('');
    p(`- Vectors (19 genre flags, index order = GENRE_NAMES):`);
    p(`  - q  = \`[${qv.join(', ')}]\`  (ones at: ${qv.map((b, i) => b ? i : null).filter(v => v !== null).join(', ')})`);
    p(`  - X  = \`[${xv.join(', ')}]\`  (ones at: ${xv.map((b, i) => b ? i : null).filter(v => v !== null).join(', ')})`);
    p(`  - Y  = \`[${yv.join(', ')}]\`  (ones at: ${yv.map((b, i) => b ? i : null).filter(v => v !== null).join(', ')})`);
    p(`- dot(q,X) = ${e.dotX} = |q| * |X| * cos(q,X) = ${fmt(qn, 6)} * ${fmt(xn, 6)} * ${fmt(e.cosX, 6)} = ${fmt(qn * xn * e.cosX, 6)}`);
    p(`- dot(q,Y) = ${e.dotY} = |q| * |Y| * cos(q,Y) = ${fmt(qn, 6)} * ${fmt(yn, 6)} * ${fmt(e.cosY, 6)} = ${fmt(qn * yn * e.cosY, 6)}`);
    p(`- Strict: dot(q,X)=${e.dotX} > dot(q,Y)=${e.dotY}: **${e.dotX > e.dotY}**; cos(q,X)=${fmt(e.cosX, 6)} < cos(q,Y)=${fmt(e.cosY, 6)}: **${e.cosX < e.cosY}**; genreCount(X)=${xGen} > genreCount(Y)=${yGen}: **${xGen > yGen}**`);
    p(`- Cosine gap = cos(q,Y) − cos(q,X) = ${fmt(e.cosY, 6)} − ${fmt(e.cosX, 6)} = **${fmt(e.gap, 6)}** (largest over all strict triples)`);
    p('');
} else {
    p('No strict inversion found (dot higher AND cosine lower AND more genres).');
    p('');
}

h(2, 'Analysis 3 — Catalog Discovery');

p('**Table 3a — Query set: all 1682 movies, id-ascending tie-break** (exclusion: the query itself). A and C only; B omitted because it requires user profiles and is not comparable on this query set.');
p('');
table(['Metric', 'Cosine (A)', 'Dot Product (C)'], [
    ['Catalog coverage', fmt(r3_movies.A.coverage), fmt(r3_movies.C.coverage)],
    ['Long-tail share in Top-5', fmt(r3_movies.A.ltShare), fmt(r3_movies.C.ltShare)],
    ['Mean popularity of recs', fmt(r3_movies.A.meanPop, 2), fmt(r3_movies.C.meanPop, 2)]
]);

p(`**Table 3b — Query set: ${nUsers} users, id-ascending tie-break (same users, same exclusions for A, B, C).** A and C query = the user's most recent movie rated >= 4; B query = profile of the 3 most recent movies rated >= 4; exclusion = all movies the user rated.`);
p('');
table(['Metric', 'Cosine (A)', 'Profile (B)', 'Dot Product (C)'], [
    ['Catalog coverage', fmt(r3_users.A.coverage), fmt(r3_users.B.coverage), fmt(r3_users.C.coverage)],
    ['Long-tail share in Top-5', fmt(r3_users.A.ltShare), fmt(r3_users.B.ltShare), fmt(r3_users.C.ltShare)],
    ['Mean popularity of recs', fmt(r3_users.A.meanPop, 2), fmt(r3_users.B.meanPop, 2), fmt(r3_users.C.meanPop, 2)]
]);

p(`**Table 3c — Query set: ${nUsers} users, random tie-break (seed 42; same users/exclusions as Table 3b).**`);
p('');
table(['Metric', 'Cosine (A)', 'Profile (B)', 'Dot Product (C)'], [
    ['Catalog coverage', fmt(r4_users.A.coverage), fmt(r4_users.B.coverage), fmt(r4_users.C.coverage)],
    ['Long-tail share in Top-5', fmt(r4_users.A.ltShare), fmt(r4_users.B.ltShare), fmt(r4_users.C.ltShare)],
    ['Mean popularity of recs', fmt(r4_users.A.meanPop, 2), fmt(r4_users.B.meanPop, 2), fmt(r4_users.C.meanPop, 2)]
]);

p('**Why id-ascending tie-breaking inflates popularity:** mean rating count by id range.');
p('');
table(['ID range', 'n movies', 'Mean popularity (rating count)'], [
    ['id <= 400', String(a3_nLe400), fmt(a3_meanPopLe400, 2)],
    ['id > 800', String(a3_nGt800), fmt(a3_meanPopGt800, 2)],
    ['ratio (id<=400 / id>800)', '\u2014', fmt(a3_meanPopLe400 / a3_meanPopGt800, 2) + 'x']
]);
p('We observe this correlation but did not verify its cause.');
p('On score ties, ascending-id order therefore favours more popular movies (see Tables 4a/4b).');
p('');

h(2, 'Analysis 4 — Tie-Breaking Confound (random seed 42 vs id-ascending)');

p('**Table 4a — Query set: all 1682 movies** (same as Table 3a), ties broken by seeded random keys vs id ascending.');
p('');
table(['Metric', 'Cosine (A) id', 'Cosine (A) rnd', 'Dot (C) id', 'Dot (C) rnd'], [
    ['Catalog coverage', fmt(r3_movies.A.coverage), fmt(r4_movies.A.coverage), fmt(r3_movies.C.coverage), fmt(r4_movies.C.coverage)],
    ['Long-tail share', fmt(r3_movies.A.ltShare), fmt(r4_movies.A.ltShare), fmt(r3_movies.C.ltShare), fmt(r4_movies.C.ltShare)],
    ['Mean popularity', fmt(r3_movies.A.meanPop, 2), fmt(r4_movies.A.meanPop, 2), fmt(r3_movies.C.meanPop, 2), fmt(r4_movies.C.meanPop, 2)]
]);

p(`**Table 4b — Query set: ${nUsers} users** (same as Tables 3b/3c side-by-side), ties broken by seeded random keys vs id ascending.`);
p('');
table(['Metric', 'Cosine (A) id', 'Cosine (A) rnd', 'Profile (B) id', 'Profile (B) rnd', 'Dot (C) id', 'Dot (C) rnd'], [
    ['Catalog coverage', fmt(r3_users.A.coverage), fmt(r4_users.A.coverage), fmt(r3_users.B.coverage), fmt(r4_users.B.coverage), fmt(r3_users.C.coverage), fmt(r4_users.C.coverage)],
    ['Long-tail share', fmt(r3_users.A.ltShare), fmt(r4_users.A.ltShare), fmt(r3_users.B.ltShare), fmt(r4_users.B.ltShare), fmt(r3_users.C.ltShare), fmt(r4_users.C.ltShare)],
    ['Mean popularity', fmt(r3_users.A.meanPop, 2), fmt(r4_users.A.meanPop, 2), fmt(r3_users.B.meanPop, 2), fmt(r4_users.B.meanPop, 2), fmt(r3_users.C.meanPop, 2), fmt(r4_users.C.meanPop, 2)]
]);

p('**Delta (random \u2212 id), all-movies query set:**');
p('');
table(['Metric', 'Cosine (A)', 'Dot Product (C)'], [
    ['Coverage', fmt(r4_movies.A.coverage - r3_movies.A.coverage), fmt(r4_movies.C.coverage - r3_movies.C.coverage)],
    ['Long-tail share', fmt(r4_movies.A.ltShare - r3_movies.A.ltShare), fmt(r4_movies.C.ltShare - r3_movies.C.ltShare)],
    ['Mean popularity', fmt(r4_movies.A.meanPop - r3_movies.A.meanPop, 2), fmt(r4_movies.C.meanPop - r3_movies.C.meanPop, 2)]
]);

p(`**Delta (random \u2212 id), user-based query set:**`);
p('');
table(['Metric', 'Cosine (A)', 'Profile (B)', 'Dot Product (C)'], [
    ['Coverage', fmt(r4_users.A.coverage - r3_users.A.coverage), fmt(r4_users.B.coverage - r3_users.B.coverage), fmt(r4_users.C.coverage - r3_users.C.coverage)],
    ['Long-tail share', fmt(r4_users.A.ltShare - r3_users.A.ltShare), fmt(r4_users.B.ltShare - r3_users.B.ltShare), fmt(r4_users.C.ltShare - r3_users.C.ltShare)],
    ['Mean popularity', fmt(r4_users.A.meanPop - r3_users.A.meanPop, 2), fmt(r4_users.B.meanPop - r3_users.B.meanPop, 2), fmt(r4_users.C.meanPop - r3_users.C.meanPop, 2)]
]);

// ---------- Write file ----------
const outPath = path.join(__dirname, 'results.md');
fs.writeFileSync(outPath, lines.join('\n'), 'utf8');

// ---------- Print ----------
console.log(lines.join('\n'));
console.log(`\nWritten to ${outPath}`);
