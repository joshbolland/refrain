import XCTest
@testable import Refrain

final class PersistenceDateTests: XCTestCase {
    func testTimestampCodecParsesSupabaseFormats() {
        let wholeSeconds = SupabaseTimestampCodec.decode("2026-07-01T12:34:56+00:00")
        let milliseconds = SupabaseTimestampCodec.decode("2026-07-01T12:34:56.123+00:00")
        let microseconds = SupabaseTimestampCodec.decode("2026-07-01T12:34:56.123456+00:00")
        let offsetMicroseconds = SupabaseTimestampCodec.decode("2026-07-01T13:34:56.123456+01:00")

        XCTAssertEqual(milliseconds.timeIntervalSince(wholeSeconds), 0.123, accuracy: 0.000_001)
        XCTAssertEqual(microseconds.timeIntervalSince(wholeSeconds), 0.123_456, accuracy: 0.000_001)
        XCTAssertEqual(offsetMicroseconds, microseconds)
    }

    func testMalformedTimestampUsesDeterministicOldFallback() {
        let decoded = SupabaseTimestampCodec.decode("not-a-timestamp")

        XCTAssertEqual(decoded, Date(timeIntervalSince1970: 0))
        XCTAssertGreaterThan(Date().timeIntervalSince(decoded), 60 * 60 * 24)
    }

    func testInvalidUpdatedTimestampFallsBackToCreationTimestamp() {
        let file = LyricFile(from: .init(
            id: "lyric",
            title: "Title",
            body: "Body",
            created_at: "2026-07-01T12:34:56.123456+00:00",
            updated_at: "invalid",
            section_types: nil,
            user_id: "user"
        ))

        XCTAssertEqual(file.updatedAt, file.createdAt)
    }

    func testLibraryDefaultsToMostRecentlyUpdatedFirst() {
        let state = AppState()
        let baseDate = Date(timeIntervalSince1970: 1_700_000_000)
        state.lyricFiles = [
            LyricFile(id: "old", title: "Old", updatedAt: baseDate),
            LyricFile(id: "new", title: "New", updatedAt: baseDate.addingTimeInterval(120)),
            LyricFile(id: "middle", title: "Middle", updatedAt: baseDate.addingTimeInterval(60))
        ]

        XCTAssertEqual(state.librarySortOption, .recentlyUpdated)
        XCTAssertEqual(state.filteredLibraryItems.map(\.id), ["new", "middle", "old"])
    }

    func testEditableContentComparisonIgnoresPersistenceDates() {
        let original = LyricFile(
            id: "lyric",
            title: "Title",
            body: "Body",
            createdAt: Date(timeIntervalSince1970: 100),
            updatedAt: Date(timeIntervalSince1970: 200),
            sectionTypes: [0: .verse]
        )
        var unchangedContent = original
        unchangedContent.createdAt = Date(timeIntervalSince1970: 300)
        unchangedContent.updatedAt = Date(timeIntervalSince1970: 400)
        var changedContent = unchangedContent
        changedContent.body = "Changed"

        XCTAssertTrue(unchangedContent.hasSameEditableContent(as: original))
        XCTAssertFalse(changedContent.hasSameEditableContent(as: original))
    }

    func testUpdatePayloadsCannotOverwriteIdentityOrCreationDate() throws {
        let lyricKeys = try encodedKeys(LyricFile(title: "Lyric").toUpdateRow())
        let recordingKeys = try encodedKeys(Recording(title: "Recording").toUpdateRow())
        let projectPayload = try encodedObject(Project(title: "Project", description: nil).toUpdateRow())

        for keys in [lyricKeys, recordingKeys, Set(projectPayload.keys)] {
            XCTAssertFalse(keys.contains("id"))
            XCTAssertFalse(keys.contains("user_id"))
            XCTAssertFalse(keys.contains("created_at"))
            XCTAssertTrue(keys.contains("updated_at"))
        }
        XCTAssertTrue(projectPayload["description"] is NSNull)
    }

    private func encodedKeys<T: Encodable>(_ value: T) throws -> Set<String> {
        Set(try encodedObject(value).keys)
    }

    private func encodedObject<T: Encodable>(_ value: T) throws -> [String: Any] {
        let data = try JSONEncoder().encode(value)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }
}
