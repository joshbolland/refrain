import Foundation

/// Counts syllables in words and lines using heuristic rules
enum SyllableCounter {

    private static let vowelPattern = try! NSRegularExpression(pattern: "[aeiouy]+", options: .caseInsensitive)

    /// Checks if a word ends with consonant + "le" (adds a syllable)
    private static func endsWithConsonantLe(_ word: String) -> Bool {
        guard word.count >= 3 else { return false }

        let lower = word.lowercased()
        guard lower.hasSuffix("le") else { return false }

        let thirdFromEnd = lower.index(lower.endIndex, offsetBy: -3)
        let char = lower[thirdFromEnd]
        let consonants = CharacterSet(charactersIn: "bcdfghjklmnpqrstvwxz")
        return char.unicodeScalars.allSatisfy { consonants.contains($0) }
    }

    /// Strips punctuation from a word for syllable counting
    private static func stripPunctuation(_ word: String) -> String {
        let trimmed = word.trimmingCharacters(in: .whitespaces).lowercased()
        // Remove non-letter characters except apostrophes and hyphens
        let cleaned = trimmed.unicodeScalars.filter { scalar in
            CharacterSet.lowercaseLetters.contains(scalar) ||
            scalar == "'" ||
            scalar == "-"
        }
        var result = String(String.UnicodeScalarView(cleaned))
        // Remove leading/trailing apostrophes
        while result.hasPrefix("'") { result.removeFirst() }
        while result.hasSuffix("'") { result.removeLast() }
        return result
    }

    /// Base syllable count for a sanitized word
    private static func baseCount(_ word: String) -> Int {
        let sanitized = word.replacingOccurrences(of: "'", with: "")
        guard !sanitized.isEmpty else { return 0 }

        let range = NSRange(sanitized.startIndex..., in: sanitized)
        let matches = vowelPattern.matches(in: sanitized, options: [], range: range)
        var count = matches.count

        // Silent 'e' at end (but not consonant+le)
        if sanitized.hasSuffix("e") && !endsWithConsonantLe(sanitized) && count > 1 {
            count -= 1
        }

        // Silent 'ed' at end (unless preceded by t or d)
        if sanitized.hasSuffix("ed") && count > 1 {
            let pattern = try! NSRegularExpression(pattern: "[td]ed$")
            let hasMatch = pattern.firstMatch(in: sanitized, options: [], range: NSRange(sanitized.startIndex..., in: sanitized)) != nil
            if !hasMatch {
                count -= 1
            }
        }

        return max(count, 1)
    }

    /// Counts syllables in a single word
    /// - Parameter rawWord: The word to analyze
    /// - Returns: The estimated syllable count
    static func countSyllablesInWord(_ rawWord: String) -> Int {
        let cleaned = stripPunctuation(rawWord)
        guard !cleaned.isEmpty else { return 0 }

        // Handle hyphenated words
        let parts = cleaned.components(separatedBy: "-").filter { !$0.isEmpty }
        return parts.reduce(0) { total, part in
            total + baseCount(part)
        }
    }

    /// Counts total syllables in a line of text
    /// - Parameter line: The line of text to analyze
    /// - Returns: The total syllable count for the line
    static func countSyllablesInLine(_ line: String) -> Int {
        let words = line.trimmingCharacters(in: .whitespaces)
            .components(separatedBy: .whitespaces)
            .filter { !$0.isEmpty }

        guard !words.isEmpty else { return 0 }

        return words.reduce(0) { total, word in
            total + countSyllablesInWord(word)
        }
    }
}
