import XCTest
@testable import Refrain

final class RhymeAnalyzerTests: XCTestCase {

    // MARK: - getLineEndWord Tests

    func testGetLineEndWord_simpleWord() {
        XCTAssertEqual(RhymeAnalyzer.getLineEndWord("I love you"), "you")
        XCTAssertEqual(RhymeAnalyzer.getLineEndWord("Hello world"), "world")
    }

    func testGetLineEndWord_withPunctuation() {
        XCTAssertEqual(RhymeAnalyzer.getLineEndWord("I love you!"), "you")
        XCTAssertEqual(RhymeAnalyzer.getLineEndWord("What's that?"), "that")
        XCTAssertEqual(RhymeAnalyzer.getLineEndWord("Love, sweet love."), "love")
    }

    func testGetLineEndWord_withApostrophe() {
        XCTAssertEqual(RhymeAnalyzer.getLineEndWord("Don't you know"), "know")
        XCTAssertEqual(RhymeAnalyzer.getLineEndWord("I'm feelin' it"), "it")
    }

    func testGetLineEndWord_emptyLine() {
        XCTAssertNil(RhymeAnalyzer.getLineEndWord(""))
        XCTAssertNil(RhymeAnalyzer.getLineEndWord("   "))
    }

    func testGetLineEndWord_onlyPunctuation() {
        XCTAssertNil(RhymeAnalyzer.getLineEndWord("..."))
    }

    func testGetLineEndWord_lowercased() {
        XCTAssertEqual(RhymeAnalyzer.getLineEndWord("Hello WORLD"), "world")
    }

    // MARK: - computeRhymeGroups Tests

    func testComputeRhymeGroups_matchingEndWords() {
        let lines = [
            ParsedLine(index: 0, raw: "First line", text: "First line", type: .lyric, syllableCount: 2, endWord: "love"),
            ParsedLine(index: 1, raw: "Second line", text: "Second line", type: .lyric, syllableCount: 2, endWord: "above"),
            ParsedLine(index: 2, raw: "Third line", text: "Third line", type: .lyric, syllableCount: 2, endWord: "love"),
        ]

        let groups = RhymeAnalyzer.computeRhymeGroups(lines)

        XCTAssertEqual(groups[0]?.word, "love")
        XCTAssertEqual(groups[1]?.word, "above")
        XCTAssertEqual(groups[2]?.word, "love")

        // Same word should have same group ID
        XCTAssertEqual(groups[0]?.groupId, groups[2]?.groupId)
        XCTAssertNotEqual(groups[0]?.groupId, groups[1]?.groupId)
    }

    func testComputeRhymeGroups_emptyLines() {
        let lines = [
            ParsedLine(index: 0, raw: "", text: "", type: .empty, syllableCount: nil, endWord: nil),
            ParsedLine(index: 1, raw: "// Comment", text: "// Comment", type: .annotation, syllableCount: nil, endWord: nil),
        ]

        let groups = RhymeAnalyzer.computeRhymeGroups(lines)

        XCTAssertTrue(groups.isEmpty)
    }

    func testComputeRhymeGroups_uniqueWords() {
        let lines = [
            ParsedLine(index: 0, raw: "First", text: "First", type: .lyric, syllableCount: 1, endWord: "one"),
            ParsedLine(index: 1, raw: "Second", text: "Second", type: .lyric, syllableCount: 1, endWord: "two"),
            ParsedLine(index: 2, raw: "Third", text: "Third", type: .lyric, syllableCount: 1, endWord: "three"),
        ]

        let groups = RhymeAnalyzer.computeRhymeGroups(lines)

        XCTAssertEqual(groups.count, 3)
        XCTAssertEqual(groups[0]?.groupId, 0)
        XCTAssertEqual(groups[1]?.groupId, 1)
        XCTAssertEqual(groups[2]?.groupId, 2)
    }

    func testComputeRhymeGroups_mixedContent() {
        let lines = [
            ParsedLine(index: 0, raw: "Love", text: "Love", type: .lyric, syllableCount: 1, endWord: "love"),
            ParsedLine(index: 1, raw: "", text: "", type: .empty, syllableCount: nil, endWord: nil),
            ParsedLine(index: 2, raw: "Above", text: "Above", type: .lyric, syllableCount: 2, endWord: "above"),
            ParsedLine(index: 3, raw: "Love", text: "Love", type: .lyric, syllableCount: 1, endWord: "love"),
        ]

        let groups = RhymeAnalyzer.computeRhymeGroups(lines)

        XCTAssertEqual(groups.count, 3)  // Only lyric lines
        XCTAssertNil(groups[1])  // Empty line has no group
        XCTAssertEqual(groups[0]?.groupId, groups[3]?.groupId)  // Same word
    }
}
