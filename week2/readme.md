You are an expert full-stack web developer who creates robust, well-commented, and modular web applications using only vanilla HTML, CSS, and JavaScript.

Your task is to generate the complete code for a "Content-Based Movie Recommender" web application based on the detailed specifications below. The application logic will be split into two separate JavaScript files: `data.js` for data loading and parsing, and `script.js` for UI and recommendation logic. Please provide the code for each of the four files—`index.html`, `style.css`, `data.js`, and `script.js`—separately and clearly labeled.

---

### **Project Specification: Content-Based Movie Recommender (Modular)**

#### **1. Overall Goal**

Build a single-page web application that recommends movies. The application will use `data.js` to load and parse movie and rating data from local files (`u.item`, `u.data`). The `script.js` file will then use this parsed data to populate the UI and calculate content-based recommendations using **cosine similarity** on binary genre vectors. The app supports two modes: **item-to-item** (single movie selection) and **profile-based** (3-movie taste profile).

#### **2. File `index.html` - The Application Structure**

-   **DOCTYPE and Language:** The document should start with `<!DOCTYPE html>` and the `<html>` tag should specify `lang="en"`.
-   **Title:** The page title should be "Content-Based Movie Recommender".
-   **Main Heading:** Include an `<h1>` with the text "Content-Based Movie Recommender".
-   **Item-to-Item Section:**
    -   An `<h2>` with text "Item-to-Item".
    -   A `<p>` with instructions: "Select a movie you like, and we'll find the 5 most similar ones (cosine similarity on genre vectors)."
    -   A `<select>` element with the ID `movie-select`. This will be populated dynamically by JavaScript.
    -   A `<button>` with the text "Get Recommendations". When clicked, it must call `getRecommendations()`.
-   **Profile-Based Section:**
    -   An `<h2>` with text "Profile-Based".
    -   A `<p>` with instructions: "Select 3 movies to build your taste profile, then get the 5 best matches."
    -   Three `<select>` elements with IDs `profile-select-1`, `profile-select-2`, `profile-select-3`. Each will be populated dynamically.
    -   A `<button>` with the text "Get Profile Recommendations". When clicked, it must call `getProfileRecommendations()`.
-   **Result Display Area:** Include a `<div>` with the ID `result-box`. Inside this div, add a `<p>` tag with the ID `result`. This will show loading messages and the final recommendations. The result text may be multi-line (use `white-space: pre-line` in CSS).
-   **File Linking:** At the end of the `<body>`, link to **both** JavaScript files. `data.js` must be loaded **before** `script.js`.
    ```
    <script src="data.js"></script>
    <script src="script.js"></script>
    ```
-   **Running locally:** `fetch()` cannot load `u.item` / `u.data` from `file://` (browser CORS). Serve the folder over HTTP, e.g. `npx serve week2` or `python -m http.server` from `week2/`, then open the printed URL. GitHub Pages works as-is.

#### **3. File `style.css` - The Application Design**

-   **Layout:** Create a professional, modern, and user-friendly layout. All content should be centered on the page within a main container.
-   **Background:** The `<body>` should have a light, neutral background color (e.g., `#f4f7f6`).
-   **Container:** The main container holding all elements should have a white background, rounded corners (`border-radius`), and a subtle box shadow.
-   **Typography:** Use a clean, sans-serif font like 'Helvetica' or 'Arial'.
-   **Section headings (`h2`):** Centered, slightly smaller than h1, with a darker shade (e.g., `#34495e`), separated by top margin.
-   **Controls:** The `<select>` dropdowns and `<button>` should have consistent styling, with adequate padding and a clear visual hierarchy.
-   **Button:** Distinct background color (e.g., a shade of blue), white text, and a hover effect (e.g., slightly darker background).
-   **Result Area:** The `#result-box` should have padding and a light background. The `#result` text should be bold, left-aligned, and use `white-space: pre-line` so multi-line output renders correctly.

#### **4. File `data.js` - The Data Handling Module**

This file is responsible only for fetching and parsing the data from local files.

1.  **Global Variables:**
    -   Declare two global `let` variables, `movies` and `ratings`, initialized as empty arrays.

