import XCTest
@testable import Refrain

final class SectionAnalyzerTests: XCTestCase {

    // MARK: - isBlankLine Tests

    func testIsBlankLine_withEmptyString_returnsTrue() {
        XCTAssertTrue(SectionAnalyzer.isBlankLine(""))
    }

    func testIsBlankLine_withWhitespace_returnsTrue() {
        XCTAssertTrue(SectionAnalyzer.isBlankLine("   "))
        XCTAssertTrue(SectionAnalyzer.isBlankLine("\t"))
        XCTAssertTrue(SectionAnalyzer.isBlankLine("  \t  "))
    }

    func testIsBlankLine_withContent_returnsFalse() {
        XCTAssertFalse(SectionAnalyzer.isBlankLine("hello"))
        XCTAssertFalse(SectionAnalyzer.isBlankLine("  hello  "))
    }

    // MARK: - getValidSectionStartSet Tests

    func testGetValidSectionStartSet_withSimpleBody() {
        let body = "First line\nSecond line"
        let starts = SectionAnalyzer.getValidSectionStartSet(body: body)

        XCTAssertEqual(starts, [0])
    }

    func testGetValidSectionStartSet_withTwoSections() {
        let body = "First verse\nLine two\n\nSecond verse\nLine four"
        let starts = SectionAnalyzer.getValidSectionStartSet(body: body)

        XCTAssertEqual(starts, [0, 3])
    }

    func testGetValidSectionStartSet_withBlankLinesAtStart() {
        let body = "\n\nFirst line"
        let starts = SectionAnalyzer.getValidSectionStartSet(body: body)

        XCTAssertEqual(starts, [2])
    }

    func testGetValidSectionStartSet_withEmptyBody() {
        let body = ""
        let starts = SectionAnalyzer.getValidSectionStartSet(body: body)

        XCTAssertTrue(starts.isEmpty)
    }

    // MARK: - getSectionStartLineIndices Tests

    func testGetSectionStartLineIndices_returnsSortedArray() {
        let body = "First\n\nSecond\n\nThird"
        let indices = SectionAnalyzer.getSectionStartLineIndices(body: body)

        XCTAssertEqual(indices, [0, 2, 4])
    }

    // MARK: - cleanupSectionTypes Tests

    func testCleanupSectionTypes_removesInvalidEntries() {
        let body = "Line one\n\nLine three"
        let sectionTypes: [Int: SectionType] = [
            0: .verse,
            1: .chorus,  // Invalid - blank line
            2: .bridge,
            5: .verse    // Invalid - out of range
        ]

        let cleaned = SectionAnalyzer.cleanupSectionTypes(body: body, sectionTypes: sectionTypes)

        XCTAssertEqual(cleaned.count, 2)
        XCTAssertEqual(cleaned[0], .verse)
        XCTAssertEqual(cleaned[2], .bridge)
    }

    // MARK: - findPreviousSectionStartOfType Tests

    func testFindPreviousSectionStartOfType_findsChorus() {
        let body = "Verse one\n\nChorus here\n\nVerse two\n\nThis line"
        let sectionTypes: [Int: SectionType] = [
            0: .verse,
            2: .chorus,
            4: .verse
        ]

        let result = SectionAnalyzer.findPreviousSectionStartOfType(
            body: body,
            sectionTypes: sectionTypes,
            targetStartIndex: 6,
            targetType: .chorus
        )

        XCTAssertEqual(result, 2)
    }

    func testFindPreviousSectionStartOfType_returnsNilWhenNotFound() {
        let body = "Verse one\n\nVerse two"
        let sectionTypes: [Int: SectionType] = [
            0: .verse,
            2: .verse
        ]

        let result = SectionAnalyzer.findPreviousSectionStartOfType(
            body: body,
            sectionTypes: sectionTypes,
            targetStartIndex: 2,
            targetType: .chorus
        )

        XCTAssertNil(result)
    }

    // MARK: - getSectionBlockRange Tests

    func testGetSectionBlockRange_firstSection() {
        let body = "Line one\nLine two\n\nLine four"
        let range = SectionAnalyzer.getSectionBlockRange(body: body, startIndex: 0)

        XCTAssertEqual(range.start, 0)
        XCTAssertEqual(range.endExclusive, 3)
    }

    func testGetSectionBlockRange_lastSection() {
        let body = "Line one\n\nLine three\nLine four"
        let range = SectionAnalyzer.getSectionBlockRange(body: body, startIndex: 2)

        XCTAssertEqual(range.start, 2)
        XCTAssertEqual(range.endExclusive, 4)
    }

    // MARK: - extractBlockText Tests

    func testExtractBlockText_extractsCorrectLines() {
        let lines = ["Line one", "Line two", "", "Line four", "Line five"]
        let range = (start: 0, endExclusive: 3)

        let text = SectionAnalyzer.extractBlockText(lines: lines, range: range)

        XCTAssertEqual(text, "Line one\nLine two\n")
    }

    // MARK: - ensureDefaultSectionTypes Tests

    func testEnsureDefaultSectionTypes_addsVerseToUnassigned() {
        let body = "First verse\n\nSecond verse"
        let sectionTypes: [Int: SectionType] = [
            0: .verse
        ]

        let result = SectionAnalyzer.ensureDefaultSectionTypes(body: body, sectionTypes: sectionTypes)

        XCTAssertEqual(result[0], .verse)
        XCTAssertEqual(result[2], .verse)
    }

    func testEnsureDefaultSectionTypes_preservesExisting() {
        let body = "First\n\nSecond"
        let sectionTypes: [Int: SectionType] = [
            0: .intro,
            2: .chorus
        ]

        let result = SectionAnalyzer.ensureDefaultSectionTypes(body: body, sectionTypes: sectionTypes)

        XCTAssertEqual(result[0], .intro)
        XCTAssertEqual(result[2], .chorus)
    }
}
