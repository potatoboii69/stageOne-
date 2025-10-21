require('dotenv').config();

const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/**
 * In-memory store
 */
const strings = [];

/**
 * Analyze a string and return computed properties
 */
function analyzeString(value) {
  const length = value.length;
  const is_palindrome =
    value.toLowerCase() === value.toLowerCase().split('').reverse().join('');
  const unique_characters = new Set(value).size;
  const word_count = value.trim().split(/\s+/).filter(Boolean).length;
  const sha256_hash = crypto.createHash('sha256').update(value).digest('hex');

  const character_frequency_map = {};
  for (const char of value) {
    character_frequency_map[char] = (character_frequency_map[char] || 0) + 1;
  }

  return {
    id: sha256_hash,
    value: value,
    properties: {
      length,
      is_palindrome,
      unique_characters,
      word_count,
      sha256_hash,
      character_frequency_map,
    },
    created_at: new Date().toISOString(),
  };
}

/**
 * 1️⃣ Create / Analyze String
 */
app.post('/strings', (req, res) => {
  const { value } = req.body;

  // Validation
  if (value === undefined) {
    return res.status(400).json({ error: 'Missing "value" field' });
  }

  if (typeof value !== 'string') {
    return res.status(422).json({ error: '"value" must be a string' });
  }

  const exists = strings.find((item) => item.value === value);
  if (exists) {
    return res.status(409).json({ error: 'String already exists in the system' });
  }

  const analyzed = analyzeString(value);
  strings.push(analyzed);

  return res.status(201).json(analyzed);
});

/**
 * 2️⃣ Get Specific String
 */
app.get('/strings/:string_value', (req, res) => {
  const { string_value } = req.params;
  const found = strings.find((item) => item.value === string_value);

  if (!found) {
    return res.status(404).json({ error: 'String does not exist in the system' });
  }

  return res.status(200).json(found);
});

/**
 * 3️⃣ Get All Strings with Filtering
 */
app.get('/strings', (req, res) => {
  if (strings.length === 0) {
    return res.status(200).json({
      data: [],
      count: 0,
      filters_applied: {},
      message: 'No records yet',
    });
  }

  let results = [...strings];
  const {
    is_palindrome,
    min_length,
    max_length,
    word_count,
    contains_character,
  } = req.query;

  const filters_applied = {};

  // Validate query types
  if (is_palindrome && !['true', 'false'].includes(is_palindrome)) {
    return res.status(400).json({
      error: 'Invalid query parameter: is_palindrome must be true or false',
    });
  }

  if (min_length && isNaN(parseInt(min_length))) {
    return res.status(400).json({
      error: 'Invalid query parameter: min_length must be an integer',
    });
  }

  if (max_length && isNaN(parseInt(max_length))) {
    return res.status(400).json({
      error: 'Invalid query parameter: max_length must be an integer',
    });
  }

  if (word_count && isNaN(parseInt(word_count))) {
    return res.status(400).json({
      error: 'Invalid query parameter: word_count must be an integer',
    });
  }

  // Filtering logic
  if (is_palindrome !== undefined) {
    const boolValue = is_palindrome === 'true';
    results = results.filter(
      (item) => item.properties.is_palindrome === boolValue
    );
    filters_applied.is_palindrome = boolValue;
  }

  if (min_length !== undefined) {
    const min = parseInt(min_length);
    results = results.filter((item) => item.properties.length >= min);
    filters_applied.min_length = min;
  }

  if (max_length !== undefined) {
    const max = parseInt(max_length);
    results = results.filter((item) => item.properties.length <= max);
    filters_applied.max_length = max;
  }

  if (word_count !== undefined) {
    const wc = parseInt(word_count);
    results = results.filter((item) => item.properties.word_count === wc);
    filters_applied.word_count = wc;
  }

  if (contains_character !== undefined) {
    if (contains_character.length !== 1) {
      return res.status(400).json({
        error: 'contains_character must be a single character',
      });
    }

    const char = contains_character.toLowerCase();
    results = results.filter((item) =>
      item.value.toLowerCase().includes(char)
    );
    filters_applied.contains_character = char;
  }

  return res.status(200).json({
    data: results,
    count: results.length,
    filters_applied,
  });
});

/**
 * 4️⃣ Natural Language Filtering
 */
app.get('/strings/filter-by-natural-language', (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing "query" parameter' });
  }

  let results = [...strings];
  const lowerQuery = query.toLowerCase();
  const parsed_filters = {};

  // Handle examples
  if (lowerQuery.includes('palindrome')) {
    results = results.filter((item) => item.properties.is_palindrome);
    parsed_filters.is_palindrome = true;
  }

  const singleWordMatch = lowerQuery.match(/single word|one word/);
  if (singleWordMatch) {
    results = results.filter((item) => item.properties.word_count === 1);
    parsed_filters.word_count = 1;
  }

  const longerMatch = lowerQuery.match(/longer than (\d+)/);
  if (longerMatch) {
    const min = parseInt(longerMatch[1]);
    results = results.filter((item) => item.properties.length > min);
    parsed_filters.min_length = min + 1;
  }

  const containsMatch = lowerQuery.match(/contain(?:s)?(?: the letter)? (\w)/);
  if (containsMatch) {
    const target = containsMatch[1];
    results = results.filter((item) =>
      item.value.toLowerCase().includes(target.toLowerCase())
    );
    parsed_filters.contains_character = target.toLowerCase();
  }

  if (results.length === 0) {
    return res.status(422).json({
      error: 'Query parsed but resulted in no matching data',
      interpreted_query: {
        original: query,
        parsed_filters,
      },
    });
  }

  return res.status(200).json({
    data: results,
    count: results.length,
    interpreted_query: {
      original: query,
      parsed_filters,
    },
  });
});

/**
 * 5️⃣ Delete String
 */
app.delete('/strings/:string_value', (req, res) => {
  const { string_value } = req.params;
  const index = strings.findIndex(
    (item) => item.value.toLowerCase() === string_value.toLowerCase()
  );

  if (index === -1) {
    return res.status(404).json({ error: 'String does not exist in the system' });
  }

  strings.splice(index, 1);
  return res.status(204).send(); // Empty response body
});

/**
 * Start Server
 */
if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;
