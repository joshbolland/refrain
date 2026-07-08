import XCTest
@testable import Refrain

final class RecordingLyricLinkTests: XCTestCase {
    func testLinkedItemsReturnCounterparts() {
        let state = AppState.preview()
        let recording = state.recordings.first { $0.id == "rec-1" }!
        let lyric = state.lyricFiles.first { $0.id == "lyric-1" }!

        XCTAssertEqual(state.linkedItems(for: .recording(recording)), [.lyric(lyric)])
        XCTAssertEqual(state.linkedItems(for: .lyric(lyric)), [.recording(recording)])
    }

    func testLinkCandidatesExcludeAlreadyLinkedItems() {
        let state = AppState.preview()
        let recording = state.recordings.first { $0.id == "rec-1" }!
        let linkedLyric = state.lyricFiles.first { $0.id == "lyric-1" }!
        let unlinkedLyric = state.lyricFiles.first { $0.id == "lyric-2" }!

        let candidates = state.linkCandidates(for: .recording(recording))

        XCTAssertFalse(candidates.contains(.lyric(linkedLyric)))
        XCTAssertTrue(candidates.contains(.lyric(unlinkedLyric)))
    }

    func testProjectItemsToAddIncludesLinkedCounterpartWhenRequested() {
        let state = AppState.preview()
        let project = Project(id: "project-empty", title: "New Project")
        state.projects.append(project)

        let recording = state.recordings.first { $0.id == "rec-1" }!
        let lyric = state.lyricFiles.first { $0.id == "lyric-1" }!
        let items = state.itemsToAddToProject(
            [.recording(recording)],
            project: project,
            includeLinkedItems: true
        )

        XCTAssertEqual(items, [.recording(recording), .lyric(lyric)])
    }

    func testProjectItemsToAddDoesNotDuplicateExistingLinkedCounterpart() {
        let state = AppState.preview()
        let project = state.projects.first { $0.id == "collection-favorites" }!
        let recording = state.recordings.first { $0.id == "rec-1" }!

        let items = state.itemsToAddToProject(
            [.recording(recording)],
            project: project,
            includeLinkedItems: true
        )

        XCTAssertEqual(items, [.recording(recording)])
    }

    func testLocalLyricDeleteCleanupRemovesLinksAndAssignments() {
        let state = AppState.preview()

        state.removeLocalStateForDeletedLyricFile(id: "lyric-1")

        XCTAssertFalse(state.lyricFiles.contains { $0.id == "lyric-1" })
        XCTAssertFalse(state.projectAssignments.contains { $0.itemType == .lyric && $0.itemId == "lyric-1" })
        XCTAssertFalse(state.recordingLyricLinks.contains { $0.lyricFileId == "lyric-1" })
    }
}