2.  **Primary Function: `loadData()`**
    -   This must be an `async` function.
    -   It will use the `fetch()` API to read `u.item` and `u.data`. Assume these files are in the same directory as `index.html`.
    -   Implement `try...catch` error handling to manage potential file loading failures. If a file fails to load, display an error message in the `#result` paragraph.
    -   Inside the `try` block, first `await` the fetch call for `u.item`, convert the response to an `ArrayBuffer`, then decode it using `new TextDecoder('iso-8859-1')` (the file is ISO-8859-1 encoded, not UTF-8). Pass the decoded text to the `parseItemData` function.
    -   Then, `await` the fetch call for `u.data`, convert it to text, and pass it to the `parseRatingData` function.

3.  **Parsing Function: `parseItemData(text)`**
    -   This function takes the raw text from `u.item` as input.
    -   It should define an array of the 19 genre names (from "unknown" to "Western").
    -   It will split the input text into individual lines. For each line, it will:
        -   Split the line by the `|` delimiter. Validate that there are at least 24 fields; skip the line otherwise.
        -   Extract the movie `id` (field 0) and `title` (field 1).
        -   Read the 19 genre binary fields (indices 5..23) into a numeric array called `vector` (e.g., `[0, 1, 0, ...]`).
        -   Derive the `genres` string array from `vector` using the genre names.
        -   Create a movie object `{ id, title, genres, vector }` and push it to the global `movies` array.

4.  **Parsing Function: `parseRatingData(text)`**
    -   This function takes the raw text from `u.data` as input.
    -   It will split the text into lines. For each line, it will:
        -   Split the line by the `\t` (tab) delimiter.
        -   Create a rating object `{ userId, itemId, rating, timestamp }` and push it to the global `ratings` array.

#### **5. File `script.js` - The UI and Logic Module**

This file handles the user interface and the recommendation logic. It will depend on the data loaded by `data.js`.

1.  **Cosine Similarity Function:**
    -   Implement a function `cosine(a, b)` that takes two numeric arrays of equal length.
    -   Formula: `dot(a, b) / (||a|| * ||b||)`. Return 0 if either vector is all zeros.

2.  **Initialization Logic:**
    -   Use `window.onload` to create an `async` function that initializes the application.
    -   Inside this function, `await` the `loadData()` function from `data.js`.
    -   After the data is successfully loaded, call `populateMoviesDropdown()` for all four `<select>` elements (`movie-select`, `profile-select-1`, `profile-select-2`, `profile-select-3`) and set an initial status message.

3.  **UI Function: `populateMoviesDropdown(selectId)`**
    -   This function takes a select element ID as its parameter.
    -   It should sort the `movies` array alphabetically by title.
    -   It will loop through the sorted movies and create an `<option>` for each, setting `value` to the movie `id` and `innerText` to the movie `title`.

4.  **Core Logic: `getRecommendations()` (Item-to-Item)**
    -   This is triggered by the "Get Recommendations" button click.
    -   **Step 1 (Get User Input):** Get the integer value from the `#movie-select` dropdown.
    -   **Step 2 (Find Liked Movie):** Find the movie object in the global `movies` array. If not found, display an error and exit.
    -   **Step 3 (Score Candidates):** For every other movie, compute `cosine(likedMovie.vector, candidate.vector)`.
    -   **Step 4 (Sort):** Sort by score descending. For ties, sort by movie `id` ascending (deterministic tie-breaking).
    -   **Step 5 (Select Top-5):** Take the first 5 results.
    -   **Step 6 (Display):** Show "Because you liked '[title]', we recommend:" followed by a numbered list of 5 movies, each with its score formatted to 4 decimal places. Set this as the `innerText` of `#result`.

5.  **Profile Logic: `getProfileRecommendations()` (Profile-Based)**
    -   This is triggered by the "Get Profile Recommendations" button click.
    -   **Step 1 (Get User Input):** Get integer values from `#profile-select-1`, `#profile-select-2`, `#profile-select-3`.
    -   **Step 2 (Build Profile):** Find all 3 movie objects. Compute the profile vector as the **element-wise mean** of their 19-dimensional genre vectors: `profile[i] = (m1[i] + m2[i] + m3[i]) / 3`.
    -   **Step 3 (Score Candidates):** For every movie NOT in the selected 3, compute `cosine(profile, candidate.vector)`.
    -   **Step 4 (Sort):** Sort by score descending, then by id ascending for ties.
    -   **Step 5 (Select Top-5):** Take the first 5 results.
    -   **Step 6 (Display):** Show "Because you liked '[title1]', '[title2]', '[title3]', we recommend:" followed by a numbered list of 5 movies with scores.

---

Please now generate the complete code for the `index.html`, `style.css`, `data.js`, and `script.js` files based on these final, detailed specifications.
