import Foundation

/// Type of parsed line content
enum ParsedLineType: String, Sendable {
    case annotation  // Lines starting with //
    case lyric       // Regular lyric lines
    case empty       // Blank lines
}

/// Represents a parsed line from the lyric body
struct ParsedLine: Sendable {
    let index: Int
    let raw: String
    let text: String
    let type: ParsedLineType
    let syllableCount: Int?
    let endWord: String?
}

/// Parses lyric text into structured line data
enum LineParser {

    /// Checks if a line is an annotation (starts with //)
    static func isAnnotationLine(_ line: String) -> Bool {
        line.trimmingCharacters(in: .whitespaces).hasPrefix("//")
    }

    /// Parses the entire lyric body into an array of ParsedLine structs
    /// - Parameter body: The full lyric text
    /// - Returns: Array of ParsedLine for each line in the body
    static func parseLyricBody(_ body: String) -> [ParsedLine] {
        let rows = body.components(separatedBy: CharacterSet.newlines)

        return rows.enumerated().map { index, line in
            // Trim trailing whitespace only (preserve leading)
            let trimmedRight = line.replacingOccurrences(
                of: "\\s+$",
                with: "",
                options: .regularExpression
            )
            let cleaned = trimmedRight.trimmingCharacters(in: .whitespaces)

            let annotation = isAnnotationLine(trimmedRight)
            let empty = cleaned.isEmpty

            let type: ParsedLineType
            if annotation {
                type = .annotation
            } else if empty {
                type = .empty
            } else {
                type = .lyric
            }

            let syllableCount: Int? = type == .lyric
                ? SyllableCounter.countSyllablesInLine(trimmedRight)
                : nil

            let endWord: String? = type == .lyric
                ? RhymeAnalyzer.getLineEndWord(trimmedRight)
                : nil

            return ParsedLine(
                index: index,
                raw: line,
                text: trimmedRight,
                type: type,
                syllableCount: syllableCount,
                endWord: endWord
            )
        }
    }
}
