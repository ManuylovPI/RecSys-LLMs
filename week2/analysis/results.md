
# Recommender Analysis Results


## Dataset Summary

| Metric | Value |
|---|---|
| Movies | 1682 |
| Ratings | 100000 |
| Users | 943 |
| Head size (50% of ratings) | 215 movies |
| Long tail | 1467 movies |
| Catalog avg genre count | 1.72 |


## Analysis 1 — Item-to-Item (A) vs Profile (B) on Real Users

Users evaluated: 942 (each with >= 3 movies rated >= 4, using 3 most recent).
**Query set:** same users as Analysis 3b/3c. A query = most recent movie rated >= 4; B query = profile of the 3 most recent; exclusion = all movies the user rated.

| Metric | Item-to-Item (A) | Profile (B) |
|---|---|---|
| Mean overlap@5 (A ∩ B) / 5 | 0.1849 | — |
| Mean distinct genres in Top-5 | 2.43 | 3.91 |

**Slide-17 scenario:** profile = Star Wars (50), Empire (172), Toy Story (1); item-to-item = Toy Story alone.

*Item-to-item (Toy Story alone):*
| # | ID | Title | Score | Genres |
|---|---|---|---|---|
| 1 | 422 | Aladdin and the King of Thieves (1996) | 1.0000 | Animation, Children's, Comedy |
| 2 | 95 | Aladdin (1992) | 0.8660 | Animation, Children's, Comedy, Musical |
| 3 | 1219 | Goofy Movie, A (1995) | 0.8660 | Animation, Children's, Comedy, Romance |
| 4 | 63 | Santa Clause, The (1994) | 0.8165 | Children's, Comedy |
| 5 | 94 | Home Alone (1990) | 0.8165 | Children's, Comedy |

*Profile (mean of 50, 172, 1):*
| # | ID | Title | Score | Genres |
|---|---|---|---|---|
| 1 | 181 | Return of the Jedi (1983) | 0.9129 | Action, Adventure, Romance, Sci-Fi, War |
| 2 | 271 | Starship Troopers (1997) | 0.8165 | Action, Adventure, Sci-Fi, War |
| 3 | 498 | African Queen, The (1951) | 0.8165 | Action, Adventure, Romance, War |
| 4 | 110 | Operation Dumbo Drop (1995) | 0.7144 | Action, Adventure, Comedy, War |
| 5 | 173 | Princess Bride, The (1987) | 0.7144 | Action, Adventure, Comedy, Romance |


## Analysis 2 — Bias Mitigation: Cosine (A) vs Dot Product (C)

**Query set:** all 1682 movies as queries (exclusion: the query itself); Top-5 each; ties broken by id ascending.

| Metric | Cosine (A) | Dot Product (C) | Catalog Reference |
|---|---|---|---|
| Mean genre count of recommended movies | 1.695 | 2.839 | 1.720 |
| Mean popularity of recommended movies | 117.82 | 167.87 | 59.45 |

**Strict inversion example (largest cosine gap over all query/candidate pairs):**

Constraints: `dot(q,X) > dot(q,Y)` AND `cos(q,X) < cos(q,Y)` AND `genreCount(X) > genreCount(Y)`.

| Role | ID | Title | Genres | Genre count | Vector norm | Dot(q,v) | Cos(q,v) |
|---|---|---|---|---|---|---|---|
| Query q | 7 | Twelve Monkeys (1995) | Drama, Sci-Fi | 2 | 1.4142 | — | — |
| X (dot prefers) | 172 | Empire Strikes Back, The (1980) | Action, Adventure, Drama, Romance, Sci-Fi, War | 6 | 2.4495 | 2.0000 | 0.5774 |
| Y (cosine prefers) | 6 | Shanghai Triad (Yao a yao yao dao waipo qiao) (1995) | Drama | 1 | 1.0000 | 1.0000 | 0.7071 |

Hand-checkable numbers:

- Vectors (19 genre flags, index order = GENRE_NAMES):
  - q  = `[0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]`  (ones at: 8, 15)
  - X  = `[0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0]`  (ones at: 1, 2, 8, 14, 15, 17)
  - Y  = `[0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]`  (ones at: 8)
