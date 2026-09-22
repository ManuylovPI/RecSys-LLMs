// Cosine similarity between two numeric vectors
function cosine(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return (normA > 0 && normB > 0) ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

// Initialize the application when the window loads
window.onload = async function() {
    try {
        const resultElement = document.getElementById('result');
        resultElement.textContent = "Loading movie data...";
        resultElement.className = 'loading';

        await loadData();

        populateMoviesDropdown('movie-select');
        populateMoviesDropdown('profile-select-1');
        populateMoviesDropdown('profile-select-2');
        populateMoviesDropdown('profile-select-3');
        resultElement.textContent = "Data loaded. Please select a movie.";
        resultElement.className = 'success';
    } catch (error) {
        console.error('Initialization error:', error);
    }
};

// Populate a dropdown with sorted movie titles
function populateMoviesDropdown(selectId) {
    const selectElement = document.getElementById(selectId);

    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }

    const sortedMovies = [...movies].sort((a, b) => a.title.localeCompare(b.title));

    sortedMovies.forEach(movie => {
        const option = document.createElement('option');
        option.value = movie.id;
        option.textContent = movie.title;
        selectElement.appendChild(option);
    });
}

// Item-to-item: cosine similarity against a single selected movie, top-5
function getRecommendations() {
    const resultElement = document.getElementById('result');

    try {
        const selectElement = document.getElementById('movie-select');
        const selectedMovieId = parseInt(selectElement.value);

        if (isNaN(selectedMovieId)) {
            resultElement.textContent = "Please select a movie first.";
            resultElement.className = 'error';
            return;
        }

        const likedMovie = movies.find(movie => movie.id === selectedMovieId);
        if (!likedMovie) {
            resultElement.textContent = "Error: Selected movie not found in database.";
            resultElement.className = 'error';
            return;
        }

        resultElement.textContent = "Calculating recommendations...";
        resultElement.className = 'loading';

        setTimeout(() => {
            try {
                const candidateMovies = movies.filter(movie => movie.id !== likedMovie.id);

                const scoredMovies = candidateMovies.map(candidate => ({
                    ...candidate,
                    score: cosine(likedMovie.vector, candidate.vector)
                }));

                // Sort by score descending, then by id ascending for deterministic tie-breaking
                scoredMovies.sort((a, b) => b.score - a.score || a.id - b.id);

                const topRecommendations = scoredMovies.slice(0, 5);

                if (topRecommendations.length > 0) {
                    const lines = topRecommendations.map(
                        (m, i) => `${i + 1}. ${m.title} (score: ${m.score.toFixed(4)})`
                    );
                    resultElement.textContent =
                        `Because you liked "${likedMovie.title}", we recommend:\n${lines.join('\n')}`;
                    resultElement.className = 'success';
                } else {
                    resultElement.textContent = `No recommendations found for "${likedMovie.title}".`;
                    resultElement.className = 'error';
                }
            } catch (error) {
                console.error('Error in recommendation calculation:', error);
                resultElement.textContent = "An error occurred while calculating recommendations.";
                resultElement.className = 'error';
            }
        }, 100);
    } catch (error) {
        console.error('Error in getRecommendations:', error);
        resultElement.textContent = "An unexpected error occurred.";
        resultElement.className = 'error';
    }
}

// Profile-based: mean of 3 movie vectors, cosine against all others, top-5
function getProfileRecommendations() {
    const resultElement = document.getElementById('result');

    try {
        const ids = [1, 2, 3].map(n => {
            const v = parseInt(document.getElementById(`profile-select-${n}`).value);
            return v;
        });

        if (ids.some(isNaN)) {
            resultElement.textContent = "Please select all 3 movies first.";
            resultElement.className = 'error';
            return;
        }

        const selectedMovies = ids.map(id => movies.find(m => m.id === id));
        if (selectedMovies.some(m => !m)) {
            resultElement.textContent = "Error: One or more selected movies not found.";
            resultElement.className = 'error';
            return;
        }

        resultElement.textContent = "Calculating profile recommendations...";
        resultElement.className = 'loading';

        setTimeout(() => {
            try {
                // Build profile vector as the mean of the 3 genre vectors
                const vecLen = selectedMovies[0].vector.length;
                const profile = new Array(vecLen).fill(0);
                for (const m of selectedMovies) {
                    for (let i = 0; i < vecLen; i++) {
                        profile[i] += m.vector[i];
                    }
                }
                for (let i = 0; i < vecLen; i++) {
                    profile[i] /= selectedMovies.length;
                }

                const selectedIds = new Set(ids);
                const candidateMovies = movies.filter(m => !selectedIds.has(m.id));

                const scoredMovies = candidateMovies.map(candidate => ({
                    ...candidate,
                    score: cosine(profile, candidate.vector)
                }));

                // Sort by score descending, then by id ascending for deterministic tie-breaking
                scoredMovies.sort((a, b) => b.score - a.score || a.id - b.id);

                const topRecommendations = scoredMovies.slice(0, 5);

                if (topRecommendations.length > 0) {
                    const titles = selectedMovies.map(m => `"${m.title}"`).join(', ');
                    const lines = topRecommendations.map(
                        (m, i) => `${i + 1}. ${m.title} (score: ${m.score.toFixed(4)})`
                    );
                    resultElement.textContent =
                        `Because you liked ${titles}, we recommend:\n${lines.join('\n')}`;
                    resultElement.className = 'success';
                } else {
                    resultElement.textContent = "No recommendations found.";
                    resultElement.className = 'error';
                }
            } catch (error) {
                console.error('Error in profile recommendation calculation:', error);
                resultElement.textContent = "An error occurred while calculating recommendations.";
                resultElement.className = 'error';
            }
        }, 100);
    } catch (error) {
        console.error('Error in getProfileRecommendations:', error);
        resultElement.textContent = "An unexpected error occurred.";
        resultElement.className = 'error';
    }
}
