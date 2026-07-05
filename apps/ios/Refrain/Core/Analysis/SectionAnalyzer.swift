import Foundation

/// Analyzes lyric text to identify section boundaries and manage section types
enum SectionAnalyzer {

    /// Checks if a line is blank (empty or whitespace only)
    static func isBlankLine(_ line: String) -> Bool {
        line.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// Gets the set of valid section start line indices
    /// A line is a valid section start if:
    /// - It's the first non-blank line, OR
    /// - It follows a blank line that has non-blank content before it
    static func getValidSectionStartSet(body: String) -> Set<Int> {
        let lines = body.components(separatedBy: "\n")
        var indices = Set<Int>()

        // Find the first non-blank line
        if let firstNonBlankIndex = lines.firstIndex(where: { !isBlankLine($0) }) {
            indices.insert(firstNonBlankIndex)
        }

        // Check for lines that follow a blank line with prior content
        func hasPriorNonBlank(upToIndex: Int) -> Bool {
            for j in stride(from: upToIndex, through: 0, by: -1) {
                if !isBlankLine(lines[j]) {
                    return true
                }
            }
            return false
        }

        for i in 1..<lines.count {
            if isBlankLine(lines[i - 1]) && hasPriorNonBlank(upToIndex: i - 2) {
                indices.insert(i)
            }
        }

        return indices
    }

    /// Gets section start line indices as a sorted array
    static func getSectionStartLineIndices(body: String) -> [Int] {
        Array(getValidSectionStartSet(body: body)).sorted()
    }

    /// Cleans up section types by removing entries for lines that are no longer valid section starts
    static func cleanupSectionTypes(
        body: String,
        sectionTypes: [Int: SectionType]
    ) -> [Int: SectionType] {
        let lines = body.components(separatedBy: "\n")
        let validStarts = getValidSectionStartSet(body: body)
        let hasNonBlankLines = lines.contains { !isBlankLine($0) }

        var cleaned: [Int: SectionType] = [:]

        for (key, value) in sectionTypes {
            let isEmptyStart = !hasNonBlankLines && key == 0
            if validStarts.contains(key) || isEmptyStart {
                cleaned[key] = value
            }
        }

        return cleaned
    }

    /// Finds the previous section start index of a specific type
    static func findPreviousSectionStartOfType(
        body: String,
        sectionTypes: [Int: SectionType],
        targetStartIndex: Int,
        targetType: SectionType
    ) -> Int? {
        let starts = getValidSectionStartSet(body: body)
            .filter { $0 < targetStartIndex }
            .sorted()

        var candidate: Int?
        for index in starts {
            if sectionTypes[index] == targetType {
                candidate = index
            }
        }

        return candidate
    }

    /// Finds the previous chorus section start
    static func findPreviousChorusStart(
        body: String,
        sectionTypes: [Int: SectionType],
        targetStartIndex: Int
    ) -> Int? {
        findPreviousSectionStartOfType(
            body: body,
            sectionTypes: sectionTypes,
            targetStartIndex: targetStartIndex,
            targetType: .chorus
        )
    }

    /// Gets the range of lines for a section block
    static func getSectionBlockRange(
        body: String,
        startIndex: Int
    ) -> (start: Int, endExclusive: Int) {
        let lines = body.components(separatedBy: "\n")
        let starts = getValidSectionStartSet(body: body)
            .filter { $0 >= 0 }
            .sorted()

        let nextStart = starts.first { $0 > startIndex }
        let endExclusive = nextStart ?? lines.count

        return (start: startIndex, endExclusive: endExclusive)
    }

    /// Extracts the text of a block from the given lines
    static func extractBlockText(lines: [String], range: (start: Int, endExclusive: Int)) -> String {
        let slice = Array(lines[range.start..<range.endExclusive])
        return slice.joined(separator: "\n")
    }

    /// Ensures all valid section starts have a section type assigned
    /// Assigns "verse" as the default for any unassigned sections (except index 0)
    static func ensureDefaultSectionTypes(
        body: String,
        sectionTypes: [Int: SectionType]
    ) -> [Int: SectionType] {
        let lines = body.components(separatedBy: "\n")
        let validStarts = getValidSectionStartSet(body: body)
        var next = sectionTypes

        for index in validStarts {
            if next[index] != nil {
                continue
            }
            if index == 0 {
                continue
            }
            if !isBlankLine(lines[index]) {
                next[index] = .verse
            }
        }

        return next
    }
}
