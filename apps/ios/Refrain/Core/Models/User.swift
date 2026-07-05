import Foundation

struct User: Identifiable, Codable, Equatable, Sendable {
    let id: String
    let email: String?
    let displayName: String?
    let avatarUrl: String?
    let createdAt: Date

    init(
        id: String,
        email: String? = nil,
        displayName: String? = nil,
        avatarUrl: String? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.email = email
        self.displayName = displayName
        self.avatarUrl = avatarUrl
        self.createdAt = createdAt
    }

    var initials: String {
        if let name = displayName, !name.isEmpty {
            let components = name.components(separatedBy: " ")
            if components.count >= 2 {
                let first = components[0].prefix(1)
                let last = components[1].prefix(1)
                return "\(first)\(last)".uppercased()
            }
            return String(name.prefix(2)).uppercased()
        }

        if let email = email {
            return String(email.prefix(2)).uppercased()
        }

        return "??"
    }
}
