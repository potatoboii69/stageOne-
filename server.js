require('dotenv').config();

const express = require('express')
const crypto = require('crypto')
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

const strings = []

function analyzeString(value){
    const length = value.length
    const isPalindrome = value.toLowerCase() === value.toLowerCase().split('').reverse().join('')
    const unqiue_characters = new Set(value).size
    const word_count = value.trim().split(/\s+/).filter(Boolean).length
    const sha256_hash = crypto.createHash('sha256').update(value).digest('hex')

    const character_map = {}
    for (let char of value){
        if(character_map[char]){
            character_map[char] +=1
        }
        else {
            character_map[char] = 1
        }
    }

    return {
        id: sha256_hash,
        value: value,
        properties:  {
            "length": length,
            "isPalindrome": isPalindrome,
            "unique-characters": unqiue_characters,
            "word_count": word_count,
            "sha256_hash": sha256_hash,
            "character_frequency_map": character_map
        },
        created_at: new Date().toISOString()
    }
}

app.get('/strings',(req,res)=>{

    if (strings.length === 0){
        return res.status(200).json({
            message: 'no records yet',
            data: [],
            count: strings.length
        })
    }
    let results = strings
    const {isPalindrome, min_length, max_length, word_count, contains_char} = req.query

    const parsed_filters = {} // <--- added this

    // Validate query types
    if (isPalindrome !== undefined && !['true', 'false'].includes(isPalindrome)) {
        return res.status(400).json({
            error: 'Invalid query parameter: is_palidrome must be true or false'
        });
    }

    if (min_length !== undefined && isNaN(parseInt(min_length))) {
        return res.status(400).json({
            error: 'Invalid query parameter: min_length must be a number'
        });
    }

    if (max_length !== undefined && isNaN(parseInt(max_length))) {
        return res.status(400).json({
            error: 'Invalid query parameter: max_length must be a number'
        });
    }

    if (word_count !== undefined && isNaN(parseInt(word_count))) {
        return res.status(400).json({
            error: 'Invalid query parameter: word_count must be a number'
        });
    }

    // Filter if palindrome
    if(isPalindrome !== undefined){
        const boolValue = isPalindrome === 'true'
        results = results.filter(item=>item.properties.isPalindrome===boolValue)
        parsed_filters.isPalindrome = boolValue
    }

    if(min_length !== undefined){
        const min = parseInt(min_length)
        results = results.filter(item=>item.properties.length >= min)
        parsed_filters.min_length = min
    }
    if(max_length !== undefined){
        const max = parseInt(max_length)
        results = results.filter(item=>item.properties.length <= max)
        parsed_filters.max_length = max
    }
    if(word_count !== undefined){
        const wc = parseInt(word_count)
        results = results.filter(item=>item.properties.word_count === wc)
        parsed_filters.word_count = wc
    }
    if(contains_char !== undefined){
        const char = contains_char.toLowerCase()
        results = results.filter(item=>item.value.includes(char))
        parsed_filters.contains_char = char
    }

    return res.status(200).json({
        data: results,
        count: results.length,
        filters: req.query,
        parsed_filters // <--- included in response
    })
})

app.get('/strings/filter-by-natural-language', (req,res)=>{
    const {query} = req.query
    if (!query){
       return res.status(400).json({error: 'Missing query parameter'})
    }
    let results = strings
    const lower_query = query.toLowerCase()

    if (lower_query.includes('palindrome')) {
        results = results.filter(item => item.properties.isPalindrome);
    }

    const longerMatch = lower_query.match(/longer than (\d+)/);
    if (longerMatch) {
        const min = parseInt(longerMatch[1]);
        results = results.filter(item => item.value.length > min);
    }

    const shorterMatch = lower_query.match(/shorter than (\d+)/);
    if (shorterMatch) {
        const max = parseInt(shorterMatch[1]);
        results = results.filter(item => item.value.length < max);
    }

    const containsMatch = lower_query.match(/contains (\w+)/);
    if (containsMatch) {
        const target = containsMatch[1];
        results = results.filter(item => item.value.includes(target));
    }

    return res.status(200).json({
        data: results,
        count: results.length,
        interpreted_query: {
            original: query
        }
    });
})

app.get('/strings/:string_value',(req, res) =>{
    const stringValue = req.params.string_value
    const found_string = strings.find(item => item.value === stringValue)

    if(!found_string){
        return res.status(404).json({ error: 'String not found in the system' })
    }
    return res.status(200).json(found_string);
})

app.post('/strings', (req, res)=>{
    const {value} = req.body
    const existing = strings.find(item=>item.value === value)
    if(existing){
        return res.status(409).json({error: "string already exists"})
    }

    if (!value) {
        return res.status(400).json({ error: 'string field is required' })
    }

    if(typeof value !== 'string'){
        return res.status(422).json({error: 'Invalid data type: "value" must be a string' })
    }

    const analyzed = analyzeString(value)
    strings.push(analyzed)
    console.log(strings)

    res.status(201).json(analyzed)
})

app.delete('/strings/:string_value',(req,res)=>{
    const stringValue = req.params.string_value.toLowerCase()
    const index = strings.findIndex(item=>item.value.toLowerCase() === stringValue)

    if (index === -1){
        return res.status(404).json({error: 'String not found'})
    }
    strings.splice(index,1)

    return res.status(200).json({
        message: `String '${stringValue}' deleted successfully`,
        remaining: strings.length
    });
})

app.listen(PORT, ()=>{
    console.log(`Server Running: ${PORT}`)
})
