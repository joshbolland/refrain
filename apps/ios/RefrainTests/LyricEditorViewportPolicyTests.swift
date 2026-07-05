import XCTest
@testable import Refrain

final class LyricEditorViewportPolicyTests: XCTestCase {
    private let policy = LyricEditorViewportPolicy(
        bottomClearance: 12,
        editingLineReserve: 28
    )

    func testVisibleBottomUsesTwelvePointClearanceOutsideEditing() {
        let visibleBottom = policy.visibleBottom(
            contentOffsetY: 100,
            viewportHeight: 300,
            isActivelyEditing: false
        )

        XCTAssertEqual(visibleBottom, 388)
    }

    func testCanvasHeightRestoresSpaceConsumedWhenIgnoringTopSafeArea() {
        let canvasHeight = LyricEditorLayout.canvasHeight(
            viewportHeight: 759,
            topSafeAreaInset: 59
        )

        XCTAssertEqual(canvasHeight, 818)
    }

    func testKeyboardSizedCanvasStillReachesKeyboardBoundary() {
        let canvasHeight = LyricEditorLayout.canvasHeight(
            viewportHeight: 379,
            topSafeAreaInset: 59
        )

        XCTAssertEqual(canvasHeight, 438)
    }

    func testVisibleBottomReservesOneFollowingLineWhileEditing() {
        let visibleBottom = policy.visibleBottom(
            contentOffsetY: 100,
            viewportHeight: 300,
            isActivelyEditing: true
        )

        XCTAssertEqual(visibleBottom, 360)
    }

    func testMaximumOffsetIncludesTrailingScrollInset() {
        let maximumOffset = policy.maximumContentOffset(
            contentHeight: 600,
            viewportHeight: 300,
            contentInsetTop: 0,
            contentInsetBottom: policy.trailingScrollInset
        )

        XCTAssertEqual(maximumOffset, 328)
    }

    func testCaretAlreadyInsideWorkingViewportDoesNotMoveContent() {
        let targetOffset = policy.targetContentOffset(
            caretMinY: 140,
            caretMaxY: 160,
            currentOffsetY: 100,
            viewportHeight: 300,
            contentHeight: 600,
            contentInsetTop: 0,
            contentInsetBottom: policy.trailingScrollInset,
            isActivelyEditing: true
        )

        XCTAssertEqual(targetOffset, 100)
    }

    func testCaretBelowWorkingViewportScrollsByRequiredDistance() {
        let targetOffset = policy.targetContentOffset(
            caretMinY: 370,
            caretMaxY: 380,
            currentOffsetY: 100,
            viewportHeight: 300,
            contentHeight: 600,
            contentInsetTop: 0,
            contentInsetBottom: policy.trailingScrollInset,
            isActivelyEditing: true
        )

        XCTAssertEqual(targetOffset, 120)
    }

    func testFinalCaretCanReachClearanceAndFollowingLineReserve() {
        let targetOffset = policy.targetContentOffset(
            caretMinY: 570,
            caretMaxY: 588,
            currentOffsetY: 0,
            viewportHeight: 300,
            contentHeight: 600,
            contentInsetTop: 0,
            contentInsetBottom: policy.trailingScrollInset,
            isActivelyEditing: true
        )

        XCTAssertEqual(targetOffset, 328)
    }
}
