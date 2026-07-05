import XCTest
@testable import Refrain

final class RhymeSuggestionEditingTests: XCTestCase {

    func testCurrentWordAtCaretReturnsWordUnderCursor() {
        let text = "Keep me in perfect time"
        let location = (text as NSString).range(of: "perfect").location + 2

        let word = RhymeSuggestionEditing.currentWordAtCaret(at: location, in: text)

        XCTAssertEqual(word, "perfect")
    }

    func testCurrentWordAtCaretReturnsPreviousWordAtBoundary() {
        let text = "Keep me in perfect time"
        let range = (text as NSString).range(of: "perfect")
        let location = range.location + range.length

        let word = RhymeSuggestionEditing.currentWordAtCaret(at: location, in: text)

        XCTAssertEqual(word, "perfect")
    }

    func testReplacingWordAtCaretSwapsWordUnderCursor() {
        let text = "Keep me in perfect time"
        let range = (text as NSString).range(of: "perfect")
        let selection = NSRange(location: range.location + 2, length: 0)

        let replacement = RhymeSuggestionEditing.replacingWordAtCaret(
            in: text,
            selectedRange: selection,
            with: "electric"
        )

        XCTAssertEqual(replacement.text, "Keep me in electric time")
        XCTAssertEqual(
            replacement.selectedRange.location,
            ("Keep me in electric" as NSString).length
        )
    }

    func testReplacingWordAtCaretFallsBackToInsertionWhenNoWordSelected() {
        let text = "First line\n"
        let selection = NSRange(location: (text as NSString).length, length: 0)

        let replacement = RhymeSuggestionEditing.replacingWordAtCaret(
            in: text,
            selectedRange: selection,
            with: "glow"
        )

        XCTAssertEqual(replacement.text, "First line\nglow")
        XCTAssertEqual(replacement.selectedRange.location, ("First line\nglow" as NSString).length)
    }
}
