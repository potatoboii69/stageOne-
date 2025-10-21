require('dotenv').config();
const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(express.json());

// In-memory store (swap for DB in production)
const strings = [];

/**
 * Analyze string and return object shaped per assignment
 */
function analyzeString(value) {
  const length = value.length;
  const is_palindrome = value.toLowerCase() === value.toLowerCase().split('').reverse().join('');
  const unique_characters = new Set(value).size;
  const word_count = value.trim().length === 0 ? 0 : value.trim().split(/\s+/).filter(Boolean).length;
  const sha256_hash = crypto.createHash('sha256').update(value).digest('hex');

  const character_frequency_map = {};
  for (const ch of value) {
    character_frequency_map[ch] = (character_frequency_map[ch] || 0) + 1;
  }

  return {
    id: sha256_hash,
    value,
    properties: {
      length,
      is_palindrome,
      unique_characters,
      word_count,
      sha256_hash,
      character_frequency_map
    },
    created_at: new Date().toISOString()
  };
}

/* Utility: find by exact value (case-sensitive as spec implies) */
function findByValue(value) {
  return strings.find(item => item.value === value);
}

/* Utility: validate integer-like query param */
function parseIntOrNull(v) {
  if (v === undefined) return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * 1) POST /strings
 * - 400: missing "value"
 * - 422: wrong type
 * - 409: duplicate
 * - 201: created (return full object)
 */
app.post('/strings', (req, res) => {
  const { value } = req.body;

  if (value === undefined) {
    return res.status(400).json({ error: 'Missing "value" field' });
  }
  if (typeof value !== 'string') {
    return res.status(422).json({ error: '"value" must be a string' });
  }

  if (findByValue(value)) {
    return res.status(409).json({ error: 'String already exists in the system' });
  }

  const entry = analyzeString(value);
  strings.push(entry);
  return res.status(201).json(entry);
});

/**
 * 2) GET /strings/{string_value}
 * - 200: found
 * - 404: not found
 */
app.get('/strings/:string_value', (req, res) => {
  const stringValue = req.params.string_value; // express decodes URL-encoding for us
  const found = findByValue(stringValue);
  if (!found) {
    return res.status(404).json({ error: 'String does not exist in the system' });
  }
  return res.status(200).json(found);
});

/**
 * 3) GET /strings with filters
 * Query params: is_palindrome, min_length, max_length, word_count, contains_character
 * - 400 for invalid query types/values
 * - 200 with { data, count, filters_applied }
 */
app.get('/strings', (req, res) => {
  const {
    is_palindrome,
    min_length,
    max_length,
    word_count,
    contains_character
  } = req.query;

  // Validate types
  if (is_palindrome !== undefined && !['true', 'false'].includes(is_palindrome)) {
    return res.status(400).json({ error: 'is_palindrome must be "true" or "false"' });
  }
  const minLen = parseIntOrNull(min_length);
  if (min_length !== undefined && minLen === null) {
    return res.status(400).json({ error: 'min_length must be an integer' });
  }
  const maxLen = parseIntOrNull(max_length);
  if (max_length !== undefined && maxLen === null) {
    return res.status(400).json({ error: 'max_length must be an integer' });
  }
  const wc = parseIntOrNull(word_count);
  if (word_count !== undefined && wc === null) {
    return res.status(400).json({ error: 'word_count must be an integer' });
  }
  if (contains_character !== undefined && typeof contains_character !== 'string') {
    return res.status(400).json({ error: 'contains_character must be a string' });
  }
  if (contains_character !== undefined && contains_character.length !== 1) {
    return res.status(400).json({ error: 'contains_character must be a single character' });
  }

  let results = strings.slice();
  const filters_applied = {};

  if (is_palindrome !== undefined) {
    const boolVal = is_palindrome === 'true';
    results = results.filter(item => item.properties.is_palindrome === boolVal);
    filters_applied.is_palindrome = boolVal;
  }
  if (minLen !== undefined) {
    results = results.filter(item => item.properties.length >= minLen);
    filters_applied.min_length = minLen;
  }
  if (maxLen !== undefined) {
    results = results.filter(item => item.properties.length <= maxLen);
    filters_applied.max_length = maxLen;
  }
  if (wc !== undefined) {
    results = results.filter(item => item.properties.word_count === wc);
    filters_applied.word_count = wc;
  }
  if (contains_character !== undefined) {
    const ch = contains_character.toLowerCase();
    results = results.filter(item => item.value.toLowerCase().includes(ch));
    filters_applied.contains_character = ch;
  }

  return res.status(200).json({
    data: results,
    count: results.length,
    filters_applied
  });
});