- dot(q,X) = 2 = |q| * |X| * cos(q,X) = 1.414214 * 2.449490 * 0.577350 = 2.000000
- dot(q,Y) = 1 = |q| * |Y| * cos(q,Y) = 1.414214 * 1.000000 * 0.707107 = 1.000000
- Strict: dot(q,X)=2 > dot(q,Y)=1: **true**; cos(q,X)=0.577350 < cos(q,Y)=0.707107: **true**; genreCount(X)=6 > genreCount(Y)=1: **true**
- Cosine gap = cos(q,Y) − cos(q,X) = 0.707107 − 0.577350 = **0.129757** (largest over all strict triples)


## Analysis 3 — Catalog Discovery

**Table 3a — Query set: all 1682 movies, id-ascending tie-break** (exclusion: the query itself). A and C only; B omitted because it requires user profiles and is not comparable on this query set.

| Metric | Cosine (A) | Dot Product (C) |
|---|---|---|
| Catalog coverage | 0.3317 | 0.1807 |
| Long-tail share in Top-5 | 0.6859 | 0.4952 |
| Mean popularity of recs | 117.82 | 167.87 |

**Table 3b — Query set: 942 users, id-ascending tie-break (same users, same exclusions for A, B, C).** A and C query = the user's most recent movie rated >= 4; B query = profile of the 3 most recent movies rated >= 4; exclusion = all movies the user rated.

| Metric | Cosine (A) | Profile (B) | Dot Product (C) |
|---|---|---|---|
| Catalog coverage | 0.3543 | 0.3109 | 0.2218 |
| Long-tail share in Top-5 | 0.7076 | 0.7108 | 0.5938 |
| Mean popularity of recs | 108.19 | 113.65 | 142.33 |

**Table 3c — Query set: 942 users, random tie-break (seed 42; same users/exclusions as Table 3b).**

| Metric | Cosine (A) | Profile (B) | Dot Product (C) |
|---|---|---|---|
| Catalog coverage | 0.3127 | 0.2747 | 0.2146 |
| Long-tail share in Top-5 | 0.8363 | 0.8350 | 0.7790 |
| Mean popularity of recs | 64.78 | 73.22 | 79.75 |

**Why id-ascending tie-breaking inflates popularity:** mean rating count by id range.

| ID range | n movies | Mean popularity (rating count) |
|---|---|---|
| id <= 400 | 400 | 140.22 |
| id > 800 | 882 | 16.39 |
| ratio (id<=400 / id>800) | — | 8.55x |

We observe this correlation but did not verify its cause.
On score ties, ascending-id order therefore favours more popular movies (see Tables 4a/4b).


## Analysis 4 — Tie-Breaking Confound (random seed 42 vs id-ascending)

**Table 4a — Query set: all 1682 movies** (same as Table 3a), ties broken by seeded random keys vs id ascending.

| Metric | Cosine (A) id | Cosine (A) rnd | Dot (C) id | Dot (C) rnd |
|---|---|---|---|---|
| Catalog coverage | 0.3317 | 0.3306 | 0.1807 | 0.2021 |
| Long-tail share | 0.6859 | 0.8736 | 0.4952 | 0.7830 |
| Mean popularity | 117.82 | 57.91 | 167.87 | 78.72 |

**Table 4b — Query set: 942 users** (same as Tables 3b/3c side-by-side), ties broken by seeded random keys vs id ascending.

| Metric | Cosine (A) id | Cosine (A) rnd | Profile (B) id | Profile (B) rnd | Dot (C) id | Dot (C) rnd |
|---|---|---|---|---|---|---|
| Catalog coverage | 0.3543 | 0.3127 | 0.3109 | 0.2747 | 0.2218 | 0.2146 |
| Long-tail share | 0.7076 | 0.8363 | 0.7108 | 0.8350 | 0.5938 | 0.7790 |
| Mean popularity | 108.19 | 64.78 | 113.65 | 73.22 | 142.33 | 79.75 |

**Delta (random − id), all-movies query set:**

| Metric | Cosine (A) | Dot Product (C) |
|---|---|---|
| Coverage | -0.0012 | 0.0214 |
| Long-tail share | 0.1878 | 0.2878 |
| Mean popularity | -59.91 | -89.15 |

**Delta (random − id), user-based query set:**

| Metric | Cosine (A) | Profile (B) | Dot Product (C) |
|---|---|---|---|
| Coverage | -0.0416 | -0.0363 | -0.0071 |
| Long-tail share | 0.1287 | 0.1242 | 0.1851 |
| Mean popularity | -43.41 | -40.42 | -62.59 |
