import Foundation

/// Represents a rhyme group assignment for a line
struct RhymeGroup: Sendable {
    let groupId: Int
    let word: String
}

/// Maps line indices to their rhyme group assignments
typealias RhymeGroupMap = [Int: RhymeGroup]

/// Analyzes rhymes and end words in lyric text
enum RhymeAnalyzer {

    /// Extracts the last word from a line, normalized for rhyme comparison
    /// - Parameter line: The line of text
    /// - Returns: The normalized end word, or nil if line is empty
    static func getLineEndWord(_ line: String) -> String? {
        let cleaned = line.trimmingCharacters(in: .whitespaces)
        guard !cleaned.isEmpty else { return nil }

        let tokens = cleaned.components(separatedBy: .whitespaces)
        guard let lastToken = tokens.last else { return nil }

        // Remove non-alphabetic characters except apostrophes
        let normalized = lastToken
            .unicodeScalars
            .filter { CharacterSet.letters.contains($0) || $0 == "'" }
            .reduce(into: "") { result, scalar in
                result.append(Character(scalar))
            }
            .lowercased()

        return normalized.isEmpty ? nil : normalized
    }

    /// Computes rhyme groups based on matching end words
    /// Lines with the same end word are assigned to the same group
    /// - Parameter lines: Array of parsed lines
    /// - Returns: Map of line indices to rhyme group assignments
    static func computeRhymeGroups(_ lines: [ParsedLine]) -> RhymeGroupMap {
        var assignments: RhymeGroupMap = [:]
        var seenWords: [String: Int] = [:]
        var counter = 0

        for line in lines {
            guard let endWord = line.endWord else { continue }

            if seenWords[endWord] == nil {
                seenWords[endWord] = counter
                counter += 1
            }

            assignments[line.index] = RhymeGroup(
                groupId: seenWords[endWord]!,
                word: endWord
            )
        }

        return assignments
    }
}
