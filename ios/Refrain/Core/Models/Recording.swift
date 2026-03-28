import Foundation

struct Recording: Identifiable, Codable, Equatable, Hashable, Sendable {
    var id: String
    var title: String
    var createdAt: Date
    var updatedAt: Date
    var durationMs: Int
    var uri: String

    init(
        id: String = UUID().uuidString,
        title: String = "Untitled Recording",
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        durationMs: Int = 0,
        uri: String = ""
    ) {
        self.id = id
        self.title = title
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.durationMs = durationMs
        self.uri = uri
    }

    var formattedDuration: String {
        let totalSeconds = durationMs / 1000
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, seconds)
        } else {
            return String(format: "%d:%02d", minutes, seconds)
        }
    }
}

// MARK: - Supabase Database Mapping

extension Recording {
    struct DatabaseRow: Codable {
        let id: String
        let title: String
        let created_at: String
        let updated_at: String
        let duration_ms: Int
        let uri: String
        let user_id: String?

        enum CodingKeys: String, CodingKey {
            case id, title, uri
            case created_at
            case updated_at
            case duration_ms
            case user_id
        }
    }

    struct InsertRow: Codable {
        let id: String
        let title: String
        let created_at: String
        let updated_at: String
        let duration_ms: Int
        let uri: String
        let user_id: String
    }

    init(from row: DatabaseRow) {
        self.id = row.id
        self.title = row.title
        self.createdAt = ISO8601DateFormatter().date(from: row.created_at) ?? Date()
        self.updatedAt = ISO8601DateFormatter().date(from: row.updated_at) ?? Date()
        self.durationMs = row.duration_ms
        self.uri = row.uri
    }

    func toInsertRow(userId: String) -> InsertRow {
        let formatter = ISO8601DateFormatter()
        return InsertRow(
            id: id,
            title: title,
            created_at: formatter.string(from: createdAt),
            updated_at: formatter.string(from: updatedAt),
            duration_ms: durationMs,
            uri: uri,
            user_id: userId
        )
    }
}
