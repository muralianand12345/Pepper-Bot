import { IAutoCompleteOptions } from '../types';

/**
 * Custom error class for YouTube autocomplete errors
 */
class AutoCompleteError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AutoCompleteError';
    }
}

/**
 * Service class for handling YouTube search autocomplete functionality
 */
class YouTubeAutoComplete {
    private readonly baseUrl: string;
    private readonly defaultOptions: IAutoCompleteOptions;

    constructor() {
        this.baseUrl = 'https://clients1.google.com/complete/search';
        this.defaultOptions = {
            maxResults: 7,
            language: 'en-IN',
            client: 'youtube'
        };
    }

    /**
     * Constructs the URL for the autocomplete API request
     * 
     * @private
     * @param query - Search query string
     * @param options - Configuration options
     * @returns Constructed URL string
     */
    private buildUrl(query: string, options: IAutoCompleteOptions = {}): string {
        const params = new URLSearchParams({
            client: options.client || this.defaultOptions.client!,
            hl: options.language || this.defaultOptions.language!,
            q: query.trim()
        });

        return `${this.baseUrl}?${params.toString()}`;
    }

    /**
     * Parses the response text to extract suggestion data
     * 
     * @private
     * @param responseText - Raw response text from the API
     * @param maxResults - Maximum number of results to return
     * @returns Array of suggestion strings
     * @throws {AutoCompleteError} If parsing fails or data format is invalid
     */
    private parseResponse(responseText: string, maxResults: number): string[] {
        const match = responseText.match(/\[.*\]/);
        if (!match) {
            throw new AutoCompleteError('No JSON data found in response');
        }

        try {
            const jsonData = JSON.parse(match[0]);
            if (!Array.isArray(jsonData) || jsonData.length < 2 || !Array.isArray(jsonData[1])) {
                throw new AutoCompleteError('Invalid response format');
            }

            return jsonData[1]
                .slice(0, maxResults)
                .map((item: any) => String(item[0]));

        } catch (error) {
            if (error instanceof Error) {
                throw new AutoCompleteError(`Failed to parse response: ${error.message}`);
            }
            throw new AutoCompleteError('Failed to parse response: Unknown error');
        }
    }

    /**
     * Fetches autocomplete suggestions for a YouTube search query
     * 
     * @param query - Search query string
     * @param options - Configuration options
     * @returns Promise resolving to an array of suggestion strings
     * @throws {AutoCompleteError} If the request fails or response is invalid
     * @example
     * ```typescript
     * const autoComplete = new YouTubeAutoComplete();
     * try {
     *     const suggestions = await autoComplete.getSuggestions('programming tutorial');
     *     console.log(suggestions);
     * } catch (error) {
     *     if (error instanceof AutoCompleteError) {
     *         console.error(error.message);
     *     }
     * }
     * ```
     */
    public async getSuggestions(
        query: string,
        options: IAutoCompleteOptions = {}
    ): Promise<string[]> {
        if (!query?.trim()) {
            return [];
        }

        const maxResults = options.maxResults || this.defaultOptions.maxResults!;
        const url = this.buildUrl(query, options);

        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new AutoCompleteError(
                    `Request failed with status ${response.status}`
                );
            }

            const text = await response.text();
            return this.parseResponse(text, maxResults);

        } catch (error) {
            if (error instanceof AutoCompleteError) {
                throw error;
            }
            if (error instanceof Error) {
                throw new AutoCompleteError(`Request failed: ${error.message}`);
            }
            throw new AutoCompleteError('Request failed: Unknown error');
        }
    }
}

export { YouTubeAutoComplete, AutoCompleteError };