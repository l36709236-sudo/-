
import { GoogleGenAI, Type } from "@google/genai";

if (!process.env.API_KEY) {
    // In a real app, this should be handled more gracefully.
    // Here we throw an error because the app cannot function without the key.
    throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function translateTextBatch(texts: string[]): Promise<string[]> {
    if (texts.length === 0) {
        return [];
    }

    try {
        const prompt = `Translate each of the following English texts to Kurdish (Sorani). Return the result as a JSON array of strings, where each translated text corresponds to the original in the same order. Provide only the JSON array in your response.

Input Texts:
${JSON.stringify(texts)}
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.STRING,
                    },
                },
            },
        });
        
        const jsonStr = response.text.trim();
        const translatedArray = JSON.parse(jsonStr);

        if (!Array.isArray(translatedArray) || translatedArray.some(item => typeof item !== 'string')) {
            throw new Error('Gemini API did not return a valid array of strings.');
        }

        return translatedArray;

    } catch (error) {
        console.error("Error translating text with Gemini API:", error);
        throw new Error("Failed to get a valid translation from the AI model.");
    }
}
