const express = require('express');
const axios = require('axios');
const router = express.Router();

const BASE_URL = 'https://satoru-flame.vercel.app';

// Helper function to capitalize words
function capitalizeWords(str) {
    return str.replace(/\b\w/g, char => char.toUpperCase());
}

// Helper function to format season number
function formatSeasonNumber(title) {
    // Convert "2nd season", "3rd season", etc. to "Season 2", "Season 3"
    return title
        .replace(/(\d+)(?:st|nd|rd|th)[-\s]+season/i, 'Season $1')
        .replace(/season[-\s]+(\d+)/i, 'Season $1');
}

// Helper function to clean search query
function cleanSearchQuery(query) {
    return query
        .replace(/-tv\b|\btv\b/gi, '')  // Remove 'tv' or '-tv' keyword
        .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
        .trim();                        // Remove leading/trailing spaces
}

// Helper function to find best match
function findBestMatch(results, searchTitle) {
    // Convert search title to lowercase for comparison
    const searchTitleLower = searchTitle.toLowerCase();
    const searchWords = searchTitleLower.split(' ');

    // Find the result with the most matching words
    let bestMatch = results[0];
    let highestMatchCount = 0;

    results.forEach(result => {
        const resultTitle = result.title.replace(/-/g, ' ').toLowerCase();
        const matchCount = searchWords.filter(word => resultTitle.includes(word)).length;

        if (matchCount > highestMatchCount) {
            highestMatchCount = matchCount;
            bestMatch = result;
        }
    });

    return bestMatch;
}

// Helper function to search with fallback
async function searchWithFallback(query, originalTitle) {
    const response = await axios.get(`${BASE_URL}/api/search?query=${query}`);
    
    if (response.data.success && response.data.data.results.length > 0) {
        // Find the best matching result
        const bestMatch = findBestMatch(response.data.data.results, originalTitle);
        response.data.data.results = [bestMatch]; // Replace results with best match
        return response;
    }

    // If no results and query has more than 2 words, try with first 2 words
    const words = query.split(' ');
    if (words.length > 2) {
        const shortQuery = words.slice(0, 2).join(' ');
        const fallbackResponse = await axios.get(`${BASE_URL}/api/search?query=${shortQuery}`);
        
        if (fallbackResponse.data.success && fallbackResponse.data.data.results.length > 0) {
            const bestMatch = findBestMatch(fallbackResponse.data.data.results, originalTitle);
            fallbackResponse.data.data.results = [bestMatch];
            return fallbackResponse;
        }
    }

    return response;
}

// Helper function to extract title from HiAnime ID
function extractTitleFromHiAnimeId(hiAnimeId) {
    // First remove the numeric ID at the end
    const withoutId = hiAnimeId.replace(/-\d+$/, '');
    
    // Convert hyphens to spaces and clean
    let cleanedTitle = withoutId.split('-').join(' ');
    
    // Remove TV
    cleanedTitle = cleanSearchQuery(cleanedTitle);
    
    // Format the season number
    cleanedTitle = formatSeasonNumber(cleanedTitle);
    
    // Capitalize words
    cleanedTitle = capitalizeWords(cleanedTitle);
    
    return cleanedTitle;
}

// Search anime endpoint with direct episode return
router.get('/search', async (req, res) => {
    try {
        let { query } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        if (query.match(/-\d+$/)) {
            query = extractTitleFromHiAnimeId(query);
        } else {
            query = cleanSearchQuery(query);
            query = capitalizeWords(query);
        }
        
        const searchResponse = await searchWithFallback(query, query);

        if (searchResponse.data.success && searchResponse.data.data.results.length > 0) {
            const result = searchResponse.data.data.results[0];
            const episodesResponse = await axios.get(`${BASE_URL}/api/episodes/${result.id}`);
            
            return res.json({
                success: true,
                data: {
                    id: result.id,
                    title: result.title,
                    episodes: episodesResponse.data.data.episodes
                }
            });
        }

        return res.json({
            success: false,
            message: 'No episodes found'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error fetching episodes',
            error: error.message
        });
    }
});

// Get episodes by anime ID endpoint
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // If the ID is a HiAnime ID, extract the title and search for it
        if (id.match(/-\d+$/)) {
            const title = extractTitleFromHiAnimeId(id);
            const searchResponse = await searchWithFallback(title, title);
            
            if (searchResponse.data.success && searchResponse.data.data.results.length > 0) {
                const result = searchResponse.data.data.results[0];
                const episodesResponse = await axios.get(`${BASE_URL}/api/episodes/${result.id}`);
                return res.json({
                    success: true,
                    data: {
                        id: result.id,
                        title: result.title,
                        episodes: episodesResponse.data.data.episodes
                    }
                });
            }
            
            return res.status(404).json({
                success: false,
                message: 'Anime not found'
            });
        }

        const response = await axios.get(`${BASE_URL}/api/episodes/${id}`);
        return res.json({
            success: true,
            data: {
                id: parseInt(id),
                episodes: response.data.data.episodes
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error fetching episodes',
            error: error.message
        });
    }
});

module.exports = router;