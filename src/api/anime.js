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
        .replace(/-tv\b|\btv\b/gi, '')     // Remove 'tv' or '-tv' keyword
        .replace(/worlds/gi, "world's")     // Replace 'worlds' with "world's"
        .replace(/\s+/g, ' ')              // Replace multiple spaces with single space
        .trim();                           // Remove leading/trailing spaces
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
        const bestMatch = findBestMatch(response.data.data.results, originalTitle);
        response.data.data.results = [bestMatch];
        return response;
    }

    // Try with "World's" if "Worlds" is in the query
    if (query.toLowerCase().includes('worlds')) {
        const modifiedQuery = query.replace(/worlds/gi, "world's");
        const apostropheResponse = await axios.get(`${BASE_URL}/api/search?query=${modifiedQuery}`);
        
        if (apostropheResponse.data.success && apostropheResponse.data.data.results.length > 0) {
            const bestMatch = findBestMatch(apostropheResponse.data.data.results, originalTitle);
            apostropheResponse.data.data.results = [bestMatch];
            return apostropheResponse;
        }
    }

    // If still no results, try with first word only
    const words = query.split(' ');
    if (words.length > 1) {
        const shortQuery = words[0];  // Just take the first word
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

// Helper function to extract episode number from URL
function extractEpisodeInfo(hiAnimeId) {
    const match = hiAnimeId.match(/(.*)-episode-(\d+)$/);
    if (!match) return null;
    return {
        animeId: match[1],
        episodeNumber: parseInt(match[2])
    };
}

// Search anime endpoint with direct episode return
router.get('/search', async (req, res) => {
    try {
        let { query } = req.query;
        console.log(`\n📥 Search request received: "${query}"`);

        if (!query) {
            console.log(`❌ Error: No query provided`);
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        if (query.match(/-\d+$/)) {
            console.log(`🔄 Converting HiAnime ID to title`);
            query = extractTitleFromHiAnimeId(query);
        } else {
            query = cleanSearchQuery(query);
            query = capitalizeWords(query);
        }
        console.log(`🔍 Processed query: "${query}"`);
        
        const searchResponse = await searchWithFallback(query, query);

        if (searchResponse.data.success && searchResponse.data.data.results.length > 0) {
            const result = searchResponse.data.data.results[0];
            console.log(`✅ Found anime: "${result.title}" (ID: ${result.id})`);
            
            const episodesResponse = await axios.get(`${BASE_URL}/api/episodes/${result.id}`);
            console.log(`📺 Retrieved ${episodesResponse.data.data.episodes.length} episodes`);
            
            return res.json({
                success: true,
                data: {
                    id: result.id,
                    title: result.title,
                    episodes: episodesResponse.data.data.episodes
                }
            });
        }

        console.log(`❌ No episodes found for: "${query}"`);
        return res.json({
            success: false,
            message: 'No episodes found'
        });
    } catch (error) {
        console.error(`❌ Search error:`, error.message);
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
        console.log(`\n📥 Episode request for ID: "${id}"`);
        
        if (id.match(/-\d+$/)) {
            console.log(`🔄 Converting HiAnime ID to title`);
            const title = extractTitleFromHiAnimeId(id);
            console.log(`🔍 Extracted title: "${title}"`);
            
            const searchResponse = await searchWithFallback(title, title);
            
            if (searchResponse.data.success && searchResponse.data.data.results.length > 0) {
                const result = searchResponse.data.data.results[0];
                console.log(`✅ Found anime: "${result.title}" (ID: ${result.id})`);
                
                const episodesResponse = await axios.get(`${BASE_URL}/api/episodes/${result.id}`);
                console.log(`📺 Retrieved ${episodesResponse.data.data.episodes.length} episodes`);
                
                return res.json({
                    success: true,
                    data: {
                        id: result.id,
                        title: result.title,
                        episodes: episodesResponse.data.data.episodes
                    }
                });
            }
            
            console.log(`❌ Anime not found for: "${title}"`);
            return res.status(404).json({
                success: false,
                message: 'Anime not found'
            });
        }

        console.log(`🔍 Fetching episodes directly for ID: ${id}`);
        const response = await axios.get(`${BASE_URL}/api/episodes/${id}`);
        console.log(`📺 Retrieved ${response.data.data.episodes.length} episodes`);
        
        return res.json({
            success: true,
            data: {
                id: parseInt(id),
                episodes: response.data.data.episodes
            }
        });
    } catch (error) {
        console.error(`❌ Episode fetch error:`, error.message);
        return res.status(500).json({
            success: false,
            message: 'Error fetching episodes',
            error: error.message
        });
    }
});

// New endpoint for streaming sources
router.get('/sources/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const episodeNumber = parseInt(req.query.ep);

        // If no episode number, treat it as the -episode-X format
        if (!episodeNumber) {
            const episodeInfo = extractEpisodeInfo(id);
            if (episodeInfo) {
                // Use existing endpoint logic
                const title = extractTitleFromHiAnimeId(episodeInfo.animeId);
                const searchResponse = await searchWithFallback(title, title);
                
                if (!searchResponse.data.success || !searchResponse.data.data.results.length) {
                    return res.status(404).json({
                        success: false,
                        message: 'Anime not found'
                    });
                }

                const result = searchResponse.data.data.results[0];
                const episodesResponse = await axios.get(`${BASE_URL}/api/episodes/${result.id}`);

                // Find the matching episode
                const episode = episodesResponse.data.data.episodes.find(
                    ep => ep.number === episodeInfo.episodeNumber
                );

                if (!episode) {
                    return res.status(404).json({
                        success: false,
                        message: 'Episode not found'
                    });
                }

                // Get streaming sources
                const sourcesResponse = await axios.get(
                    `${BASE_URL}/api/sources/${result.title}/${episode.id}`
                );

                return res.json({
                    success: true,
                    data: {
                        id: result.id,
                        title: result.title,
                        episode: {
                            number: episode.number,
                            title: episode.title,
                            japaneseTitle: episode.japaneseTitle
                        },
                        sources: sourcesResponse.data.data
                    }
                });
            }
            return res.status(400).json({
                success: false,
                message: 'Episode number required. Use: ?ep={number}'
            });
        }

        // Get the anime info
        const title = extractTitleFromHiAnimeId(id);
        const searchResponse = await searchWithFallback(title, title);

        if (!searchResponse.data.success || !searchResponse.data.data.results.length) {
            return res.status(404).json({
                success: false,
                message: 'Anime not found'
            });
        }

        const result = searchResponse.data.data.results[0];
        const episodesResponse = await axios.get(`${BASE_URL}/api/episodes/${result.id}`);

        // Find the matching episode
        const episode = episodesResponse.data.data.episodes.find(
            ep => ep.number === episodeNumber
        );

        if (!episode) {
            return res.status(404).json({
                success: false,
                message: 'Episode not found'
            });
        }

        // Get streaming sources
        const sourcesResponse = await axios.get(
            `${BASE_URL}/api/sources/${result.title}/${episode.id}`
        );

        return res.json({
            success: true,
            data: {
                id: result.id,
                title: result.title,
                episode: {
                    number: episode.number,
                    title: episode.title,
                    japaneseTitle: episode.japaneseTitle
                },
                sources: sourcesResponse.data.data
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error fetching sources',
            error: error.message
        });
    }
});

module.exports = router;
