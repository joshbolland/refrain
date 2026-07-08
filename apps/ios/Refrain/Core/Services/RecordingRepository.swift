import Foundation
import Supabase

final class RecordingRepository: Sendable {
    private let supabase = SupabaseService.shared.client
    private let tableName = "recordings"

    // MARK: - CRUD Operations

    func fetchAll() async throws -> [Recording] {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        let rows: [Recording.DatabaseRow] = try await supabase
            .from(tableName)
            .select()
            .eq("user_id", value: userId)
            .order("updated_at", ascending: false)
            .execute()
            .value

        return rows.map { Recording(from: $0) }
    }

    func fetch(id: String) async throws -> Recording? {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        let rows: [Recording.DatabaseRow] = try await supabase
            .from(tableName)
            .select()
            .eq("id", value: id)
            .eq("user_id", value: userId)
            .limit(1)
            .execute()
            .value

        return rows.first.map { Recording(from: $0) }
    }

    func create(_ recording: Recording) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(tableName)
            .insert(recording.toInsertRow(userId: userId))
            .execute()
    }

    func update(_ recording: Recording) async throws {
        guard let userId = await AuthService.shared.getCurrentUserId() else {
            throw RepositoryError.notAuthenticated
        }

        try await supabase
            .from(tableName)
            .update(recording.toUpdateRow())
            .eq("id", value: recording.id)
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
