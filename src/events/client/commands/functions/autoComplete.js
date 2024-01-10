module.exports = {
    getAutocompleteSearch: async (query) => {
        const response = await fetch(`https://clients1.google.com/complete/search?client=youtube&hl=en-IN&q=${query}`);
        const inputString = await response.text();
        const match = inputString.match(/\[.*\]/);
        let data = [];

        if (match) {
            try {
                const jsonData = JSON.parse(match[0]);
                if (Array.isArray(jsonData) && jsonData.length >= 2) {
                    data = jsonData[1].slice(0, 7).map((item) => item[0]);
                } else {
                    return new Error("Unable to find a valid JSON format.");
                }
            } catch (error) {
                return new Error("Error occurred while parsing JSON data.");
            }
        } else {
            return new Error("Unable to find JSON data in the response.");
        }
        return data;
    },
};
