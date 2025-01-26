# Anime API

A RESTful API service that provides anime information and episodes by leveraging the Satoru API.

## Features

- Search anime by title
- Get episodes by anime ID
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
Search for an anime and get its episodes. The query parameter can be:
- Regular anime title
- HiAnime ID format (e.g., "attack-on-titan-2013")

#### Response Format
```json
{
    "success": true,
    "data": {
        "id": "string",
        "title": "string",
        "episodes": [
            {
                // episode details
            }
        ]
    }
}
```

### Get Episodes by ID
```
GET /api/:id
```
Get episodes for a specific anime using its ID. The ID parameter can be:
- Regular anime ID
- HiAnime ID format

#### Response Format
```json
{
    "success": true,
    "data": {
        "id": "string",
        "episodes": [
            {
                // episode details
            }
        ]
    }
}
```

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- 400: Bad Request (e.g., missing search query)
- 404: Not Found
- 500: Internal Server Error

Error responses follow this format:
```json
{
    "success": false,
    "message": "Error description",
    "error": "Detailed error message (in case of 500)"
}
```

## Features

### Smart Search
- Intelligent title matching algorithm
- Fallback search mechanism for complex queries
- Automatic title cleaning and formatting

### Title Processing
- Capitalizes words appropriately
- Formats season numbers consistently
- Removes unnecessary TV tags
- Handles hyphenated titles

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

## License

[Add your license here]

## Contributing

[Add contribution guidelines here]