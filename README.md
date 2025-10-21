# 🧠 Stage One Backend Task — Express String Analyzer API

This project is part of the **Backend Wizards Stage One Task**.  
It’s a RESTful **Express.js API** that stores, analyzes, filters, and deletes strings dynamically.  
It also supports **natural language filtering** and returns parsed filters for debugging or testing.

---

## 🚀 Features

✅ Add and analyze strings (palindrome check, word count, SHA-256 hash, etc.)  
✅ Retrieve all stored strings  
✅ Filter by query parameters or natural language  
✅ Delete strings  
✅ Get parsed filter output for verification  

---

## 📁 Endpoints Overview

| Method | Endpoint | Description |
|--------|-----------|-------------|
| **POST** | `/string` | Add a new string to the system |
| **GET** | `/strings` | Retrieve or filter all strings |
| **GET** | `/strings/filter-by-natural-language` | Filter strings using plain English queries |
| **GET** | `/strings/:string_value` | Retrieve one string by its actual value |
| **DELETE** | `/strings/:string_value` | Delete a string by its value |

---

## 🧩 Example Usage

### ➕ Add a String

**POST** `/string`

Request body:
```json
{
  "value": "level"
}
```
### Response
{
  "id": "sha256-hash",
  "value": "level",
  "properties": {
    "length": 5,
    "isPalindrome": true,
    "unique-characters": 4,
    "word_count": 1,
    "sha256_hash": "....",
    "character_frequency_map": {
      "l": 2,
      "e": 2,
      "v": 1
    }
  },
  "created_at": "2025-10-21T09:22:10.012Z"
}

### GET /strings?isPalindrome=true&min_length=3&max_length=10
{
  "data": [...],
  "count": 1,
  "filters": {
    "isPalindrome": "true",
    "min_length": "3",
    "max_length": "10"
  }
}

### DELETE /strings/level
{
  "message": "String 'level' deleted successfully",
  "remaining": 0
}

## Setup Instructions
git clone <your-repo-url>
cd <repo-folder>

### Install Dependencies
npm install

### Run the Server
node server.js

