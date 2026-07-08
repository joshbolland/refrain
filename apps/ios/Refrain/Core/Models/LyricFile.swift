import Foundation

struct LyricFile: Identifiable, Codable, Equatable, Hashable, Sendable {
    var id: String
    var title: String
    var body: String
    var createdAt: Date
    var updatedAt: Date
    var sectionTypes: [Int: SectionType]

    init(
        id: String = UUID().uuidString,
        title: String = "Untitled",
        body: String = "",
        createdAt: Date = Date(),
        updatedAt: Date = Date(),
        sectionTypes: [Int: SectionType] = [:]
    ) {
        self.id = id
        self.title = title
        self.body = body
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.sectionTypes = sectionTypes
    }
}

enum SectionType: String, Codable, CaseIterable, Sendable {
    case verse
    case chorus
    case bridge
    case preChorus = "pre-chorus"
    case intro
    case outro
    case other

    var displayName: String {
        switch self {
        case .verse: return "Verse"
        case .chorus: return "Chorus"
        case .bridge: return "Bridge"
        case .preChorus: return "Pre-Chorus"
        case .intro: return "Intro"
        case .outro: return "Outro"
        case .other: return "Other"
        }
    }

    var shortName: String {
        switch self {
        case .verse: return "V"
        case .chorus: return "C"
        case .bridge: return "Br"
        case .preChorus: return "PC"
        case .intro: return "In"
        case .outro: return "Ou"
        case .other: return "?"
        }
    }
}

// MARK: - Supabase Database Mapping

extension LyricFile {
    struct DatabaseRow: Codable {
        let id: String
        let title: String
        let body: String
        let created_at: String
        let updated_at: String
        let section_types: [String: String]?
        let user_id: String?

        enum CodingKeys: String, CodingKey {
            case id, title, body
            case created_at
            case updated_at
            case section_types
            case user_id
        }
    }

    struct InsertRow: Codable {
        let id: String
        let title: String
        let body: String
        let created_at: String
        let updated_at: String
        let section_types: [String: String]
        let user_id: String
    }

    struct UpdateRow: Codable {
        let title: String
        let body: String
        let updated_at: String
        let section_types: [String: String]
    }

    init(from row: DatabaseRow) {
        self.id = row.id
        self.title = row.title
        self.body = row.body
        self.createdAt = SupabaseTimestampCodec.decode(row.created_at)
        self.updatedAt = SupabaseTimestampCodec.decode(row.updated_at, fallback: createdAt)

        var sections: [Int: SectionType] = [:]
        if let sectionTypesDict = row.section_types {
            for (key, value) in sectionTypesDict {
                if let index = Int(key), let sectionType = SectionType(rawValue: value) {
                    sections[index] = sectionType
                }
            }
        }
        self.sectionTypes = sections
    }

    func toInsertRow(userId: String) -> InsertRow {
        return InsertRow(
            id: id,
            title: title,
            body: body,
            created_at: SupabaseTimestampCodec.encode(createdAt),
            updated_at: SupabaseTimestampCodec.encode(updatedAt),
            section_types: databaseSectionTypes,
            user_id: userId
        )
    }

    func toUpdateRow() -> UpdateRow {
        UpdateRow(
            title: title,
            body: body,
            updated_at: SupabaseTimestampCodec.encode(updatedAt),
            section_types: databaseSectionTypes
        )
    }

    func hasSameEditableContent(as other: LyricFile) -> Bool {
        title == other.title &&
        body == other.body &&
        sectionTypes == other.sectionTypes
    }

    private var databaseSectionTypes: [String: String] {
        Dictionary(uniqueKeysWithValues: sectionTypes.map { key, value in
            (String(key), value.rawValue)
        })
    }
}
