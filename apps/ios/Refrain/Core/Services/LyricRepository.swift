import Foundation
import Supabase

final class LyricRepository: Sendable {
    private let supabase = SupabaseService.shared.client
    private let tableName = "lyric_files"

    // MARK: - CRUD Operations

    func fetchAll() async throws -> [LyricFile] {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        let rows: [LyricFile.DatabaseRow] = try await supabase
            .from(tableName)
            .select()
            .eq("user_id", value: userId)
            .order("updated_at", ascending: false)
            .execute()
            .value

        return rows.map { LyricFile(from: $0) }
    }

    func fetch(id: String) async throws -> LyricFile? {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        let rows: [LyricFile.DatabaseRow] = try await supabase
            .from(tableName)
            .select()
            .eq("id", value: id)
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value

        return rows.first.map { LyricFile(from: $0) }
    }

    func create(_ file: LyricFile) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(tableName)
            .insert(file.toInsertRow(userId: userId))
            .execute()
    }

    func update(_ file: LyricFile) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(tableName)
            .update(file.toUpdateRow())
            .eq("id", value: file.id)
            .eq("user_id", value: userId)
            .execute()
    }

    func delete(_ id: String) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(tableName)
            .delete()
            .eq("id", value: id)
            .eq("user_id", value: userId)
            .execute()
    }
}

// MARK: - Repository Errors

enum RepositoryError: LocalizedError {
    case notAuthenticated
    case notFound
    case saveFailed

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "You must be signed in to perform this action"
        case .notFound:
            return "The requested item was not found"
        case .saveFailed:
            return "Failed to save changes"
        }
    }
}
