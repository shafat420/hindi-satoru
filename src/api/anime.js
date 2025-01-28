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
        .replace(/world'S/gi, "world's")    // Fix incorrect World'S capitalization
        .replace(/\s+/g, ' ')              // Replace multiple spaces with single space
        .trim();                           // Remove leading/trailing spaces
}

// Add string similarity function
function stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const costs = new Array();
    for (let i = 0; i <= longer.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= shorter.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[shorter.length] = lastValue;
    }
    
    const similarity = (longer.length - costs[shorter.length]) / longer.length;
    return similarity;
}

// Helper function to find best match with similarity check
function findBestMatch(results, searchTitle) {
    const searchTitleLower = searchTitle.toLowerCase().replace(/-/g, ' ').trim();
    
    // Special case for Shangri-La
    if (searchTitleLower.includes('shangri')) {
        const shanghriMatch = results.find(result => {
            const title = result.title.toLowerCase();
            return title.includes('shangri');
        });
        if (shanghriMatch) return shanghriMatch;
    }

    // Special case for Gods' Game We Play
    if (searchTitleLower.includes('gods game') || searchTitleLower.includes('god game')) {
        const godsGameMatch = results.find(result => {
            const title = result.title.toLowerCase();
            return (title.includes('gods game') || 
                   title.includes('god game') || 
                   title.includes('gods\' game') ||
                   title.includes("god's game"));
        });
        if (godsGameMatch) return godsGameMatch;
    }

    // Try to find exact ID match first
    const idMatch = results.find(result => {
        // Remove numeric suffix from both titles for comparison
        const resultBase = result.title.toLowerCase().replace(/-\d+$/, '');
        const searchBase = searchTitleLower.replace(/-\d+$/, '');
        return resultBase === searchBase;
    });
    
    if (idMatch) {
        return idMatch;
    }

    // Try to find exact title match
    const exactMatch = results.find(result => {
        const resultTitle = result.title.toLowerCase().replace(/-/g, ' ');
        return resultTitle === searchTitleLower;
    });
    
    if (exactMatch) {
        return exactMatch;
    }

    // For titles with multiple results, prefer the shorter/original title
    const baseMatches = results.filter(result => {
        const resultTitle = result.title.toLowerCase().replace(/-/g, ' ');
        return resultTitle.startsWith(searchTitleLower);
    });

    if (baseMatches.length > 0) {
        // Sort by length and return the shortest (original) title
        return baseMatches.sort((a, b) => a.title.length - b.title.length)[0];
    }

    // If still no match, try partial matches
    const searchWords = searchTitleLower.split(' ')
        .filter(word => !['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'as'].includes(word));
    
    const firstFewWords = searchWords.slice(0, 3).join(' ');

    const potentialMatches = results.filter(result => {
        const title = result.title.replace(/-/g, ' ').toLowerCase();
        return title.includes(firstFewWords) || 
               title.includes(firstFewWords.replace(/'/g, '')) ||
               title.includes(firstFewWords.replace(/'/g, 's'));
    });

    if (potentialMatches.length > 0) {
        // Sort by length and return the shortest (original) title
        return potentialMatches.sort((a, b) => a.title.length - b.title.length)[0];
    }

    return null;
}

// Helper function to search with fallback
async function searchWithFallback(query, originalTitle) {
    // Special case for Shangri-La
    if (query.toLowerCase().includes('shangri')) {
        const shanghriQuery = 'shangri';
        const response = await axios.get(`${BASE_URL}/api/search?query=${shanghriQuery}`);
        
        if (response.data.success && response.data.data.results.length > 0) {
            const bestMatch = findBestMatch(response.data.data.results, originalTitle);
            if (bestMatch) {
                response.data.data.results = [bestMatch];
                return response;
            }
        }
    }

    // Special case for Gods' Game We Play
    if (query.toLowerCase().includes('gods game') || query.toLowerCase().includes('god game')) {
        const variations = ['gods game', 'god game', 'gods\' game', 'god\'s game'];
        for (const variation of variations) {
            const response = await axios.get(`${BASE_URL}/api/search?query=${variation}`);
            
            if (response.data.success && response.data.data.results.length > 0) {
                const bestMatch = findBestMatch(response.data.data.results, originalTitle);
                if (bestMatch) {
                    response.data.data.results = [bestMatch];
                    return response;
                }
            }
        }
    }

    // Regular search logic
    const response = await axios.get(`${BASE_URL}/api/search?query=${query}`);
    
    if (response.data.success && response.data.data.results.length > 0) {
        const bestMatch = findBestMatch(response.data.data.results, originalTitle);
        if (bestMatch) {
            response.data.data.results = [bestMatch];
            return response;
        }
    }

    // If no matches found, return empty results
    response.data.data.results = [];
    return response;
}

// Helper function to extract title from HiAnime ID
function extractTitleFromHiAnimeId(hiAnimeId) {
    // First remove the numeric ID at the end
    const withoutId = hiAnimeId.replace(/-\d+$/, '');
    
    // Convert hyphens to spaces and clean
    let cleanedTitle = withoutId.split('-').join(' ');
    
    // Remove TV and fix apostrophes
    cleanedTitle = cleanSearchQuery(cleanedTitle);
    
    // Format the season number
    cleanedTitle = formatSeasonNumber(cleanedTitle);
    
    // Fix World'S specifically before general capitalization
    cleanedTitle = cleanedTitle.replace(/world'S/gi, "world's");
    
    // Capitalize words
    cleanedTitle = capitalizeWords(cleanedTitle);
    
    // Ensure correct apostrophe case after capitalization
    cleanedTitle = cleanedTitle.replace(/World'S/g, "World's");
    
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
        
        if (id.match(/-\d+$/)) {
            const title = extractTitleFromHiAnimeId(id);
            
            // Try full title first
            let searchResponse = await searchWithFallback(title, title);
            
            // If no results, try with first meaningful words
            if (!searchResponse.data.success || !searchResponse.data.data.results.length) {
                const words = title.split(' ');
                const meaningfulWords = words.filter(word => {
                    const lowerWord = word.toLowerCase();
                    return !['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'as'].includes(lowerWord);
                });

                if (meaningfulWords.length >= 2) {
                    const shortQuery = meaningfulWords.slice(0, 2).join(' ').toLowerCase();
                    searchResponse = await searchWithFallback(shortQuery, title);
                }
            }
            
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
