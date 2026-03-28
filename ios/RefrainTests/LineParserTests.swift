import XCTest
@testable import Refrain

final class LineParserTests: XCTestCase {

    // MARK: - isAnnotationLine Tests

    func testIsAnnotationLine_withComment_returnsTrue() {
        XCTAssertTrue(LineParser.isAnnotationLine("// This is a comment"))
        XCTAssertTrue(LineParser.isAnnotationLine("  // Indented comment"))
    }

    func testIsAnnotationLine_withLyric_returnsFalse() {
        XCTAssertFalse(LineParser.isAnnotationLine("This is a lyric"))
        XCTAssertFalse(LineParser.isAnnotationLine("I'm going // with you"))
    }

    func testIsAnnotationLine_withEmptyLine_returnsFalse() {
        XCTAssertFalse(LineParser.isAnnotationLine(""))
    }

    // MARK: - parseLyricBody Tests

    func testParseLyricBody_singleLine() {
        let body = "Hello world"
        let lines = LineParser.parseLyricBody(body)

        XCTAssertEqual(lines.count, 1)
        XCTAssertEqual(lines[0].index, 0)
        XCTAssertEqual(lines[0].text, "Hello world")
        XCTAssertEqual(lines[0].type, .lyric)
        XCTAssertEqual(lines[0].syllableCount, 3)
        XCTAssertEqual(lines[0].endWord, "world")
    }

    func testParseLyricBody_multipleLines() {
        let body = "Line one\nLine two\nLine three"
        let lines = LineParser.parseLyricBody(body)

        XCTAssertEqual(lines.count, 3)
        XCTAssertEqual(lines[0].index, 0)
        XCTAssertEqual(lines[1].index, 1)
        XCTAssertEqual(lines[2].index, 2)
    }

    func testParseLyricBody_emptyLine() {
        let body = "First\n\nThird"
        let lines = LineParser.parseLyricBody(body)

        XCTAssertEqual(lines.count, 3)
        XCTAssertEqual(lines[1].type, .empty)
        XCTAssertNil(lines[1].syllableCount)
        XCTAssertNil(lines[1].endWord)
    }

    func testParseLyricBody_annotationLine() {
        let body = "Lyric line\n// This is a comment\nAnother lyric"
        let lines = LineParser.parseLyricBody(body)

        XCTAssertEqual(lines.count, 3)
        XCTAssertEqual(lines[0].type, .lyric)
        XCTAssertEqual(lines[1].type, .annotation)
        XCTAssertEqual(lines[2].type, .lyric)
    }

    func testParseLyricBody_endWordExtraction() {
        let body = "Love is all you need!"
        let lines = LineParser.parseLyricBody(body)

        XCTAssertEqual(lines[0].endWord, "need")
    }

    func testParseLyricBody_emptyBody() {
        let body = ""
        let lines = LineParser.parseLyricBody(body)

        XCTAssertEqual(lines.count, 1)
        XCTAssertEqual(lines[0].type, .empty)
    }

    func testParseLyricBody_preservesLineIndices() {
        let body = "One\nTwo\n\nFour\n// Comment\nSix"
        let lines = LineParser.parseLyricBody(body)

        XCTAssertEqual(lines.count, 6)
        for (index, line) in lines.enumerated() {
            XCTAssertEqual(line.index, index)
        }
    }
}
