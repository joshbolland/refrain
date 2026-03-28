import Foundation

/// Service for looking up rhyming words using the CMU Pronouncing Dictionary
final class RhymeDictionary: Sendable {
    static let shared = RhymeDictionary()

    private let wordToRhymeKey: [String: String]
    private let rhymeKeyToWords: [String: [String]]
    private let baseKeyToWords: [String: [String]]

    private let maxResults = 50

    private init() {
        // Load the compact CMU dictionary from bundle
        guard let url = Bundle.main.url(forResource: "cmudict.compact", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let dictionary = try? JSONDecoder().decode(CompactDictionary.self, from: data) else {
            // Initialize with empty dictionaries if loading fails
            self.wordToRhymeKey = [:]
            self.rhymeKeyToWords = [:]
            self.baseKeyToWords = [:]
            return
        }

        self.wordToRhymeKey = dictionary.wordToRhymeKey
        self.rhymeKeyToWords = dictionary.rhymeKeyToWords

        // Build base key mapping (without stress markers) for near rhymes
        var baseKeys: [String: [String]] = [:]
        for (rhymeKey, words) in dictionary.rhymeKeyToWords {
            // Remove digits (stress markers) from the key
            let baseKey = rhymeKey.filter { !$0.isNumber }
            if baseKeys[baseKey] == nil {
                baseKeys[baseKey] = []
            }
            baseKeys[baseKey]?.append(contentsOf: words)
        }

        // Deduplicate and sort
        for (key, words) in baseKeys {
            baseKeys[key] = Array(Set(words)).sorted()
        }

        self.baseKeyToWords = baseKeys
    }

    /// Normalizes a word for dictionary lookup
    private func normalize(_ word: String) -> String {
        let trimmed = word.trimmingCharacters(in: .whitespaces).lowercased()
        // Remove leading/trailing non-letter characters except apostrophe
        let stripped = trimmed
            .trimmingCharacters(in: CharacterSet.letters.union(CharacterSet(charactersIn: "'")).inverted)
        return stripped
    }

    /// Gets rhyming words for the given word
    /// - Parameter word: The word to find rhymes for
    /// - Returns: Array of rhyming words, perfect rhymes first, then near rhymes
    func getRhymes(for word: String) -> [String] {
        let normalized = normalize(word)
        guard !normalized.isEmpty else { return [] }

        guard let rhymeKey = wordToRhymeKey[normalized] else {
            return []
        }

        // Get perfect rhymes (exact phonetic match)
        let perfectMatches = (rhymeKeyToWords[rhymeKey] ?? [])
            .filter { $0 != normalized }

        if perfectMatches.count >= maxResults {
            return Array(perfectMatches.prefix(maxResults))
        }

        // Get near rhymes (same base key without stress)
        let nearKey = rhymeKey.filter { !$0.isNumber }
        let nearMatches = (baseKeyToWords[nearKey] ?? [])
            .filter { $0 != normalized && !perfectMatches.contains($0) }

        return Array((perfectMatches + nearMatches).prefix(maxResults))
    }

    /// Checks if a word exists in the dictionary
    func containsWord(_ word: String) -> Bool {
        let normalized = normalize(word)
        return wordToRhymeKey[normalized] != nil
    }
}

// MARK: - Dictionary JSON Structure

private struct CompactDictionary: Codable {
    let wordToRhymeKey: [String: String]
    let rhymeKeyToWords: [String: [String]]
}
