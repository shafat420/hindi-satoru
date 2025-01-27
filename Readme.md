# Anime API

A RESTful API service that provides anime information, episodes, and streaming sources by leveraging the Satoru API.

## Features

- Search anime by title
- Get episodes by anime ID
- Get streaming sources for specific episodes
- Support for HiAnime ID format
- Intelligent search with fallback mechanism
- Title formatting and cleaning

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd anime-api
```

2. Install dependencies:

```bash
npm install
```

3. Start the server:

```bash
npm start
```

The server will run on port 3000 by default, or you can specify a custom port using the `PORT` environment variable.

## API Endpoints

### Health Check
```
GET /
```
Returns the API status.

### Search Anime
```
GET /api/search?query=<anime-title>
```
Example: `/api/search?query=blue-lock-season-2-19318`

### Get Episodes by ID
```
GET /api/:id
```
Example: `/api/blue-lock-season-2-19318`

### Get Streaming Sources
```
GET /api/sources/:id?ep=<episode-number>
```
Example: `/api/sources/blue-lock-season-2-19318?ep=1`

Alternative format:
```
GET /api/sources/:id-episode-<number>
```
Example: `/api/sources/blue-lock-season-2-19318-episode-1`

## Response Formats

### Search & Episodes Response
```json
{
    "success": true,
    "data": {
        "id": 112,
        "title": "Anime Title",
        "episodes": [
            {
                "id": "123",
                "number": 1,
                "title": "Episode Title",
                "japaneseTitle": "Japanese Title"
            }
        ]
    }
}
```

### Streaming Sources Response
```json
{
    "success": true,
    "data": {
        "id": 112,
        "title": "Anime Title",
        "episode": {
            "number": 1,
            "title": "Episode Title",
            "japaneseTitle": "Japanese Title"
        },
        "sources": [
            // Streaming sources
        ]
    }
}
```

## Error Responses
```json
{
    "success": false,
    "message": "Error description",
    "error": "Detailed error message (if applicable)"
}
```

## Features

### Smart Search
- Intelligent title matching
- Fallback search for complex queries
- Automatic title cleaning and formatting

### Title Processing
- Proper capitalization
- Season number formatting (e.g., "2nd season" → "Season 2")
- TV tag removal
- Hyphen handling

## Dependencies

- Express.js
- Axios

## Environment Variables

- `PORT`: Server port (default: 3000)

## Development

To run the server in development mode:
```bash
npm run dev
```

## Deploy on Vercel

1. Push to GitHub
2. Import to Vercel
3. Deploy

## Built With

- Node.js
- Express
- Axios
- Vercel for deployment

## Credits

Data provided by [Satoru API](https://satoru-flame.vercel.app/)

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]
