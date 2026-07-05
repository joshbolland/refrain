import XCTest
@testable import Refrain

final class SyllableCounterTests: XCTestCase {

    // MARK: - countSyllablesInWord Tests

    func testCountSyllablesInWord_singleSyllable() {
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("cat"), 1)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("dog"), 1)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("love"), 1)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("heart"), 1)
    }

    func testCountSyllablesInWord_twoSyllables() {
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("hello"), 2)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("music"), 2)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("rhythm"), 2)
    }

    func testCountSyllablesInWord_threeSyllables() {
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("beautiful"), 3)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("happiness"), 3)
    }

    func testCountSyllablesInWord_silentE() {
        // Words ending in silent 'e' should not count that as a syllable
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("love"), 1)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("hope"), 1)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("time"), 1)
    }

    func testCountSyllablesInWord_consonantPlusLe() {
        // Words ending in consonant + le should count that syllable
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("table"), 2)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("bottle"), 2)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("little"), 2)
    }

    func testCountSyllablesInWord_silentEd() {
        // 'ed' endings usually don't add syllable unless after t/d
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("loved"), 1)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("hoped"), 1)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("wanted"), 2)  // 'ted' ending
    }

    func testCountSyllablesInWord_hyphenatedWord() {
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("self-made"), 2)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("heart-broken"), 3)
    }

    func testCountSyllablesInWord_withPunctuation() {
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("hello!"), 2)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("love,"), 1)
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("(music)"), 2)
    }

    func testCountSyllablesInWord_emptyString() {
        XCTAssertEqual(SyllableCounter.countSyllablesInWord(""), 0)
    }

    func testCountSyllablesInWord_onlyPunctuation() {
        XCTAssertEqual(SyllableCounter.countSyllablesInWord("..."), 0)
    }

    // MARK: - countSyllablesInLine Tests

    func testCountSyllablesInLine_simpleLine() {
        XCTAssertEqual(SyllableCounter.countSyllablesInLine("I love you"), 3)
        XCTAssertEqual(SyllableCounter.countSyllablesInLine("Hello world"), 3)
    }

    func testCountSyllablesInLine_longerLine() {
        let line = "The beautiful music fills the air"
        let count = SyllableCounter.countSyllablesInLine(line)
        XCTAssertEqual(count, 9)  // the(1) beau-ti-ful(3) mu-sic(2) fills(1) the(1) air(1)
    }

    func testCountSyllablesInLine_emptyLine() {
        XCTAssertEqual(SyllableCounter.countSyllablesInLine(""), 0)
    }

    func testCountSyllablesInLine_whitespaceOnly() {
        XCTAssertEqual(SyllableCounter.countSyllablesInLine("   "), 0)
    }

    func testCountSyllablesInLine_withExtraSpaces() {
        XCTAssertEqual(SyllableCounter.countSyllablesInLine("hello   world"), 3)
    }
}
