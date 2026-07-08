import Foundation

struct RecordingLyricLink: Identifiable, Codable, Equatable, Hashable, Sendable {
    var id: String
    var recordingId: String
    var lyricFileId: String
    var createdAt: Date

    init(
        id: String = UUID().uuidString,
        recordingId: String,
        lyricFileId: String,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.recordingId = recordingId
        self.lyricFileId = lyricFileId
        self.createdAt = createdAt
    }
}

// MARK: - Supabase Database Mapping

extension RecordingLyricLink {
    struct DatabaseRow: Codable {
        let id: String
        let recording_id: String
        let lyric_file_id: String
        let created_at: String
        let user_id: String?

        enum CodingKeys: String, CodingKey {
            case id
            case recording_id
            case lyric_file_id
            case created_at
            case user_id
        }
    }

    struct InsertRow: Codable {
        let id: String
        let user_id: String
        let recording_id: String
        let lyric_file_id: String
        let created_at: String
    }

    init(from row: DatabaseRow) {
        self.id = row.id
        self.recordingId = row.recording_id
        self.lyricFileId = row.lyric_file_id
        self.createdAt = SupabaseTimestampCodec.decode(row.created_at)
    }

    func toInsertRow(userId: String) -> InsertRow {
        return InsertRow(
            id: id,
            user_id: userId,
            recording_id: recordingId,
            lyric_file_id: lyricFileId,
            created_at: SupabaseTimestampCodec.encode(createdAt)
        )
    }
}
