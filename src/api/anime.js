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
    
    // Extract season/arc information from search title
    const seasonMatch = searchTitleLower.match(/(?:season|s)\s*(\d+)|(\d+)(?:st|nd|rd|th)\s+season/i);
    const arcMatch = searchTitleLower.match(/(?:arc|saga|part|village|district)/i);
    
    // First try exact matches with season/arc consideration
    const exactMatches = results.filter(result => {
        const title = result.title.toLowerCase().replace(/-/g, ' ');
        
        // If searching for a specific season
        if (seasonMatch) {
            const seasonNum = seasonMatch[1] || seasonMatch[2];
            return title.includes(`season ${seasonNum}`) || 
                   title.includes(`s${seasonNum}`) ||
                   title.includes(`${seasonNum}rd season`) ||
                   title.includes(`${seasonNum}th season`) ||
                   title.includes(`${seasonNum}nd season`) ||
                   title.endsWith(`-${seasonNum}`);
        }
        
        // If searching for a specific arc
        if (arcMatch) {
            const arcName = arcMatch[0].toLowerCase();
            return title.includes(arcName);
        }
        
        return title === searchTitleLower;
    });
    
    if (exactMatches.length > 0) {
        return exactMatches[0];
    }

    // Try to match by significant words
    const significantWords = searchTitleLower.split(' ')
        .filter(word => word.length > 2 && 
            !['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'as', 'arc', 'saga', 'part'].includes(word));
    
    const wordMatches = results.filter(result => {
        const title = result.title.toLowerCase().replace(/-/g, ' ');
        return significantWords.every(word => title.includes(word));
    });
    
    if (wordMatches.length > 0) {
        // Sort by similarity to get best match
        return wordMatches.sort((a, b) => {
            const simA = stringSimilarity(a.title.toLowerCase(), searchTitleLower);
            const simB = stringSimilarity(b.title.toLowerCase(), searchTitleLower);
            return simB - simA;
        })[0];
    }

    // Special cases for specific titles
    const specialCases = {
        'kamikatsu': ['kamikatsu', 'kami katsu', 'working for god'],
        'makeine': ['makein', 'make in', 'makenai', 'losing heroines'],
        'shangri': ['shangri'],
        'god game': ['gods game', 'god game', 'gods\' game', "god's game"],
        'demon slayer': {
            'swordsmith': ['swordsmith', 'katanakaji'],
            'entertainment': ['entertainment', 'yuukaku'],
            'mugen': ['mugen', 'infinity']
        }
    };

    // Check special cases
    for (const [key, variations] of Object.entries(specialCases)) {
        if (searchTitleLower.includes(key)) {
            if (typeof variations === 'object' && !Array.isArray(variations)) {
                // Handle nested cases like Demon Slayer
                for (const [arcKey, arcVariations] of Object.entries(variations)) {
                    if (searchTitleLower.includes(arcKey)) {
                        const match = results.find(result => {
                            const title = result.title.toLowerCase();
                            return arcVariations.some(v => title.includes(v));
                        });
                        if (match) return match;
                    }
                }
            } else {
                const match = results.find(result => {
                    const title = result.title.toLowerCase();
                    return variations.some(v => title.includes(v));
                });
                if (match) return match;
            }
        }
    }

    // If still no match, try partial matches with first few words
    const firstFewWords = significantWords.slice(0, 2).join(' ');
    const partialMatches = results.filter(result => {
        const title = result.title.toLowerCase().replace(/-/g, ' ');
        return title.includes(firstFewWords);
    });

    if (partialMatches.length > 0) {
        // Sort by similarity and length
        return partialMatches.sort((a, b) => {
            const simA = stringSimilarity(a.title.toLowerCase(), searchTitleLower);
            const simB = stringSimilarity(b.title.toLowerCase(), searchTitleLower);
            if (Math.abs(simA - simB) < 0.1) {
                // If similarity is close, prefer shorter titles
                return a.title.length - b.title.length;
            }
            return simB - simA;
        })[0];
    }

    return null;
}

// Helper function to verify title match
function verifyTitleMatch(result, searchTitle) {
    const resultTitle = result.title.toLowerCase().replace(/-/g, ' ');
    const searchTitleLower = searchTitle.toLowerCase().replace(/-/g, ' ');

    // Check for season numbers
    const searchSeasonMatch = searchTitleLower.match(/(?:season|s)\s*(\d+)|(\d+)(?:st|nd|rd|th)\s+season/i);
    const resultSeasonMatch = resultTitle.match(/(?:season|s)\s*(\d+)|(\d+)(?:st|nd|rd|th)\s+season/i);
    
    if (searchSeasonMatch && resultSeasonMatch) {
        const searchSeasonNum = searchSeasonMatch[1] || searchSeasonMatch[2];
        const resultSeasonNum = resultSeasonMatch[1] || resultSeasonMatch[2];
        if (searchSeasonNum !== resultSeasonNum) {
            return false;
        }
    }

    // Check for arc names
    const arcKeywords = ['swordsmith', 'entertainment', 'mugen', 'infinity', 'village', 'district'];
    const searchArcWord = arcKeywords.find(word => searchTitleLower.includes(word));
    if (searchArcWord && !resultTitle.includes(searchArcWord)) {
        return false;
    }

    // Split titles into words and compare significant words
    const searchWords = searchTitleLower.split(' ')
        .filter(word => word.length > 2 && 
            !['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'as', 'arc', 'saga', 'part'].includes(word));
    
    const resultWords = resultTitle.split(' ')
        .filter(word => word.length > 2 && 
            !['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'as', 'arc', 'saga', 'part'].includes(word));

    // Check if all significant words from search are in result
    return searchWords.every(word => resultWords.some(rWord => rWord.includes(word)));
}

// Helper function to search with fallback
async function searchWithFallback(query, originalTitle) {
    async function trySearch(searchQuery) {
        const response = await axios.get(`${BASE_URL}/api/search?query=${searchQuery}`);
        if (response.data.success && response.data.data.results.length > 0) {
            // Verify each result
            const verifiedResults = response.data.data.results.filter(result => 
                verifyTitleMatch(result, originalTitle)
            );
            if (verifiedResults.length > 0) {
                response.data.data.results = verifiedResults;
                return response;
            }
        }
        return null;
    }

    // Try with full query first
    let response = await trySearch(query);
    if (response) {
        return response;
    }

    // If full query fails, try with first two meaningful words
    const words = query.split(/\s+/).filter(word => 
        word.length > 2 && 
        !['the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'as', 'arc', 'saga', 'part'].includes(word.toLowerCase())
    );

    if (words.length >= 2) {
        const shortQuery = words.slice(0, 2).join(' ');
        response = await trySearch(shortQuery);
        if (response) {
            // Additional verification for season/arc specific matches
            const results = response.data.data.results;
            const queryLower = query.toLowerCase();
            
            // Check for season numbers
            const seasonMatch = queryLower.match(/(?:season|s)\s*(\d+)|(\d+)(?:st|nd|rd|th)\s+season/i);
            if (seasonMatch) {
                const seasonNum = seasonMatch[1] || seasonMatch[2];
                const seasonResults = results.filter(result => {
                    const title = result.title.toLowerCase();
                    return title.includes(`season-${seasonNum}`) || 
                           title.includes(`s${seasonNum}`) ||
                           title.includes(`${seasonNum}rd-season`) ||
                           title.includes(`${seasonNum}th-season`) ||
                           title.includes(`${seasonNum}nd-season`) ||
                           title.endsWith(`-${seasonNum}`);
                });
                
                if (seasonResults.length > 0) {
                    response.data.data.results = [seasonResults[0]];
                    return response;
                }
            }
            
            // Check for specific arc keywords
            const arcKeywords = ['swordsmith', 'entertainment', 'mugen', 'infinity', 'village', 'district'];
            const arcMatch = arcKeywords.find(keyword => queryLower.includes(keyword));
            if (arcMatch) {
                const arcResults = results.filter(result => 
                    result.title.toLowerCase().includes(arcMatch)
                );
                
                if (arcResults.length > 0) {
                    response.data.data.results = [arcResults[0]];
                    return response;
                }
            }
        }
    }

    // If still no verified match, try with first word
    if (words.length > 0) {
        const firstWord = words[0];
        response = await trySearch(firstWord);
        if (response) {
            // Sort by similarity and verify matches
            const results = response.data.data.results;
            const verifiedResults = results.filter(result => verifyTitleMatch(result, originalTitle))
                .sort((a, b) => {
                    const simA = stringSimilarity(a.title.toLowerCase(), query.toLowerCase());
                    const simB = stringSimilarity(b.title.toLowerCase(), query.toLowerCase());
                    return simB - simA;
                });
            
            if (verifiedResults.length > 0) {
                response.data.data.results = [verifiedResults[0]];
                return response;
            }
        }
    }

    // If no verified matches found
    return {
        data: {
            success: false,
            data: {
                results: []
            }
        }
    };
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