/**
 * 4) Natural language filtering
 * GET /strings/filter-by-natural-language?query=...
 * - 400 if unable to parse
 * - 422 if parsed but filters conflict (e.g., min > max)
 * - 200 with { data, count, interpreted_query }
 */
function parseNaturalLanguageQuery(q) {
  // return parsed filters object or null if nothing parsed
  const parsed = {};
  const s = q.toLowerCase();

  // word count: single/one => 1
  if (/\b(single|one)\b.*\bword\b/.test(s) || /\bword count is 1\b/.test(s)) {
    parsed.word_count = 1;
  }
  const wcMatch = s.match(/\b(\d+)\s+word(s)?\b/);
  if (wcMatch) parsed.word_count = Number(wcMatch[1]);

  // palindrome
  if (/\bpalindrom\w*\b/.test(s)) parsed.is_palindrome = true;

  // longer/shorter than N
  const longer = s.match(/\blonger than (\d+)/);
  if (longer) parsed.min_length = Number(longer[1]) + 1; // "longer than 10" => min_length = 11
  const shorter = s.match(/\b(shorter than|less than) (\d+)/);
  if (shorter) parsed.max_length = Number(shorter[2]) - 1;

  // contains letter X
  const letterMatch = s.match(/\b(?:contain(?:ing|s)?(?: the)?(?: letter)?|containing)\s+([a-zA-Z])\b/);
  if (letterMatch) parsed.contains_character = letterMatch[1].toLowerCase();

  // If nothing parsed -> return null to indicate cannot parse
  return Object.keys(parsed).length === 0 ? null : parsed;
}

app.get('/strings/filter-by-natural-language', (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing "query" parameter' });
  }

  const parsed_filters = parseNaturalLanguageQuery(query);
  if (!parsed_filters) {
    return res.status(400).json({ error: 'Unable to parse natural language query' });
  }

  // Check for conflicting filters (example: min_length > max_length)
  if (parsed_filters.min_length !== undefined && parsed_filters.max_length !== undefined) {
    if (parsed_filters.min_length > parsed_filters.max_length) {
      return res.status(422).json({
        error: 'Query parsed but resulted in conflicting filters',
        interpreted_query: {
          original: query,
          parsed_filters
        }
      });
    }
  }

  // Apply filters
  let results = strings.slice();
  if (parsed_filters.is_palindrome === true) {
    results = results.filter(item => item.properties.is_palindrome === true);
  }
  if (parsed_filters.word_count !== undefined) {
    results = results.filter(item => item.properties.word_count === parsed_filters.word_count);
  }
  if (parsed_filters.min_length !== undefined) {
    results = results.filter(item => item.properties.length >= parsed_filters.min_length);
  }
  if (parsed_filters.max_length !== undefined) {
    results = results.filter(item => item.properties.length <= parsed_filters.max_length);
  }
  if (parsed_filters.contains_character !== undefined) {
    const ch = parsed_filters.contains_character.toLowerCase();
    results = results.filter(item => item.value.toLowerCase().includes(ch));
  }

  return res.status(200).json({
    data: results,
    count: results.length,
    interpreted_query: {
      original: query,
      parsed_filters
    }
  });
});

/**
 * 5) DELETE /strings/{string_value}
 * - 204 on success (empty body)
 * - 404 if not found
 */
app.delete('/strings/:string_value', (req, res) => {
  const stringValue = req.params.string_value;
  const idx = strings.findIndex(item => item.value === stringValue);
  if (idx === -1) {
    return res.status(404).json({ error: 'String does not exist in the system' });
  }
  strings.splice(idx, 1);
  return res.status(204).send();
});

/* Health */
app.get('/', (req, res) => res.json({ status: 'ok' }));

/* Start */
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
