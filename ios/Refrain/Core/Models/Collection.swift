import Foundation

struct Collection: Identifiable, Codable, Equatable, Hashable, Sendable {
    var id: String
    var title: String
    var description: String?
    var createdAt: Date
    var updatedAt: Date

    init(
        id: String = UUID().uuidString,
        title: String = "Untitled Collection",
        description: String? = nil,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

enum CollectionItemType: String, Codable, Sendable {
    case lyric
    case recording
}

struct CollectionAssignment: Codable, Equatable, Sendable {
    let collectionId: String
    let itemId: String
    let itemType: CollectionItemType
    let createdAt: Date

    init(
        collectionId: String,
        itemId: String,
        itemType: CollectionItemType,
        createdAt: Date = Date()
    ) {
        self.collectionId = collectionId
        self.itemId = itemId
        self.itemType = itemType
        self.createdAt = createdAt
    }
}

// MARK: - Supabase Database Mapping

extension Collection {
    struct DatabaseRow: Codable {
        let id: String
        let title: String
        let description: String?
        let created_at: String
        let updated_at: String
        let user_id: String?

        enum CodingKeys: String, CodingKey {
            case id, title, description
            case created_at
            case updated_at
            case user_id
        }
    }

    struct InsertRow: Codable {
        let id: String
        let title: String
        let description: String?
        let created_at: String
        let updated_at: String
        let user_id: String
    }

    init(from row: DatabaseRow) {
        self.id = row.id
        self.title = row.title
        self.description = row.description
        self.createdAt = ISO8601DateFormatter().date(from: row.created_at) ?? Date()
        self.updatedAt = ISO8601DateFormatter().date(from: row.updated_at) ?? Date()
    }

    func toInsertRow(userId: String) -> InsertRow {
        let formatter = ISO8601DateFormatter()
        return InsertRow(
            id: id,
            title: title,
            description: description,
            created_at: formatter.string(from: createdAt),
            updated_at: formatter.string(from: updatedAt),
            user_id: userId
        )
    }
}

extension CollectionAssignment {
    struct DatabaseRow: Codable {
        let collection_id: String
        let item_id: String
        let item_type: String
        let created_at: String

        enum CodingKeys: String, CodingKey {
            case collection_id
            case item_id
            case item_type
            case created_at
        }
    }

    struct InsertRow: Codable {
        let collection_id: String
        let item_id: String
        let item_type: String
        let created_at: String
    }

    init(from row: DatabaseRow) {
        self.collectionId = row.collection_id
        self.itemId = row.item_id
        self.itemType = CollectionItemType(rawValue: row.item_type) ?? .lyric
        self.createdAt = ISO8601DateFormatter().date(from: row.created_at) ?? Date()
    }

    func toInsertRow() -> InsertRow {
        let formatter = ISO8601DateFormatter()
        return InsertRow(
            collection_id: collectionId,
            item_id: itemId,
            item_type: itemType.rawValue,
            created_at: formatter.string(from: createdAt)
        )
    }
}
